"""
Transactional Email Request Trigger

Firestore: organizations/{orgId}/spaces/{spaceId}/requests/transactionalEmailRequests/logs/{requestId}
onCreate → POST send-mail Cloud Run /send → patch RequestDoc.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any

import requests
from firebase_functions import firestore_fn
from google.cloud import firestore
import google.auth.transport.requests
import google.oauth2.id_token

db = firestore.Client()

SEND_MAIL_SERVICE_URL = os.getenv(
    "SEND_MAIL_SERVICE_URL",
    "",
).rstrip("/")


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


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "transactionalEmailRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=120,
)
def on_transactional_email_request_created(
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
    to_list = input_data.get("to") or []
    subject = (input_data.get("subject") or "").strip()
    html = (input_data.get("html") or "").strip()

    if not to_list or not subject or not html:
        _update_doc(
            collection_path,
            request_id,
            {
                "status": "error",
                "errorMessage": "input.to, subject, and html are required",
            },
        )
        return

    try:
        if not SEND_MAIL_SERVICE_URL:
            raise RuntimeError("SEND_MAIL_SERVICE_URL is not configured")
        _update_doc(collection_path, request_id, {"status": "processing"})
        _append_log(collection_path, request_id, "Send mail start", "info")

        request_body = {
            "request_id": request_id,
            "input": {
                "to": to_list,
                "subject": subject,
                "html": html,
                "text": input_data.get("text"),
                "reply_to": input_data.get("replyTo"),
            },
            "operation_metadata": operation_metadata,
        }
        url = f"{SEND_MAIL_SERVICE_URL}/send"
        micro_payload = {
            "name": "send-mail",
            "endpoint": "/send",
            "payload": request_body,
        }
        _update_doc(
            collection_path,
            request_id,
            {"microServicePayload": micro_payload},
        )

        response = requests.post(
            url,
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + google.oauth2.id_token.fetch_id_token(
                    google.auth.transport.requests.Request(), SEND_MAIL_SERVICE_URL
                ),
            },
            timeout=90,
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"send-mail HTTP {response.status_code}: {(response.text or '')[:1000]}"
            )

        body = response.json()
        if body.get("status") != "success":
            err = body.get("error") or {}
            message = err.get("message") if isinstance(err, dict) else str(err)
            raise RuntimeError(message or "send-mail returned error status")

        output = body.get("output") or {}
        _update_doc(
            collection_path,
            request_id,
            {"status": "completed", "output": output},
        )
        _append_log(collection_path, request_id, "Send mail completed", "info")
    except Exception as exc:
        err = str(exc)[:2000]
        _update_doc(
            collection_path,
            request_id,
            {"status": "error", "errorMessage": err},
        )
        _append_log(collection_path, request_id, err, "error")
