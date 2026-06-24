"""
ADK Invoke Request Trigger

Firestore: organizations/{orgId}/spaces/{spaceId}/requests/adkInvokeRequests/logs/{requestId}
onCreate → POST en-aistudio-adk-agent /v1/agents/{mode}/invoke (SSE consume) → patch RequestDoc.
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any

import requests
from firebase_functions import firestore_fn
from google.cloud import firestore

db = firestore.Client()


def _adk_base_url(mode: str | None = None) -> str:
    normalized = (mode or "").strip().lower()
    mode_env = ""
    if normalized == "vibe_capability_structuring":
        mode_env = os.getenv("EN_AISTUDIO_ADK_VIBE_CAPABILITY_STRUCTURING_URL", "")
    elif normalized == "vibe_story_generation":
        mode_env = os.getenv("EN_AISTUDIO_ADK_VIBE_STORY_GENERATION_URL", "")
    return (
        mode_env
        or os.getenv(
            "EN_AISTUDIO_ADK_AGENT_URL",
            "https://en-aistudio-adk-agent-wsqdguu4pq-an.a.run.app",
        )
    ).rstrip("/")


def _adk_service_name(mode: str) -> str:
    normalized = (mode or "").strip().lower()
    if normalized == "vibe_capability_structuring":
        return "vibe-capability-structuring-agent"
    if normalized == "vibe_story_generation":
        return "vibe-story-generation-agent"
    return "en-aistudio-adk-agent"


def _internal_secret() -> str:
    return (os.getenv("ADK_INTERNAL_INVOKE_SECRET") or "").strip()


def _extract_event_info(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> dict[str, Any]:
    if isinstance(event.data, firestore_fn.Change):
        snap = event.data.after
    else:
        snap = event.data
    if snap is None:
        return {"docData": None, "docId": None, "collectionFullPath": None}
    doc_data = snap.to_dict() or {}
    full_path = snap.reference.path
    parts = full_path.split("/")
    return {
        "docData": doc_data,
        "docId": snap.id,
        "collectionFullPath": "/".join(parts[:-1]),
        "fullPath": full_path,
    }


def _update_doc(collection_path: str, document_id: str, data: dict[str, Any]) -> None:
    payload = {**data, "updatedAt": firestore.SERVER_TIMESTAMP}
    db.collection(collection_path).document(document_id).update(payload)


def _append_log(
    collection_path: str,
    doc_id: str,
    message: str,
    log_type: str = "info",
) -> None:
    entry = {
        "timestamp": datetime.now(),
        "message": message,
        "type": log_type,
    }
    db.collection(collection_path).document(doc_id).update(
        {"logs": firestore.ArrayUnion([entry])}
    )


def _build_invoke_body(
    *,
    input_data: dict[str, Any],
    operation_metadata: dict[str, Any],
) -> dict[str, Any]:
    requested_by = operation_metadata.get("requestedBy") or {}
    user_id = (
        input_data.get("userId")
        or input_data.get("user_id")
        or requested_by.get("userId")
        or ""
    )
    org_id = (
        input_data.get("organizationId")
        or input_data.get("organization_id")
        or operation_metadata.get("organizationId")
        or ""
    )
    space_id = (
        input_data.get("spaceId")
        or input_data.get("space_id")
        or operation_metadata.get("spaceId")
        or ""
    )
    attachments = input_data.get("attachments") or []
    normalized_attachments = []
    for item in attachments:
        if not isinstance(item, dict):
            continue
        gcs_path = (
            item.get("gcsPath") or item.get("gcs_path") or ""
        ).strip()
        if not gcs_path:
            continue
        normalized_attachments.append(
            {
                "id": item.get("id") or "",
                "name": item.get("name") or "",
                "gcs_path": gcs_path,
                "mime_type": item.get("mimeType")
                or item.get("mime_type")
                or "",
                "size": item.get("size") or 0,
            }
        )
    ref_images = input_data.get("referenceImages") or input_data.get(
        "reference_images"
    ) or []
    usage_context = (
        input_data.get("usageContext")
        or input_data.get("usage_context")
        or {}
    )
    if not isinstance(usage_context, dict):
        usage_context = {}
    usage_context = {
        **usage_context,
        "organization_id": usage_context.get("organization_id")
        or usage_context.get("organizationId")
        or org_id,
        "space_id": usage_context.get("space_id")
        or usage_context.get("spaceId")
        or space_id,
        "request_id": usage_context.get("request_id")
        or usage_context.get("requestId")
        or operation_metadata.get("loggingDocumentId")
        or "",
        "request_path": usage_context.get("request_path")
        or usage_context.get("requestPath")
        or "",
        "request_type": usage_context.get("request_type")
        or usage_context.get("requestType")
        or "adkInvokeRequest",
        "mode": input_data.get("mode") or "",
        "is_llm_call": bool(operation_metadata.get("isLlmCall")),
    }
    mode_state = input_data.get("modeState") or input_data.get("mode_state") or {}
    if isinstance(mode_state, dict):
        mode_state = _with_application_scan_email_hint(
            mode_state=mode_state,
            requested_email=(requested_by.get("email") or "").strip(),
        )
    return {
        "session_id": input_data.get("sessionId") or input_data.get("session_id"),
        "user_id": user_id,
        "organization_id": org_id,
        "space_id": space_id,
        "file_space_id": input_data.get("fileSpaceId")
        or input_data.get("file_space_id"),
        "workspace_id": input_data.get("workspaceId")
        or input_data.get("workspace_id")
        or space_id,
        "prompt": input_data.get("prompt") or "",
        "model": input_data.get("model"),
        "history": input_data.get("history") or [],
        "mode_state": mode_state if isinstance(mode_state, dict) else {},
        "system_prompt": input_data.get("systemPrompt")
        or input_data.get("system_prompt"),
        "response_id": input_data.get("responseId")
        or input_data.get("response_id"),
        "attachments": normalized_attachments,
        "selected_knowledge": input_data.get("selectedKnowledge")
        or input_data.get("selected_knowledge")
        or [],
        "reference_images": ref_images,
        "operation_metadata": operation_metadata,
        "usage_context": usage_context,
    }


def _with_application_scan_email_hint(
    *,
    mode_state: dict[str, Any],
    requested_email: str,
) -> dict[str, Any]:
    if not requested_email:
        return mode_state
    application_scan = mode_state.get("application_scan")
    if not isinstance(application_scan, dict):
        return mode_state
    setup = application_scan.get("setup")
    if not isinstance(setup, dict):
        return mode_state
    if setup.get("auth_mode") != "email_link_manual":
        return mode_state
    if setup.get("email_hint") or setup.get("username"):
        return mode_state
    return {
        **mode_state,
        "application_scan": {
            **application_scan,
            "setup": {
                **setup,
                "email_hint": requested_email,
            },
        },
    }


def _parse_json_document_body(body: Any) -> dict[str, Any] | None:
    if not isinstance(body, str) or not body.strip():
        return None
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _consume_sse(response: requests.Response) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "responseTextLength": 0,
        "responseTextPreview": "",
        "artifactCount": 0,
        "sourceReferenceCount": 0,
        "sessionId": None,
        "resolvedModel": None,
        "businessPartner": None,
    }
    event_name = ""
    for line in response.iter_lines(decode_unicode=True):
        if line is None:
            continue
        text = line.decode("utf-8") if isinstance(line, bytes) else str(line)
        if text.startswith("event:"):
            event_name = text.split(":", 1)[1].strip()
            continue
        if not text.startswith("data:"):
            continue
        payload_raw = text.split(":", 1)[1].strip()
        if not payload_raw:
            continue
        try:
            payload = json.loads(payload_raw)
        except json.JSONDecodeError:
            continue
        if event_name == "text_delta" and isinstance(payload.get("text"), str):
            text_delta = payload["text"]
            summary["responseTextLength"] += len(text_delta)
            if len(summary["responseTextPreview"]) < 2000:
                summary["responseTextPreview"] = (
                    summary["responseTextPreview"] + text_delta
                )[:2000]
        elif event_name == "artifact":
            summary["artifactCount"] += 1
            if payload.get("kind") == "json_document":
                doc = _parse_json_document_body(payload.get("body"))
                if doc and isinstance(doc.get("fields"), dict):
                    summary["businessPartner"] = {
                        "draft": doc,
                        "phase": "done",
                    }
        elif event_name == "grounding":
            chunks = payload.get("groundingChunks") or payload.get(
                "grounding_chunks"
            )
            if isinstance(chunks, list):
                summary["sourceReferenceCount"] += len(chunks)
        elif event_name == "done":
            if isinstance(payload.get("session_id"), str):
                summary["sessionId"] = payload["session_id"]
            raw_bp = payload.get("business_partner")
            if isinstance(raw_bp, dict) and raw_bp:
                existing = summary.get("businessPartner")
                if not isinstance(existing, dict) or not existing.get("draft"):
                    summary["businessPartner"] = raw_bp
                else:
                    merged = dict(raw_bp)
                    merged.setdefault("draft", existing.get("draft"))
                    summary["businessPartner"] = merged
        elif event_name == "error":
            msg = payload.get("message")
            if isinstance(msg, str) and msg.strip():
                raise RuntimeError(msg.strip())
    return summary


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "adkInvokeRequests/logs/{requestId}"
    ),
    memory=1024,
    timeout_sec=540,
)
def on_adk_invoke_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    info = _extract_event_info(event)
    fields = info["docData"] or {}
    request_id = info["docId"]
    collection_path = info["collectionFullPath"]
    if not request_id or not collection_path:
        return

    input_data = fields.get("input") or {}
    operation_metadata = fields.get("operationMetadata") or {}
    mode = (input_data.get("mode") or "").strip().lower()
    if not mode:
        _update_doc(
            collection_path,
            request_id,
            {"status": "error", "errorMessage": "input.mode is required"},
        )
        return

    secret = _internal_secret()
    if not secret:
        _update_doc(
            collection_path,
            request_id,
            {
                "status": "error",
                "errorMessage": "ADK_INTERNAL_INVOKE_SECRET is not configured",
            },
        )
        return

    requested_by = operation_metadata.get("requestedBy") or {}
    uid = (requested_by.get("userId") or input_data.get("userId") or "").strip()
    if not uid:
        _update_doc(
            collection_path,
            request_id,
            {"status": "error", "errorMessage": "requestedBy.userId is required"},
        )
        return

    try:
        _update_doc(collection_path, request_id, {"status": "processing"})
        _append_log(collection_path, request_id, f"ADK invoke start mode={mode}")

        body = _build_invoke_body(
            input_data=input_data,
            operation_metadata=operation_metadata,
        )
        url = f"{_adk_base_url(mode)}/v1/agents/{mode}/invoke"
        headers = {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "X-En-AIStudio-Internal-Invoke": secret,
            "X-En-AIStudio-Requested-Uid": uid,
            "X-En-AIStudio-Organization-Id": body.get("organization_id") or "",
            "X-En-AIStudio-Space-Id": body.get("space_id") or "",
            "X-En-AIStudio-Request-Id": request_id,
        }
        caller_token = (
            input_data.get("callerIdToken")
            or input_data.get("caller_id_token")
            or ""
        ).strip()
        if caller_token:
            headers["Authorization"] = f"Bearer {caller_token}"
        micro_payload = {
            "name": _adk_service_name(mode),
            "endpoint": url,
            "payload": body,
        }
        _update_doc(
            collection_path,
            request_id,
            {"microServicePayload": micro_payload},
        )

        response = requests.post(
            url,
            headers=headers,
            json=body,
            stream=True,
            timeout=530,
        )
        if not response.ok:
            detail = (response.text or "")[:2000]
            raise RuntimeError(f"ADK invoke HTTP {response.status_code}: {detail}")

        summary = _consume_sse(response)
        summary.setdefault("sessionId", body.get("session_id"))
        response_preview = str(summary.get("responseTextPreview") or "").lower()
        if mode == "application_scan" and any(
            marker in response_preview
            for marker in [
                "application_scan login failed",
                "application_scan.setup",
                "スキャンが中断",
                "ログインに失敗",
            ]
        ):
            raise RuntimeError(
                (summary.get("responseTextPreview") or "Application Scan failed")[
                    :2000
                ]
            )
        _update_doc(
            collection_path,
            request_id,
            {
                "status": "completed",
                "output": summary,
            },
        )
        _append_log(collection_path, request_id, "ADK invoke completed", "info")

        try:
            from triggers.research_completion_email import (
                maybe_enqueue_research_completion_email,
            )

            if maybe_enqueue_research_completion_email(
                {
                    "collection_path": collection_path,
                    "request_id": request_id,
                    "input_data": input_data,
                    "operation_metadata": operation_metadata,
                    "summary": summary,
                }
            ):
                _append_log(
                    collection_path,
                    request_id,
                    "Research completion email enqueued",
                    "info",
                )
        except Exception as email_exc:
            _append_log(
                collection_path,
                request_id,
                f"Research completion email skipped: {email_exc}",
                "error",
            )
    except Exception as exc:
        err = str(exc)[:2000]
        _update_doc(
            collection_path,
            request_id,
            {"status": "error", "errorMessage": err},
        )
        _append_log(collection_path, request_id, err, "error")
