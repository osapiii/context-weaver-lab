"""
Web Crawl Request Trigger (Workflows architecture)

Firestore で webCrawlRequests/logs/{requestId} が作成されたら、
web-crawl-workflow-kicker microservice に POST /kick して即終了する。

- kicker が input artifact を GCS に PUT し `web-crawl` Workflow を起動
- 進捗は Workflow が RequestDoc に書き戻す (UI は 1 doc を購読)
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
        "WEB_CRAWL_WORKFLOW_KICKER_URL",
        "https://web-crawl-workflow-kicker-wsqdguu4pq-uc.a.run.app",
    ).rstrip("/")


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
        "organizations/{organizationId}/requests/webCrawlRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=60,
)
def web_crawl_request_handler(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    """webCrawlRequests Doc 作成時に kicker を呼んで終わる"""
    print("web_crawl_request_handler triggered 🚀")

    info = _extract_event_info(event)
    fields = info.get("docData") or {}
    request_id = info.get("docId")
    collection_full_path = info.get("collectionFullPath")
    full_path = info.get("fullPath")
    if not fields or not request_id or not collection_full_path or not full_path:
        print("web_crawl_request_handler: missing fields; skipping")
        return

    input_data = fields.get("input", {}) or {}
    operation_metadata = fields.get("operationMetadata") or {}

    body = {
        "requestPath": full_path,
        "requestId": request_id,
        "input": {
            "url": input_data.get("url"),
            "bucketName": input_data.get("bucketName"),
            "folderPath": input_data.get("folderPath"),
            "maxDepth": input_data.get("maxDepth", 1),
            "maxUrls": input_data.get("maxUrls", 100),
            "fileSpaceId": input_data.get("fileSpaceId"),
            "description": input_data.get("description"),
            "includeImages": input_data.get("includeImages", True),
        },
        "operationMetadata": operation_metadata,
        "organizationId": _extract_org_id(full_path),
    }

    url = f"{_resolve_kicker_url()}/kick"
    print(f"Calling Web Crawl Workflow Kicker: {url}")
    try:
        response = requests.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=50,
        )
    except requests.RequestException as e:
        error_msg = f"web-crawl-workflow-kicker HTTP error: {e}"
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
            f"web-crawl-workflow-kicker returned {response.status_code}: {snippet}"
        )
        print(f"ERROR: {error_msg}")
        _update_document(
            collection_full_path,
            request_id,
            {"status": "error", "errorMessage": error_msg},
        )
        return

    print(
        "web_crawl_request_handler: "
        f"kicker accepted (status={response.status_code})"
    )
