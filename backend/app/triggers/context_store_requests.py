"""
Context Store Request Trigger

Firestore の contextStoreRequests/logs/{requestId} を Cloud Run の
context-store microservice に配送し、RequestDoc に結果を書き戻す。
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any

import requests
from firebase_functions import firestore_fn
from google.cloud import firestore
from lib.context_store_request_router import (
    UnsupportedOperationError,
    build_context_store_service_call,
    normalize_context_store_output,
)


db = firestore.Client()


def _context_store_service_url() -> str:
    return (os.getenv("CONTEXT_STORE_SERVICE_URL") or "").strip().rstrip("/")


def _collection_path(snapshot: firestore.DocumentSnapshot) -> str:
    return "/".join(snapshot.reference.path.split("/")[:-1])


def _append_log(
    collection_path: str,
    request_id: str,
    message: str,
    log_type: str = "info",
) -> None:
    db.collection(collection_path).document(request_id).update(
        {
            "logs": firestore.ArrayUnion(
                [
                    {
                        "timestamp": datetime.utcnow(),
                        "message": message,
                        "type": log_type,
                    }
                ]
            ),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )


def _update_status(
    collection_path: str,
    request_id: str,
    status: str,
    *,
    output: dict[str, Any] | None = None,
    error_message: str | None = None,
    microservice_payload: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if output is not None:
        payload["output"] = output
    if error_message is not None:
        payload["errorMessage"] = error_message
    if microservice_payload is not None:
        payload["microServicePayload"] = microservice_payload
    db.collection(collection_path).document(request_id).update(payload)


def _extract_file_space_id(output: dict[str, Any]) -> str:
    name = output.get("name")
    if not isinstance(name, str) or not name.strip():
        return ""
    parts = [part for part in name.split("/") if part]
    return parts[-1] if parts else ""


def _persist_file_space(
    *,
    organization_id: str,
    space_id: str,
    request_fields: dict[str, Any],
    output: dict[str, Any],
) -> None:
    file_space_id = _extract_file_space_id(output)
    if not file_space_id:
        return

    input_data = request_fields.get("input") or {}
    now = datetime.utcnow()
    doc_data = {
        "name": output.get("name"),
        "agentSearchDatastorePath": output.get("agentSearchDatastorePath")
        or output.get("name"),
        "indexBackend": output.get("indexBackend") or "agent_search",
        "displayName": input_data.get("displayName") or output.get("displayName"),
        "description": input_data.get("description"),
        "createTime": output.get("createTime") or now.isoformat(),
        "updateTime": output.get("updateTime") or now.isoformat(),
        "fileSpaceType": input_data.get("fileSpaceType") or "manual",
        "organizationId": organization_id,
        "spaceId": space_id,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    db.collection(
        f"organizations/{organization_id}/spaces/{space_id}/fileSpaces"
    ).document(file_space_id).set(doc_data, merge=True)


def _parse_error_message(response: requests.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text[:500]
    error = data.get("error") if isinstance(data, dict) else None
    if isinstance(error, dict) and error.get("message"):
        return str(error["message"])
    if isinstance(data, dict) and data.get("message"):
        return str(data["message"])
    return response.text[:500]


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/"
        "requests/contextStoreRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=540,
)
def on_context_store_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    """contextStoreRequests Doc 作成時に context-store を呼び出す。"""
    print("on_context_store_request_created triggered")

    if event.data is None:
        print("event.data is None; skipping")
        return

    fields = event.data.to_dict() or {}
    request_id = event.data.id
    collection_full_path = _collection_path(event.data)
    operation_type = (fields.get("input") or {}).get("operationType")
    if fields.get("status") not in (None, "", "pending"):
        print(f"Request {request_id} is already {fields.get('status')}; skipping")
        return

    service_url = _context_store_service_url()
    if not service_url:
        message = "CONTEXT_STORE_SERVICE_URL is not configured"
        print(f"ERROR: {message}")
        _update_status(
            collection_full_path,
            request_id,
            "error",
            error_message=message,
        )
        _append_log(collection_full_path, request_id, message, "error")
        return

    try:
        method, endpoint, body = build_context_store_service_call(
            request_id=request_id,
            fields=fields,
        )
    except UnsupportedOperationError as exc:
        message = str(exc)
        print(f"ERROR: {message}")
        _update_status(
            collection_full_path,
            request_id,
            "error",
            error_message=message,
        )
        _append_log(collection_full_path, request_id, message, "error")
        return

    url = f"{service_url}{endpoint}"
    microservice_payload = {
        "name": "context-store",
        "endpoint": endpoint,
        "payload": body,
    }
    _update_status(
        collection_full_path,
        request_id,
        "processing",
        microservice_payload=microservice_payload,
    )
    _append_log(
        collection_full_path,
        request_id,
        f"context-storeへ配送しました: {endpoint}",
    )

    try:
        response = requests.request(
            method,
            url,
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=500,
        )
    except requests.RequestException as exc:
        message = f"context-store HTTP error: {exc}"
        print(f"ERROR: {message}")
        _update_status(
            collection_full_path,
            request_id,
            "error",
            error_message=message,
        )
        _append_log(collection_full_path, request_id, message, "error")
        return

    if response.status_code >= 400:
        message = (
            f"context-store returned {response.status_code}: "
            f"{_parse_error_message(response)}"
        )
        print(f"ERROR: {message}")
        _update_status(
            collection_full_path,
            request_id,
            "error",
            error_message=message,
        )
        _append_log(collection_full_path, request_id, message, "error")
        return

    try:
        response_data = response.json()
    except ValueError:
        message = "context-store returned invalid JSON"
        print(f"ERROR: {message}")
        _update_status(
            collection_full_path,
            request_id,
            "error",
            error_message=message,
        )
        _append_log(collection_full_path, request_id, message, "error")
        return

    if response_data.get("status") != "success":
        error = response_data.get("error") or {}
        message = error.get("message") if isinstance(error, dict) else None
        message = message or "context-store returned non-success response"
        print(f"ERROR: {message}")
        _update_status(
            collection_full_path,
            request_id,
            "error",
            error_message=message,
        )
        _append_log(collection_full_path, request_id, message, "error")
        return

    output = normalize_context_store_output(
        operation_type, response_data.get("output") or {}
    )
    if operation_type == "fileSpaceCreate":
        _persist_file_space(
            organization_id=event.params.get("organizationId", ""),
            space_id=event.params.get("spaceId", ""),
            request_fields=fields,
            output=output,
        )

    _update_status(
        collection_full_path,
        request_id,
        "completed",
        output=output,
        microservice_payload=microservice_payload,
    )
    _append_log(collection_full_path, request_id, "context-store処理が完了しました")
