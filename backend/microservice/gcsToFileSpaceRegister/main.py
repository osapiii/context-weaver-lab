"""
GCS → FileSpace Register Microservice (Cloud Run)

Responsibilities (called by GCP Workflows `gdrive-sync`):

  POST /register/diff           : GCS mirror inventory と Firestore documents の差分計算
  POST /register/apply-batch    : 最大 10 件、mirror から context-store に import + Firestore upsert
  POST /register/remove-batch   : 最大 10 件、context-store document delete + Firestore delete

このサービスは RequestDoc には触らない (Workflow 側が patch する).
mirror bytes は Firebase Storage の knowledges/driveSync プレフィックス
(drive-to-gcs-sync が書き込み、本サービスが読み取り)。

Firestore documents path:
  organizations/{orgId}/spaces/{spaceId}/fileSpaces/{fileSpaceId}/documents/drive_{driveFileId}
"""

from __future__ import annotations

import os
import traceback
from datetime import datetime
from typing import Any

import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.cloud import firestore, storage

from knowledge_storage_paths import (
    build_mirror_inventory_entry,
    drive_sync_mirror_list_prefix,
    parse_drive_sync_mirror_blob,
    resolve_knowledge_storage_bucket,
)

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "en-aistudio-development")
MIRROR_BUCKET = resolve_knowledge_storage_bucket(PROJECT_ID)
CONTEXT_STORE_SERVICE_URL = os.getenv(
    "CONTEXT_STORE_SERVICE_URL",
    "https://context-store-wsqdguu4pq-uc.a.run.app",
).rstrip("/")
IMPORT_TIMEOUT_SEC = float(os.getenv("CONTEXT_STORE_IMPORT_TIMEOUT_SEC", "180"))
DELETE_TIMEOUT_SEC = float(os.getenv("CONTEXT_STORE_DELETE_TIMEOUT_SEC", "60"))


def _resolve_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if not raw:
        return [
            "http://localhost:3000",
            "https://en-aistudio.app",
            "https://en-aistudio-development.web.app",
            "https://en-aistudio-development.firebaseapp.com",
        ]
    if raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="gcs-to-filespace-register")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=600,
)


_db_client: firestore.Client | None = None
_storage_client: storage.Client | None = None


def _get_db() -> firestore.Client:
    global _db_client
    if _db_client is None:
        _db_client = firestore.Client(project=PROJECT_ID)
    return _db_client


def _get_storage() -> storage.Client:
    global _storage_client
    if _storage_client is None:
        _storage_client = storage.Client(project=PROJECT_ID)
    return _storage_client


def _ok(payload: dict[str, Any]) -> JSONResponse:
    return JSONResponse(status_code=200, content=payload)


def _err(status: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"status": "error", "error": {"message": message}},
    )


def _documents_path(
    organization_id: str, space_id: str, file_space_id: str
) -> str:
    return (
        f"organizations/{organization_id}/spaces/{space_id}/"
        f"fileSpaces/{file_space_id}/documents"
    )


def _doc_id_for(drive_file_id: str) -> str:
    return f"drive_{drive_file_id}"


# -----------------------------------------------------------------------------
# Mirror inventory (re-built locally; drive-to-gcs-sync also exposes this)
# -----------------------------------------------------------------------------


def _list_mirror_inventory(
    *,
    bucket: str,
    organization_id: str,
    space_id: str,
    file_space_id: str,
) -> dict[str, list[dict[str, Any]]]:
    """{driveFileId: [{objectPath, driveModifiedTime, size, contentType}]}"""
    prefix = drive_sync_mirror_list_prefix(
        organization_id=organization_id,
        space_id=space_id,
        file_space_id=file_space_id,
    )
    out: dict[str, list[dict[str, Any]]] = {}
    client = _get_storage()
    for blob in client.list_blobs(bucket, prefix=prefix):
        name = blob.name or ""
        parsed = parse_drive_sync_mirror_blob(blob_name=name, list_prefix=prefix)
        if parsed is None:
            continue
        drive_file_id, original_ts = parsed
        entry = build_mirror_inventory_entry(
            blob_name=name,
            drive_modified_time=original_ts,
            size=blob.size,
            content_type=blob.content_type,
            metadata=dict(blob.metadata or {}),
        )
        out.setdefault(drive_file_id, []).append(entry)
    return out


def _list_existing_documents(
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
) -> dict[str, dict[str, Any]]:
    """{driveFileId: {firestoreDocId, name, driveModifiedTime, bucketName, filePath}}"""
    path = _documents_path(organization_id, space_id, file_space_id)
    out: dict[str, dict[str, Any]] = {}
    for snap in _get_db().collection(path).stream():
        data = snap.to_dict() or {}
        drive_id = data.get("driveFileId")
        if not drive_id:
            continue
        out[drive_id] = {
            "firestoreDocId": snap.id,
            "name": data.get("name"),
            "agentSearchDocumentId": data.get("agentSearchDocumentId"),
            "driveModifiedTime": data.get("driveModifiedTime"),
            "bucketName": data.get("bucketName"),
            "filePath": data.get("filePath"),
            "mimeType": data.get("mimeType"),
        }
    return out


def _pick_latest(entries: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not entries:
        return None
    return max(entries, key=lambda e: e.get("driveModifiedTime") or "")


# -----------------------------------------------------------------------------
# /register/diff
# -----------------------------------------------------------------------------


@app.post("/register/diff")
async def register_diff_endpoint(request: Request) -> JSONResponse:
    """
    GCS mirror inventory と Firestore documents を突き合わせて
    {toAdd, toUpdate, toRemove} を返す。

    body: {
      "organizationId": str,
      "spaceId": str,
      "fileSpaceId": str,
      "operationType": "syncFolder" | "syncSingleFolder",
      "targetFolderId": str | None,    # 同期スコープ
    }

    returns: {
      "toAdd":    [ { driveFileId, mirrorObjectPath, driveModifiedTime, contentType, metadata } ],
      "toUpdate": [ { driveFileId, mirrorObjectPath, ..., existing: {firestoreDocId, name} } ],
      "toRemove": [ { firestoreDocId, driveFileId, name, bucketName, filePath } ],
      "unchanged": [...],
      "counts": { ... },
    }
    """
    try:
        body = await request.json()
    except Exception as exc:
        return _err(400, f"Invalid JSON body: {exc}")

    organization_id = (body or {}).get("organizationId") or ""
    space_id = (body or {}).get("spaceId") or ""
    file_space_id = (body or {}).get("fileSpaceId") or ""
    operation_type = (body or {}).get("operationType") or "syncFolder"

    if not organization_id or not space_id or not file_space_id:
        return _err(
            400,
            "organizationId, spaceId, fileSpaceId are required for diff",
        )

    try:
        mirror_inventory = _list_mirror_inventory(
            bucket=MIRROR_BUCKET,
            organization_id=organization_id,
            space_id=space_id,
            file_space_id=file_space_id,
        )
    except Exception as exc:
        traceback.print_exc()
        return _err(500, f"mirror inventory failed: {exc}")

    try:
        existing = _list_existing_documents(
            organization_id=organization_id,
            space_id=space_id,
            file_space_id=file_space_id,
        )
    except Exception as exc:
        traceback.print_exc()
        return _err(500, f"firestore inventory failed: {exc}")

    to_add: list[dict[str, Any]] = []
    to_update: list[dict[str, Any]] = []
    unchanged: list[dict[str, Any]] = []
    to_remove: list[dict[str, Any]] = []

    for drive_id, entries in mirror_inventory.items():
        latest = _pick_latest(entries)
        if latest is None:
            continue
        payload = {
            "driveFileId": drive_id,
            "mirrorObjectPath": latest.get("objectPath"),
            "driveModifiedTime": latest.get("driveModifiedTime"),
            "contentType": latest.get("contentType"),
            "metadata": latest.get("metadata") or {},
            "size": latest.get("size"),
        }
        exists = existing.get(drive_id)
        if exists is None:
            to_add.append(payload)
        elif (exists.get("driveModifiedTime") or "") < (
            latest.get("driveModifiedTime") or ""
        ):
            payload2 = dict(payload)
            payload2["existing"] = exists
            to_update.append(payload2)
        else:
            unchanged.append(payload)

    if operation_type == "syncFolder":
        for drive_id, exists in existing.items():
            if drive_id not in mirror_inventory:
                to_remove.append(
                    {
                        "firestoreDocId": exists.get("firestoreDocId"),
                        "driveFileId": drive_id,
                        "name": exists.get("name"),
                        "agentSearchDocumentId": exists.get("agentSearchDocumentId"),
                        "bucketName": exists.get("bucketName"),
                        "filePath": exists.get("filePath"),
                    }
                )

    return _ok(
        {
            "toAdd": to_add,
            "toUpdate": to_update,
            "toRemove": to_remove,
            "unchanged": unchanged,
            "counts": {
                "toAdd": len(to_add),
                "toUpdate": len(to_update),
                "toRemove": len(to_remove),
                "unchanged": len(unchanged),
            },
        }
    )


# -----------------------------------------------------------------------------
# /register/apply-batch
# -----------------------------------------------------------------------------


def _context_store_import(
    *,
    file_space_id: str,
    bucket_name: str,
    object_path: str,
    operation_metadata: dict[str, Any],
    request_id: str,
    document_id: str | None = None,
    struct_data: dict[str, Any] | None = None,
) -> tuple[str | None, str | None]:
    """context-store /import を呼んで agentSearchDocumentId を返す."""
    url = f"{CONTEXT_STORE_SERVICE_URL}/context-store/{file_space_id}/upload"
    input_payload: dict[str, Any] = {
        "bucket_name": bucket_name,
        "file_path": object_path,
    }
    if document_id:
        input_payload["document_id"] = document_id
    if struct_data:
        input_payload["custom_metadata"] = [
            {"key": key, "stringValue": str(value)}
            for key, value in struct_data.items()
            if value is not None and str(value).strip()
        ]
    payload = {
        "request_id": request_id,
        "input": input_payload,
        "operation_metadata": operation_metadata,
    }
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=IMPORT_TIMEOUT_SEC,
        )
    except requests.RequestException as exc:
        return None, f"http error: {exc}"
    if resp.status_code >= 400:
        return None, f"HTTP {resp.status_code}: {resp.text[:300]}"
    body = resp.json() or {}
    output = body.get("output") or {}
    response = output.get("response") if isinstance(output, dict) else None
    doc_id = None
    if isinstance(response, dict):
        doc_id = response.get("agentSearchDocumentId") or response.get("id")
    return doc_id or document_id, None


def _context_store_delete(
    *,
    file_space_id: str,
    document_id: str | None,
    operation_metadata: dict[str, Any],
    request_id: str,
) -> tuple[bool, str | None]:
    if not document_id:
        return True, None
    url = (
        f"{CONTEXT_STORE_SERVICE_URL}/context-store/"
        f"{file_space_id}/documents/{document_id}/delete"
    )
    payload = {
        "request_id": request_id,
        "input": {"force": True},
        "operation_metadata": operation_metadata,
    }
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=DELETE_TIMEOUT_SEC,
        )
    except requests.RequestException as exc:
        return False, f"http error: {exc}"
    if resp.status_code >= 400:
        return False, f"HTTP {resp.status_code}: {resp.text[:300]}"
    return True, None


def _upsert_document(
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
    drive_file_id: str,
    agent_search_document_id: str,
    mirror_object_path: str,
    drive_modified_time: str | None,
    content_type: str | None,
    metadata: dict[str, Any],
    target_folder_id: str | None,
) -> None:
    drive_meta = metadata or {}
    drive_name = drive_meta.get("driveOriginalName") or f"drive_{drive_file_id}"
    drive_mime = drive_meta.get("driveOriginalMime") or content_type or ""
    now_iso = datetime.utcnow().isoformat() + "Z"
    now_dt = datetime.utcnow()
    doc_data = {
        "name": (
            f"fileSearchStores/{file_space_id}/documents/"
            f"{agent_search_document_id}"
        ),
        "agentSearchDocumentId": agent_search_document_id,
        "indexBackend": "agent_search",
        "registration": {
            "stage": "indexed",
            "gcsUploaded": True,
            "geminiRegistered": True,
        },
        "displayName": drive_name,
        "description": f"Drive ファイル: {drive_name}",
        "createTime": now_iso,
        "updateTime": now_iso,
        "state": "STATE_ACTIVE",
        "subCategory": "fileUpload",
        "bucketName": MIRROR_BUCKET,
        "filePath": mirror_object_path,
        "mimeType": drive_mime,
        "status": "connected",
        "storeId": file_space_id,
        "organizationId": organization_id,
        "spaceId": space_id,
        "createdAt": now_dt,
        "updatedAt": now_dt,
        "driveFileId": drive_file_id,
        "driveFolderId": target_folder_id,
        "driveModifiedTime": drive_modified_time,
    }
    path = _documents_path(organization_id, space_id, file_space_id)
    _get_db().collection(path).document(_doc_id_for(drive_file_id)).set(
        doc_data, merge=True
    )


@app.post("/register/apply-batch")
async def register_apply_batch_endpoint(request: Request) -> JSONResponse:
    """
    最大 10 件、mirror item を FileSpace に登録 + Firestore upsert。

    body: {
      "organizationId": str,
      "spaceId": str,
      "fileSpaceId": str,
      "targetFolderId": str | None,
      "requestId": str,
      "operationMetadata": { ... pass-through to gemini-file-search ... },
      "items": [
        {
          "driveFileId": str,
          "mirrorObjectPath": str,         # gcs object name (without bucket)
          "driveModifiedTime": str,
          "contentType": str | None,
          "metadata": { ... },              # GCS object metadata
          "existing": { firestoreDocId, name } | None,   # 更新時に必要
        }
      ]
    }

    returns: {
      "results": [ { ok, driveFileId, documentName, error? } ],
      "added": int, "updated": int, "failed": int,
      "failures": [ { driveFileId, reason } ],
    }
    """
    try:
        body = await request.json()
    except Exception as exc:
        return _err(400, f"Invalid JSON body: {exc}")

    organization_id = (body or {}).get("organizationId") or ""
    space_id = (body or {}).get("spaceId") or ""
    file_space_id = (body or {}).get("fileSpaceId") or ""
    target_folder_id = (body or {}).get("targetFolderId")
    request_id = (body or {}).get("requestId") or "register-batch"
    operation_metadata = (body or {}).get("operationMetadata") or {}
    items: list[dict[str, Any]] = (body or {}).get("items") or []

    if not organization_id or not space_id or not file_space_id:
        return _err(
            400,
            "organizationId, spaceId, fileSpaceId are required",
        )
    if len(items) > 10:
        return _err(400, f"items must be <= 10, got {len(items)}")

    results: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    added = 0
    updated = 0

    for it in items:
        drive_id = it.get("driveFileId")
        object_path = it.get("mirrorObjectPath")
        if not drive_id or not object_path:
            failures.append(
                {
                    "driveFileId": drive_id,
                    "reason": "driveFileId and mirrorObjectPath are required",
                }
            )
            results.append(
                {
                    "ok": False,
                    "driveFileId": drive_id,
                    "error": "driveFileId and mirrorObjectPath are required",
                }
            )
            continue

        existing = it.get("existing") or None
        firestore_doc_id = _doc_id_for(drive_id)
        if existing:
            old_agent_doc_id = existing.get("agentSearchDocumentId")
            if old_agent_doc_id:
                _context_store_delete(
                    file_space_id=file_space_id,
                    document_id=old_agent_doc_id,
                    operation_metadata=operation_metadata,
                    request_id=f"{request_id}_delete_{drive_id}",
                )

        agent_doc_id, err = _context_store_import(
            file_space_id=file_space_id,
            bucket_name=MIRROR_BUCKET,
            object_path=object_path,
            operation_metadata=operation_metadata,
            request_id=f"{request_id}_upload_{drive_id}",
            document_id=firestore_doc_id,
            struct_data={
                "firestoreDocId": firestore_doc_id,
                "gcsUri": f"gs://{MIRROR_BUCKET}/{object_path}",
                "filePath": object_path,
                "driveFileId": drive_id,
                "subCategory": "driveSync",
            },
        )
        if not agent_doc_id:
            failures.append(
                {
                    "driveFileId": drive_id,
                    "reason": err or "context store import failed",
                }
            )
            results.append(
                {
                    "ok": False,
                    "driveFileId": drive_id,
                    "error": err or "context store import failed",
                }
            )
            continue

        try:
            _upsert_document(
                organization_id=organization_id,
                space_id=space_id,
                file_space_id=file_space_id,
                drive_file_id=drive_id,
                agent_search_document_id=agent_doc_id,
                mirror_object_path=object_path,
                drive_modified_time=it.get("driveModifiedTime"),
                content_type=it.get("contentType"),
                metadata=it.get("metadata") or {},
                target_folder_id=target_folder_id,
            )
        except Exception as exc:
            traceback.print_exc()
            failures.append(
                {
                    "driveFileId": drive_id,
                    "reason": f"firestore upsert failed: {exc}",
                }
            )
            results.append(
                {
                    "ok": False,
                    "driveFileId": drive_id,
                    "error": f"firestore upsert failed: {exc}",
                    "agentSearchDocumentId": agent_doc_id,
                }
            )
            continue

        if existing:
            updated += 1
        else:
            added += 1
        results.append(
            {
                "ok": True,
                "driveFileId": drive_id,
                "agentSearchDocumentId": agent_doc_id,
            }
        )

    return _ok(
        {
            "results": results,
            "added": added,
            "updated": updated,
            "failed": len(failures),
            "failures": failures,
        }
    )


# -----------------------------------------------------------------------------
# /register/remove-batch
# -----------------------------------------------------------------------------


@app.post("/register/remove-batch")
async def register_remove_batch_endpoint(request: Request) -> JSONResponse:
    """
    最大 10 件、FileSpace から削除 (Agent Search + Firestore).

    body: {
      "organizationId": str,
      "spaceId": str,
      "fileSpaceId": str,
      "requestId": str,
      "operationMetadata": { ... },
      "items": [
        {
          "driveFileId": str,
          "firestoreDocId": str,
          "agentSearchDocumentId": str | None,
          "name": str | None,
        }
      ]
    }

    returns: {
      "results": [ { ok, driveFileId, error? } ],
      "removed": int, "failed": int,
      "failures": [ ... ],
    }
    """
    try:
        body = await request.json()
    except Exception as exc:
        return _err(400, f"Invalid JSON body: {exc}")

    organization_id = (body or {}).get("organizationId") or ""
    space_id = (body or {}).get("spaceId") or ""
    file_space_id = (body or {}).get("fileSpaceId") or ""
    request_id = (body or {}).get("requestId") or "register-remove"
    operation_metadata = (body or {}).get("operationMetadata") or {}
    items: list[dict[str, Any]] = (body or {}).get("items") or []

    if not organization_id or not space_id or not file_space_id:
        return _err(
            400,
            "organizationId, spaceId, fileSpaceId are required",
        )
    if len(items) > 10:
        return _err(400, f"items must be <= 10, got {len(items)}")

    results: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    removed = 0

    for it in items:
        drive_id = it.get("driveFileId")
        firestore_doc_id = it.get("firestoreDocId") or (
            _doc_id_for(drive_id) if drive_id else None
        )
        if not firestore_doc_id:
            failures.append(
                {
                    "driveFileId": drive_id,
                    "reason": "firestoreDocId or driveFileId is required",
                }
            )
            results.append(
                {
                    "ok": False,
                    "driveFileId": drive_id,
                    "error": "firestoreDocId or driveFileId is required",
                }
            )
            continue
        agent_doc_id = it.get("agentSearchDocumentId") or firestore_doc_id
        ok, err = _context_store_delete(
            file_space_id=file_space_id,
            document_id=agent_doc_id,
            operation_metadata=operation_metadata,
            request_id=f"{request_id}_delete_{firestore_doc_id}",
        )
        if not ok:
            print(
                f"[remove-batch] context store delete failed (continuing): {err}"
            )

        try:
            path = _documents_path(organization_id, space_id, file_space_id)
            _get_db().collection(path).document(firestore_doc_id).delete()
            removed += 1
            results.append({"ok": True, "driveFileId": drive_id})
        except Exception as exc:
            traceback.print_exc()
            err = f"firestore delete failed: {exc}"
            failures.append({"driveFileId": drive_id, "reason": err})
            results.append(
                {"ok": False, "driveFileId": drive_id, "error": err}
            )

    return _ok(
        {
            "results": results,
            "removed": removed,
            "failed": len(failures),
            "failures": failures,
        }
    )


@app.get("/health")
async def health() -> JSONResponse:
    return _ok(
        {
            "status": "healthy",
            "service": "gcs-to-filespace-register",
            "project": PROJECT_ID,
            "mirrorBucket": MIRROR_BUCKET,
            "contextStoreUrl": CONTEXT_STORE_SERVICE_URL,
        }
    )
