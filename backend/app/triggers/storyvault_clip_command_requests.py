"""Route StoryVault clip Command RequestDocs to the shared Cloud Run service."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import requests
from firebase_functions import firestore_fn
from google.cloud import firestore
import google.auth.transport.requests
import google.oauth2.id_token

db = firestore.Client()


def _auth_headers(service_url: str) -> dict[str, str]:
    token = google.oauth2.id_token.fetch_id_token(
        google.auth.transport.requests.Request(), service_url
    )
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "storyVaultClipCommandRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=540,
)
def on_storyvault_clip_command_request_created(event) -> None:
    snap = event.data
    if snap is None:
        return
    fields = snap.to_dict() or {}
    if fields.get("status") not in (None, "", "pending"):
        return
    service_url = os.getenv("STORYVAULT_CLIP_COMMAND_SERVICE_URL", "").rstrip("/")
    if not service_url:
        snap.reference.update({
            "status": "error",
            "errorMessage": "STORYVAULT_CLIP_COMMAND_SERVICE_URL is not configured",
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        return
    operation = str((fields.get("input") or {}).get("operation") or "")
    body = {
        "requestId": snap.id,
        "requestPath": snap.reference.path,
        "organizationId": event.params.get("organizationId"),
        "spaceId": event.params.get("spaceId"),
        "input": fields.get("input") or {},
        "operationMetadata": fields.get("operationMetadata") or {},
    }
    snap.reference.update({
        "status": "processing",
        "microServicePayload": {
            "name": "storyvault-clip-command",
            "endpoint": f"/commands/{operation}",
            "payload": {"requestId": snap.id, "operation": operation},
        },
        "logs": firestore.ArrayUnion([{
            "timestamp": datetime.now(timezone.utc),
            "message": f"Cloud Run command started: {operation}",
            "type": "info",
        }]),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    try:
        response = requests.post(
            f"{service_url}/commands/{operation}", json=body,
            headers=_auth_headers(service_url), timeout=520,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Cloud Run HTTP {response.status_code}: {response.text[:1000]}")
        result = response.json()
        status = result.get("status") or "completed"
        if status not in ("completed", "partial_error"):
            raise RuntimeError(str(result.get("errorMessage") or "command returned non-terminal status"))
        snap.reference.update({
            "status": status,
            "output": result.get("output") or {},
            "logs": firestore.ArrayUnion([{
                "timestamp": datetime.now(timezone.utc),
                "message": f"Cloud Run command completed: {operation}",
                "type": "info",
            }]),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
    except Exception as exc:
        snap.reference.update({
            "status": "error", "errorMessage": str(exc),
            "logs": firestore.ArrayUnion([{
                "timestamp": datetime.now(timezone.utc),
                "message": str(exc), "type": "error",
            }]),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        raise
