"""
Research completion email — enqueue transactionalEmailRequest from ADK invoke trigger.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from google.cloud import firestore

db = firestore.Client()

EN_AISTUDIO_APP_BASE_URL = (
    os.getenv("EN_AISTUDIO_APP_BASE_URL") or "https://en-aistudio-development.web.app"
).rstrip("/")


def _research_report_url(params: dict[str, str]) -> str:
    session_id = params["session_id"]
    return f"{EN_AISTUDIO_APP_BASE_URL}/admin/ai-studio?session={session_id}&kind=research"


def _build_research_completion_html(params: dict[str, str]) -> str:
    theme = params.get("theme") or "リサーチレポート"
    report_url = params["report_url"]
    return f"""
<div style="font-family: sans-serif; line-height: 1.6; color: #1f2937;">
  <h2 style="color: #ea580c;">リサーチレポートが完成しました</h2>
  <p>テーマ: <strong>{theme}</strong></p>
  <p>AI による調査・図解・読み物 HTML の生成が完了しました。</p>
  <p>
    <a href="{report_url}" style="display:inline-block;padding:10px 16px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
      レポートを開く
    </a>
  </p>
  <p style="font-size:12px;color:#6b7280;">このメールに心当たりがない場合は無視してください。</p>
</div>
""".strip()


def _resolve_notification_recipient(params: dict[str, Any]) -> str:
    input_data = params.get("input_data") or {}
    explicit = (input_data.get("notificationEmail") or "").strip()
    if explicit:
        return explicit

    mode_state = input_data.get("modeState") or input_data.get("mode_state") or {}
    if isinstance(mode_state, dict):
        nested = (mode_state.get("notificationEmail") or "").strip()
        if nested:
            return nested

    operation_metadata = params.get("operation_metadata") or {}
    requested_by = operation_metadata.get("requestedBy") or {}
    return (requested_by.get("email") or "").strip()


def _build_research_completion_text(params: dict[str, str]) -> str:
    theme = params.get("theme") or "リサーチレポート"
    report_url = params["report_url"]
    return (
        f"リサーチレポートが完成しました。\n\n"
        f"テーマ: {theme}\n"
        f"レポート: {report_url}\n"
    )


def maybe_enqueue_research_completion_email(params: dict[str, Any]) -> bool:
    """
    ADK research invoke 完了後に transactional email RequestDoc を 1 回だけ起票する.

    Returns True if a new email request was created.
    """
    collection_path = params["collection_path"]
    request_id = params["request_id"]
    input_data = params.get("input_data") or {}
    operation_metadata = params.get("operation_metadata") or {}
    summary = params.get("summary") or {}

    mode = (input_data.get("mode") or "").strip().lower()
    if mode != "research":
        return False

    doc_ref = db.collection(collection_path).document(request_id)
    snap = doc_ref.get()
    if not snap.exists:
        return False
    current = snap.to_dict() or {}
    output = current.get("output") or {}
    if isinstance(output, dict) and output.get("emailNotificationSentAt"):
        return False

    session_id = (
        input_data.get("sessionId")
        or input_data.get("session_id")
        or summary.get("sessionId")
        or ""
    ).strip()
    if not session_id:
        return False

    artifact_count = int(summary.get("artifactCount") or 0)
    if artifact_count < 1:
        return False

    recipient = _resolve_notification_recipient(
        {
            "input_data": input_data,
            "operation_metadata": operation_metadata,
        }
    )
    if not recipient:
        return False

    org_id = (operation_metadata.get("organizationId") or "").strip()
    space_id = (operation_metadata.get("spaceId") or "").strip()
    if not org_id or not space_id:
        return False

    mode_state = input_data.get("modeState") or input_data.get("mode_state") or {}
    theme = ""
    if isinstance(mode_state, dict):
        theme = (
            mode_state.get("theme")
            or mode_state.get("research_theme")
            or ""
        ).strip()

    report_url = _research_report_url({"session_id": session_id})
    html = _build_research_completion_html(
        {"theme": theme, "report_url": report_url}
    )
    text = _build_research_completion_text(
        {"theme": theme, "report_url": report_url}
    )
    subject = f"【EN AI Studio】リサーチレポート完成: {theme or session_id[:8]}"

    email_request_id = f"txnEmail_research_{request_id}"
    email_collection = (
        f"organizations/{org_id}/spaces/{space_id}/requests/"
        "transactionalEmailRequests/logs"
    )
    email_ref = db.collection(email_collection).document(email_request_id)
    if email_ref.get().exists:
        doc_ref.update(
            {
                "output.emailNotificationSentAt": datetime.now(timezone.utc).isoformat(),
                "output.emailRequestId": email_request_id,
            }
        )
        return False

    email_ref.set(
        {
            "input": {
                "to": [recipient],
                "subject": subject,
                "html": html,
                "text": text,
                "template": "research_completed",
                "context": {
                    "sessionId": session_id,
                    "theme": theme or None,
                    "reportUrl": report_url,
                },
            },
            "operationMetadata": operation_metadata,
            "output": None,
            "status": "pending",
            "logs": [],
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )

    merged_output = dict(output) if isinstance(output, dict) else {}
    merged_output["emailNotificationSentAt"] = datetime.now(timezone.utc).isoformat()
    merged_output["emailRequestId"] = email_request_id
    doc_ref.update({"output": merged_output})
    return True
