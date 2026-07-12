"""Tools for the ADK data analysis agent.

The ADK agent owns context interpretation and Vertex AI Search grounding. This
tool calls the BigQuery-backed Conversational Analytics Data Agent, then saves
the fixed CA response JSON together with ADK-derived context as an ADK artifact.
The Storage trigger syncs that artifact into Firestore for the UI to render.
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

import google.auth
import google.auth.transport.requests
import requests

from common.adk_artifact_io import (  # type: ignore
    build_custom_metadata,
    safe_artifact_filename,
    save_text_artifact,
)
from common.tool_state import read_tool_state  # type: ignore

logger = logging.getLogger(__name__)

API_HOST = "https://geminidataanalytics.googleapis.com"
API_VERSION = "v1alpha"
SCOPES = ("https://www.googleapis.com/auth/cloud-platform",)
RESULT_KIND = "en_aistudio_data_analysis_result"


def _project_id() -> str:
    raw = os.getenv("FIREBASE_CONFIG")
    if raw:
        try:
            pid = json.loads(raw).get("projectId")
            if pid:
                return str(pid)
        except Exception:
            pass
    return os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCLOUD_PROJECT") or ""


def _normalize_org_id_for_agent(organization_id: str) -> str:
    cleaned = re.sub(r"[^a-z0-9-]", "-", organization_id.strip().lower())
    cleaned = cleaned.strip("-")
    return cleaned or "unknown"


def _data_agent_id(organization_id: str) -> str:
    return f"en-aistudio-org-{_normalize_org_id_for_agent(organization_id)}-analyst"


def _configured_data_agent_id(
    organization_id: str,
    space_id: str | None,
    workspace_id: str | None,
) -> str | None:
    """Resolve Data Agent ID from Firestore configuration when available."""
    try:
        from google.cloud import firestore

        fs = firestore.Client(project=_project_id() or None)
        if space_id:
            path = f"organizations/{organization_id}/spaces/{space_id}/settings/enAiStudioDataAgent"
            snap = fs.document(path).get()
            if snap.exists:
                data = snap.to_dict() or {}
                agent_id = data.get("agentId")
                if isinstance(agent_id, str) and agent_id.strip():
                    return agent_id.strip()

        org_snap = fs.collection("organizations").document(organization_id).get()
        if org_snap.exists:
            data = org_snap.to_dict() or {}
            analyst = data.get("dataAnalyst")
            if isinstance(analyst, dict):
                agent_id = analyst.get("agentId")
                if isinstance(agent_id, str) and agent_id.strip():
                    return agent_id.strip()
    except Exception:
        logger.exception("failed to resolve configured data agent id")
    return None


def _data_agent_id_for_request(
    organization_id: str,
    space_id: str | None,
    workspace_id: str | None,
) -> str:
    if os.getenv("DATA_AGENT_ID"):
        return os.getenv("DATA_AGENT_ID", "").strip()
    configured = _configured_data_agent_id(
        organization_id,
        space_id,
        workspace_id,
    )
    if configured:
        return configured
    return _data_agent_id(organization_id)


def _agent_name(project_id: str, location: str, agent_id: str) -> str:
    return f"projects/{project_id}/locations/{location}/dataAgents/{agent_id}"


def _headers(project_id: str) -> dict[str, str]:
    creds, _ = google.auth.default(scopes=list(SCOPES))
    creds.refresh(google.auth.transport.requests.Request())
    return {
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json",
        "X-Goog-User-Project": project_id,
    }


def _parse_ca_body(body: str) -> Any:
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        events: list[Any] = []
        for line in body.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("data:"):
                line = line[len("data:") :].strip()
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        if events:
            return events
    return {"rawText": body}


def _iter_ca_messages(ca_response: Any) -> list[dict[str, Any]]:
    if isinstance(ca_response, list):
        return [item for item in ca_response if isinstance(item, dict)]
    if isinstance(ca_response, dict):
        messages = ca_response.get("messages")
        if isinstance(messages, list):
            return [item for item in messages if isinstance(item, dict)]
        return [ca_response]
    return []


def _message_payload(ev: dict[str, Any]) -> dict[str, Any]:
    msg = ev.get("systemMessage") or ev.get("system_message") or ev
    return msg if isinstance(msg, dict) else {}


def _collect_summary_fields(ca_response: Any) -> dict[str, Any]:
    text_parts: list[str] = []
    sql: list[str] = []
    chart_count = 0
    table_count = 0

    for ev in _iter_ca_messages(ca_response):
        msg = _message_payload(ev)
        text = msg.get("text")
        if isinstance(text, dict):
            for part in text.get("parts") or []:
                if isinstance(part, str) and part.strip():
                    text_parts.append(part.strip())
        elif isinstance(text, str) and text.strip():
            text_parts.append(text.strip())

        chart = msg.get("chart")
        if isinstance(chart, dict):
            result = chart.get("result")
            if isinstance(result, dict) and (
                isinstance(result.get("vegaConfig"), dict)
                or isinstance(result.get("vega_config"), dict)
            ):
                chart_count += 1

        data = msg.get("data")
        if isinstance(data, dict):
            generated_sql = data.get("generatedSql") or data.get("generated_sql")
            if isinstance(generated_sql, str) and generated_sql.strip():
                sql.append(generated_sql.strip())
            result = data.get("result")
            if isinstance(result, dict):
                rows = result.get("rows") or result.get("data")
                if isinstance(rows, list) and rows:
                    table_count += 1

    return {
        "markdown": "\n\n".join(text_parts),
        "sql": sql,
        "chart_count": chart_count,
        "table_count": table_count,
    }


def _clean_source_refs(source_refs: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    cleaned: list[dict[str, str]] = []
    for ref in source_refs or []:
        if not isinstance(ref, dict):
            continue
        item: dict[str, str] = {}
        for key in ("title", "uri", "snippet"):
            value = ref.get(key)
            if isinstance(value, str) and value.strip():
                item[key] = value.strip()
        if item:
            cleaned.append(item)
    return cleaned[:20]


def _state_value(state: dict[str, Any], key: str) -> str | None:
    value = state.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


async def analyze_bigquery_data(
    user_question: str,
    rewritten_analysis_query: str,
    organization_id: str | None = None,
    space_id: str | None = None,
    workspace_id: str | None = None,
    knowledge_context_summary: str | None = None,
    source_refs: list[dict[str, Any]] | None = None,
    chat_history: list[dict[str, str]] | None = None,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Call CA API and save the complete analysis result JSON as an artifact.

    Args:
        user_question: Original user question for audit/display.
        rewritten_analysis_query: Context-enriched query to send to the CA Data
          Agent. Include time windows, dimensions, filters, and scope.
        organization_id: EN AI Studio organization id. Falls back to session state.
        space_id: EN AI Studio space id. Falls back to session state.
        workspace_id: Optional workspace id. Falls back to session state.
        knowledge_context_summary: Short summary of Vertex AI Search/context
          that affected the query.
        source_refs: Context sources actually used, each with title/uri/snippet.
        chat_history: Optional prior turns to pass through to CA.
        tool_context: Injected ADK ToolContext used to save the JSON artifact.

    Returns:
        Summary fields for the LLM plus ``artifact_refs`` pointing at the saved
        ``en_aistudio_data_analysis_result`` JSON.
    """
    state = read_tool_state(tool_context)
    org_id = (organization_id or _state_value(state, "organization_id") or "").strip()
    sp_id = (space_id or _state_value(state, "space_id") or "").strip()
    resolved_workspace_id = (
        workspace_id
        or _state_value(state, "workspace_id")
        or ""
    ).strip()

    project_id = _project_id()
    if not project_id:
        return {"ok": False, "error": "GOOGLE_CLOUD_PROJECT is not configured"}
    if not org_id:
        return {"ok": False, "error": "organization_id is required"}
    if not rewritten_analysis_query.strip():
        return {"ok": False, "error": "rewritten_analysis_query is required"}
    if tool_context is None:
        return {"ok": False, "error": "tool_context is required to save artifact"}

    location = os.getenv("DATA_AGENT_LOCATION", "global")
    agent_id = _data_agent_id_for_request(
        org_id,
        sp_id or None,
        resolved_workspace_id or None,
    )

    scoped_query = rewritten_analysis_query.strip()
    scope_hints = [f"organization_id={org_id}"]
    if sp_id:
        scope_hints.append(f"space_id={sp_id}")
    if resolved_workspace_id:
        scope_hints.append(f"workspace_id={resolved_workspace_id}")
    scoped_query += "\n\n分析スコープ: " + ", ".join(scope_hints)

    messages: list[dict[str, Any]] = []
    for turn in chat_history or []:
        text = turn.get("text", "")
        if not text:
            continue
        if turn.get("role") == "user":
            messages.append({"userMessage": {"text": text}})
        else:
            messages.append({"systemMessage": {"text": {"parts": [text]}}})
    messages.append({"userMessage": {"text": scoped_query}})

    request_body = {
        "parent": f"projects/{project_id}/locations/{location}",
        "messages": messages,
        "dataAgentContext": {
            "dataAgent": _agent_name(project_id, location, agent_id),
        },
    }
    url = f"{API_HOST}/{API_VERSION}/projects/{project_id}/locations/{location}:chat"

    try:
        resp = requests.post(
            url,
            headers=_headers(project_id),
            json=request_body,
            stream=True,
            timeout=120,
        )
        raw_body = resp.content.decode("utf-8", errors="replace")
        if resp.status_code >= 400:
            logger.error("CA chat failed: %s %s", resp.status_code, raw_body)
            return {
                "ok": False,
                "error": f"Conversational Analytics API failed: {resp.status_code} {raw_body[:500]}",
            }
        ca_response = _parse_ca_body(raw_body)
    except Exception as exc:
        logger.exception("CA chat exception")
        return {"ok": False, "error": str(exc)}

    summary = _collect_summary_fields(ca_response)
    analysis_context = {
        "organizationId": org_id,
        "spaceId": sp_id or None,
        "workspaceId": resolved_workspace_id or None,
        "userQuestion": user_question.strip(),
        "rewrittenAnalysisQuery": rewritten_analysis_query.strip(),
        "knowledgeContextSummary": (knowledge_context_summary or "").strip() or None,
        "sourceRefs": _clean_source_refs(source_refs),
        "dataAgent": _agent_name(project_id, location, agent_id),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    artifact_payload = {
        "kind": RESULT_KIND,
        "schemaVersion": 1,
        "analysisContext": analysis_context,
        "caResponse": ca_response,
    }
    title = "データ分析結果"
    filename = safe_artifact_filename("data_analysis_result", ".json")
    ref = await save_text_artifact(
        tool_context,
        filename=filename,
        body=json.dumps(artifact_payload, ensure_ascii=False, indent=2),
        mime_type="application/json",
        kind=RESULT_KIND,
        title=title,
        custom_metadata=build_custom_metadata(
            kind=RESULT_KIND,
            title=title,
            schema_version="1",
        ),
    )
    if ref is None:
        return {"ok": False, "error": "failed to save analysis result artifact"}

    return {
        "ok": True,
        "markdown": summary["markdown"],
        "sql": summary["sql"],
        "chart_count": summary["chart_count"],
        "table_count": summary["table_count"],
        "analysis_context": analysis_context,
        "artifact_refs": [ref],
    }
