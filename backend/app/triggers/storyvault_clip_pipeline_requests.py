"""Start and retry the browser-independent StoryVault clip pipeline."""

from __future__ import annotations

import os
from typing import Any

import requests
from firebase_functions import firestore_fn
from google.cloud import firestore
import google.auth.transport.requests
import google.oauth2.id_token

db = firestore.Client()


def _kicker_url() -> str:
    value = os.getenv("STORYVAULT_CLIP_PIPELINE_KICKER_URL", "").rstrip("/")
    if not value:
        raise RuntimeError("STORYVAULT_CLIP_PIPELINE_KICKER_URL is not configured")
    return value


def _event_snapshot(event: Any):
    data = event.data
    return data.after if isinstance(data, firestore_fn.Change) else data


def _post(route: str, body: dict[str, Any], request_ref) -> None:
    try:
        base_url = _kicker_url()
        token = google.oauth2.id_token.fetch_id_token(
            google.auth.transport.requests.Request(), base_url
        )
        response = requests.post(
            f"{base_url}{route}", json=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}, timeout=50,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"kicker HTTP {response.status_code}: {response.text[:500]}")
    except Exception as exc:
        request_ref.update({
            "status": "error", "errorMessage": str(exc),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        raise


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "storyVaultClipPipelineRequests/logs/{pipelineId}"
    ),
    memory=512,
    timeout_sec=60,
)
def on_storyvault_clip_pipeline_request_created(event) -> None:
    snap = _event_snapshot(event)
    if snap is None:
        return
    data = snap.to_dict() or {}
    _post("/kick", {
        "requestPath": snap.reference.path,
        "requestId": snap.id,
        "organizationId": event.params.get("organizationId"),
        "spaceId": event.params.get("spaceId"),
        "input": data.get("input") or {},
        "operationMetadata": data.get("operationMetadata") or {},
        "applicationId": data.get("applicationId"),
        "clipGroupId": data.get("clipGroupId"),
        "title": data.get("title"),
    }, snap.reference)


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "storyVaultClipPipelineRequests/logs/{pipelineId}/commands/{commandId}"
    ),
    memory=512,
    timeout_sec=60,
)
def on_storyvault_clip_pipeline_command_created(event) -> None:
    snap = _event_snapshot(event)
    if snap is None:
        return
    pipeline_path = "/".join(snap.reference.path.split("/")[:-2])
    command = snap.to_dict() or {}
    _post("/retry", {
        "requestPath": pipeline_path,
        "requestId": event.params.get("pipelineId"),
        "commandId": snap.id,
        "command": {
            "type": command.get("type"),
            "clipId": command.get("clipId"),
            "step": command.get("step"),
        },
        "organizationId": event.params.get("organizationId"),
        "spaceId": event.params.get("spaceId"),
    }, db.document(pipeline_path))
    snap.reference.update({"status": "accepted", "updatedAt": firestore.SERVER_TIMESTAMP})
