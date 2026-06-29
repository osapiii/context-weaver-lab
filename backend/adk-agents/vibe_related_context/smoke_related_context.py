"""Smoke test VibeControl related-context GitHub PR flow.

Default is read-only:
  - load an existing VibeControl application + operation video from Firestore
  - build the exact `vibe_related_context` mode_state
  - call the ADK tool that fetches GitHub PR candidates
  - print the pseudo RequestDoc that would be written

Write/invoke actions are explicit:
  --write-request-doc writes organizations/{org}/spaces/{space}/requests/adkInvokeRequests/logs/{requestId}
  --invoke-adk-url URL posts directly to an ADK endpoint and consumes SSE
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from google.adk.sessions.state import State
from google.cloud import firestore

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vibe_related_context.tools import (  # noqa: E402
    fetch_github_pull_request_candidates,
    fetch_knowledge_document_candidates,
    fetch_slack_message_candidates,
    read_related_context_request,
)

REQUEST_COLLECTION = "requests/adkInvokeRequests/logs"


class ToolContext:
    def __init__(self, state: dict[str, Any]):
        self.state = State(value=state, delta={})


@dataclass(frozen=True)
class SmokeTarget:
    organization_id: str
    space_id: str
    user_id: str
    user_email: str
    application: dict[str, Any]
    operation_video: dict[str, Any]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _collection(db: firestore.Client, org_id: str, space_id: str, name: str):
    return (
        db.collection("organizations")
        .document(org_id)
        .collection("spaces")
        .document(space_id)
        .collection(name)
    )


def _doc_with_id(snap: firestore.DocumentSnapshot) -> dict[str, Any]:
    data = snap.to_dict() or {}
    return {"id": snap.id, **data}


def _first_doc(query) -> dict[str, Any] | None:
    docs = list(query.limit(1).stream())
    return _doc_with_id(docs[0]) if docs else None


def load_target(args: argparse.Namespace) -> SmokeTarget:
    db = firestore.Client(project=args.project_id or None)
    org_id = args.organization_id
    space_id = args.space_id
    if not org_id or not space_id:
        raise SystemExit("--organization-id and --space-id are required")

    apps = _collection(db, org_id, space_id, "vibeControlApplications")
    videos = _collection(db, org_id, space_id, "vibeControlOperationVideos")

    if args.application_id:
        app_snap = apps.document(args.application_id).get()
        if not app_snap.exists:
            raise SystemExit(f"application not found: {args.application_id}")
        application = _doc_with_id(app_snap)
    else:
        application = _first_doc(
            apps.where("repoFullName", "!=", "").order_by("repoFullName")
        )
        if not application:
            raise SystemExit("no application with repoFullName found")

    if args.video_id:
        video_snap = videos.document(args.video_id).get()
        if not video_snap.exists:
            raise SystemExit(f"operation video not found: {args.video_id}")
        operation_video = _doc_with_id(video_snap)
    else:
        operation_video = _first_doc(
            videos.where("applicationId", "==", application["id"]).order_by(
                "recordedAt", direction=firestore.Query.DESCENDING
            )
        )
        if not operation_video:
            raise SystemExit(f"no operation video found for application {application['id']}")

    user_id = args.user_id or os.getenv("VIBE_RELATED_CONTEXT_USER_ID", "")
    user_email = args.user_email or os.getenv("VIBE_RELATED_CONTEXT_USER_EMAIL", "")
    if not user_id:
        raise SystemExit("--user-id is required so the GitHub OAuth token can be resolved")
    if not user_email:
        user_email = "smoke@example.com"

    return SmokeTarget(
        organization_id=org_id,
        space_id=space_id,
        user_id=user_id,
        user_email=user_email,
        application=application,
        operation_video=operation_video,
    )


def build_mode_state(
    target: SmokeTarget,
    session_id: str,
    *,
    provider: str = "github",
) -> dict[str, Any]:
    app = target.application
    video = target.operation_video
    return {
        "active_mode": "vibe_related_context",
        "vibe_related_context": {
            "phase": "collecting",
            "setup": {
                "confirmed": True,
                "provider": provider,
                "related_context_session_id": session_id,
                "organization_id": target.organization_id,
                "space_id": target.space_id,
                "user_id": target.user_id,
                "application_id": app.get("id"),
                "application_key": app.get("applicationKey"),
                "application_name": app.get("name"),
                "repo_full_name": app.get("repoFullName"),
                "default_branch": app.get("defaultBranch") or "main",
                "file_space_id": app.get("fileSpaceId"),
                "operation_video_id": video.get("id"),
            },
            "payload": {
                "application": {
                    "id": app.get("id"),
                    "applicationKey": app.get("applicationKey"),
                    "name": app.get("name"),
                    "summary": app.get("summary"),
                    "domain": app.get("domain"),
                    "repoFullName": app.get("repoFullName"),
                    "defaultBranch": app.get("defaultBranch") or "main",
                    "fileSpaceId": app.get("fileSpaceId"),
                },
                "operation_video": {
                    "id": video.get("id"),
                    "title": video.get("title"),
                    "description": video.get("description"),
                    "quickScan": video.get("quickScan"),
                    "transcriptSummary": video.get("transcriptSummary"),
                    "transcriptProvider": video.get("transcriptProvider"),
                    "frameCaptures": video.get("frameCaptures") or [],
                    "recordedAt": video.get("recordedAt"),
                    "sourceDisplaySurface": video.get("sourceDisplaySurface"),
                },
                "analysis_result": video.get("analysisResult"),
                "existing_related_contexts": video.get("relatedContexts"),
                "expected_outputs": (
                    ["slack_messages", "related_reasons"]
                    if provider == "slack"
                    else (
                        ["knowledge_documents", "downloadable_file_refs", "related_reasons"]
                        if provider == "knowledge"
                        else ["github_pull_requests", "related_reasons"]
                    )
                ),
            },
        },
    }


def build_invoke_input(
    target: SmokeTarget,
    session_id: str,
    response_id: str,
    *,
    provider: str = "github",
) -> dict[str, Any]:
    app = target.application
    video = target.operation_video
    return {
        "mode": "vibe_related_context",
        "sessionId": session_id,
        "organizationId": target.organization_id,
        "spaceId": target.space_id,
        "userId": target.user_id,
        "prompt": "\n".join(
            [
                f"{app.get('name') or 'Application'} の操作動画「{video.get('title') or video.get('id')}」に関連する{('Slack会話' if provider == 'slack' else 'FileSpaceナレッジファイル' if provider == 'knowledge' else 'GitHub Pull Request')}を探してください。",
                "動画解析結果、操作メモ、文字起こし要約、Story候補と、候補情報を照合してください。",
                "関連する理由を日本語で付け、関連度の高い候補だけを返してください。",
            ]
        ),
        "responseId": response_id,
        "model": "2.5-flash",
        "workspaceId": app.get("id"),
        "fileSpaceId": app.get("fileSpaceId"),
        "history": [],
        "modeState": build_mode_state(target, session_id, provider=provider),
        "attachments": [],
        "selectedKnowledge": [],
        "referenceImages": [],
    }


def build_request_doc(
    target: SmokeTarget,
    request_id: str,
    *,
    provider: str = "github",
) -> dict[str, Any]:
    session_id = f"smoke-related-context-{target.application['id']}-{target.operation_video['id']}-{int(time.time())}"
    response_id = f"smoke-related-context-response-{int(time.time())}"
    return {
        "input": build_invoke_input(
            target,
            session_id,
            response_id,
            provider=provider,
        ),
        "operationMetadata": {
            "organizationId": target.organization_id,
            "spaceId": target.space_id,
            "loggingCollectionId": REQUEST_COLLECTION,
            "loggingDocumentId": request_id,
            "requestedBy": {
                "userId": target.user_id,
                "email": target.user_email,
                "role": 3,
            },
            "isCommand": True,
            "isOouiCrud": False,
            "isLlmCall": True,
            "isAdminCrud": False,
        },
        "output": None,
        "status": "pending",
        "logs": [],
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }


def run_tool_smoke(target: SmokeTarget, *, provider: str = "github") -> dict[str, Any]:
    session_id = f"tool-smoke-{int(time.time())}"
    state = build_mode_state(target, session_id, provider=provider)
    ctx = ToolContext(state)
    request_context = read_related_context_request(ctx)
    if provider == "slack":
        candidates = fetch_slack_message_candidates(ctx)
    elif provider == "knowledge":
        candidates = fetch_knowledge_document_candidates(ctx)
    else:
        candidates = fetch_github_pull_request_candidates(ctx)
    return {
        "requestContext": request_context,
        "candidateResult": candidates,
    }


def write_request_doc(args: argparse.Namespace, request_id: str, doc: dict[str, Any]) -> None:
    db = firestore.Client(project=args.project_id or None)
    path = (
        db.collection("organizations")
        .document(args.organization_id)
        .collection("spaces")
        .document(args.space_id)
        .collection("requests")
        .document("adkInvokeRequests")
        .collection("logs")
    )
    path.document(request_id).set(doc)


def consume_sse(resp: requests.Response) -> dict[str, Any]:
    summary: dict[str, Any] = {"events": [], "done": None, "text": ""}
    event_name = ""
    for line in resp.iter_lines(decode_unicode=True):
        if line is None:
            continue
        text = line.decode("utf-8") if isinstance(line, bytes) else str(line)
        if text.startswith("event:"):
            event_name = text.split(":", 1)[1].strip()
            summary["events"].append(event_name)
            continue
        if not text.startswith("data:"):
            continue
        raw = text.split(":", 1)[1].strip()
        if not raw:
            continue
        payload = json.loads(raw)
        if event_name == "text_delta":
            summary["text"] += payload.get("text", "")
        elif event_name == "done":
            summary["done"] = payload
        elif event_name == "error":
            raise RuntimeError(payload.get("message") or "ADK SSE error")
    return summary


def invoke_adk(args: argparse.Namespace, target: SmokeTarget) -> dict[str, Any]:
    secret = args.internal_secret or os.getenv("ADK_INTERNAL_INVOKE_SECRET", "")
    if not secret:
        raise SystemExit("--internal-secret or ADK_INTERNAL_INVOKE_SECRET is required")
    session_id = f"direct-smoke-related-context-{int(time.time())}"
    frontend_body = build_invoke_input(
        target,
        session_id,
        f"direct-smoke-response-{int(time.time())}",
        provider=args.provider,
    )
    body = {
        "session_id": frontend_body["sessionId"],
        "user_id": frontend_body["userId"],
        "organization_id": frontend_body["organizationId"],
        "space_id": frontend_body["spaceId"],
        "file_space_id": frontend_body.get("fileSpaceId"),
        "workspace_id": frontend_body.get("workspaceId"),
        "prompt": frontend_body["prompt"],
        "model": frontend_body.get("model"),
        "history": frontend_body.get("history") or [],
        "mode_state": frontend_body.get("modeState") or {},
        "response_id": frontend_body.get("responseId"),
        "attachments": frontend_body.get("attachments") or [],
        "selected_knowledge": frontend_body.get("selectedKnowledge") or [],
        "reference_images": frontend_body.get("referenceImages") or [],
    }
    url = args.invoke_adk_url.rstrip("/") + "/v1/agents/vibe_related_context/invoke"
    resp = requests.post(
        url,
        headers={
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "X-En-AIStudio-Internal-Invoke": secret,
            "X-En-AIStudio-Requested-Uid": target.user_id,
            "X-En-AIStudio-Organization-Id": target.organization_id,
            "X-En-AIStudio-Space-Id": target.space_id,
            "X-En-AIStudio-Request-Id": "direct-smoke",
        },
        json=body,
        timeout=540,
        stream=True,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"ADK invoke failed {resp.status_code}: {resp.text[:1000]}")
    return consume_sse(resp)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", default=os.getenv("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--space-id", required=True)
    parser.add_argument("--application-id", default="")
    parser.add_argument("--video-id", default="")
    parser.add_argument("--user-id", default="")
    parser.add_argument("--user-email", default="")
    parser.add_argument("--provider", choices=["github", "slack", "knowledge"], default="github")
    parser.add_argument("--write-request-doc", action="store_true")
    parser.add_argument("--invoke-adk-url", default="")
    parser.add_argument("--internal-secret", default="")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    target = load_target(args)
    request_id = f"adkInvoke_smoke_related_context_{int(time.time())}"
    request_doc = build_request_doc(target, request_id, provider=args.provider)
    tool_result = run_tool_smoke(target, provider=args.provider)

    output: dict[str, Any] = {
        "target": {
            "organizationId": target.organization_id,
            "spaceId": target.space_id,
            "userId": target.user_id,
            "applicationId": target.application.get("id"),
            "applicationName": target.application.get("name"),
            "repoFullName": target.application.get("repoFullName"),
            "videoId": target.operation_video.get("id"),
            "videoTitle": target.operation_video.get("title"),
        },
        "toolSmoke": {
            "ok": tool_result["candidateResult"].get("ok"),
            "candidateCount": len(
                tool_result["candidateResult"].get("pullRequests")
                or tool_result["candidateResult"].get("messages")
                or tool_result["candidateResult"].get("documents")
                or []
            ),
            "error": tool_result["candidateResult"].get("error"),
            "firstCandidates": (
                tool_result["candidateResult"].get("pullRequests")
                or tool_result["candidateResult"].get("messages")
                or tool_result["candidateResult"].get("documents")
                or []
            )[:5],
        },
        "requestDocPath": (
            f"organizations/{target.organization_id}/spaces/{target.space_id}/"
            f"{REQUEST_COLLECTION}/{request_id}"
        ),
        "requestDocPreview": request_doc,
    }

    if args.invoke_adk_url:
        output["directAdkInvoke"] = invoke_adk(args, target)

    if args.write_request_doc:
        write_request_doc(args, request_id, request_doc)
        output["requestDocWritten"] = True
    else:
        output["requestDocWritten"] = False

    if args.json:
        print(json.dumps(output, ensure_ascii=False, indent=2, default=str))
        return

    print(json.dumps(output, ensure_ascii=False, indent=2, default=str))
    if not args.write_request_doc:
        print("\nDry-run only. Add --write-request-doc to create the pseudo RequestDoc.")


if __name__ == "__main__":
    main()
