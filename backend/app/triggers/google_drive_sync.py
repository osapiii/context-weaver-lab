"""
Google Drive Sync Request Trigger (Workflows architecture)

Firestore で googleDriveSyncRequests/logs/{requestId} が作成されたら、
google-drive-workflow-kicker microservice に POST /kick して即終了する。

- kicker が:
  1. _kickerPayload.importIds / removeIds を GCS YAML として保存
  2. RequestDoc.input.inputArtifactUri / importCount / removeCount を patch
  3. GCP Workflows `gdrive-sync` を `executions.create` で起動
  4. RequestDoc.workflow.executionName / consoleUrl を patch

- このトリガーは polling しない (Workflow の進捗は Workflow 自身が RequestDoc に
  書き戻す)。最大 timeout も 60s で十分。
"""

from __future__ import annotations

import os
import re
import requests
from firebase_functions import firestore_fn
from google.cloud import firestore


db = firestore.Client()


def _resolve_kicker_url() -> str:
    return os.getenv(
        "GOOGLE_DRIVE_WORKFLOW_KICKER_URL",
        "https://google-drive-workflow-kicker-mdgjayj74q-uc.a.run.app",
    ).rstrip("/")


GOOGLE_DRIVE_SYNC_OPERATION_TYPES = ("syncFolder", "syncSingleFolder")
LEGACY_BATCH_OPERATION_TYPES = ("syncFolderBatch", "syncFolderBatchRemove")


def _extract_event_info(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> dict:
    if isinstance(event.data, firestore_fn.Change):
        snap = event.data.after
    else:
        snap = event.data
    if snap is None:
        return {"docData": None, "docId": None, "collectionFullPath": None}
    doc_data = snap.to_dict() or {}
    full_path = snap.reference.path
    parts = full_path.split("/")
    collection_full_path = "/".join(parts[:-1])
    return {
        "docData": doc_data,
        "docId": snap.id,
        "collectionFullPath": collection_full_path,
        "fullPath": full_path,
    }


def _extract_org_id(path: str) -> str:
    m = re.search(r"organizations/([^/]+)/", path)
    return m.group(1) if m else ""


def _update_document(collection_name: str, document_id: str, data: dict) -> None:
    payload = {**data, "updatedAt": firestore.SERVER_TIMESTAMP}
    db.collection(collection_name).document(document_id).update(payload)


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "googleDriveSyncRequests/logs/{requestId}"
    ),
    memory=512,
    # Workflow Kicker が 202 を即返すため 60s で十分。
    timeout_sec=60,
)
def google_drive_sync_request_handler(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    """googleDriveSyncRequests Doc 作成時にトリガーされ、kicker を呼んで終わる"""
    print("google_drive_sync_request_handler triggered 🚀")

    info = _extract_event_info(event)
    fields = info.get("docData") or {}
    request_id = info.get("docId")
    collection_full_path = info.get("collectionFullPath")
    full_path = info.get("fullPath")
    if not fields or not request_id or not collection_full_path or not full_path:
        print("google_drive_sync_request_handler: missing fields; skipping")
        return

    input_data = fields.get("input", {}) or {}
    operation_type = input_data.get("operationType")

    if operation_type in LEGACY_BATCH_OPERATION_TYPES:
        error_msg = (
            f"Deprecated operationType '{operation_type}'. "
            "FE must emit only syncFolder / syncSingleFolder under the "
            "Workflows architecture."
        )
        print(f"ERROR: {error_msg}")
        _update_document(
            collection_full_path,
            request_id,
            {"status": "error", "errorMessage": error_msg},
        )
        return
    if operation_type not in GOOGLE_DRIVE_SYNC_OPERATION_TYPES:
        error_msg = f"Unknown operationType: {operation_type}"
        print(f"ERROR: {error_msg}")
        _update_document(
            collection_full_path,
            request_id,
            {"status": "error", "errorMessage": error_msg},
        )
        return

    # _kickerPayload は FE が importIds/removeIds を一時的に同居させた中間データ。
    # kicker は使い終わったらフィールドを消す責務がある。
    kicker_payload = fields.get("_kickerPayload") or {}

    operation_metadata = fields.get("operationMetadata") or {}
    body = {
        "requestPath": full_path,
        "requestId": request_id,
        "operationType": operation_type,
        "input": {
            "operationType": operation_type,
            "connectionId": input_data.get("connectionId"),
            "rootFolderId": input_data.get("rootFolderId"),
            "rootFolderResourceKey": input_data.get("rootFolderResourceKey"),
            "targetFolderId": input_data.get("targetFolderId"),
            "fileSpaceId": input_data.get("fileSpaceId"),
            "description": input_data.get("description"),
            "importIds": kicker_payload.get("importIds") or [],
            "removeIds": kicker_payload.get("removeIds") or [],
        },
        "operationMetadata": operation_metadata,
        "organizationId": _extract_org_id(full_path),
    }

    url = f"{_resolve_kicker_url()}/kick"
    print(f"Calling Drive Workflow Kicker: {url}")
    try:
        response = requests.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=50,
        )
    except requests.RequestException as e:
        error_msg = f"workflow-kicker HTTP error: {e}"
        print(f"ERROR: {error_msg}")
        _update_document(
            collection_full_path,
            request_id,
            {"status": "error", "errorMessage": error_msg},
        )
        return

    if response.status_code >= 400:
        snippet = response.text[:500] if response is not None else ""
        error_msg = (
            f"workflow-kicker returned {response.status_code}: {snippet}"
        )
        print(f"ERROR: {error_msg}")
        _update_document(
            collection_full_path,
            request_id,
            {"status": "error", "errorMessage": error_msg},
        )
        return

    # 202 accepted を期待。kicker 自身が RequestDoc を patch するので、
    # ここで追加更新する必要はほぼ無い。
    print(
        "google_drive_sync_request_handler: "
        f"kicker accepted (status={response.status_code})"
    )
