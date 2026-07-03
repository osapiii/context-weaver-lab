"""
Drive → GCS Sync Microservice (Cloud Run)

Responsibilities (called by GCP Workflows `gdrive-sync`):

  POST /scan/list-folder        : Drive 上のフォルダ再帰列挙 (Workflow input or rootFolder)
  POST /scan/test-connection    : root folder への SA アクセス確認 (FE 動作確認用)
  POST /mirror/diff             : Drive list と GCS mirror inventory の差分計算
  POST /mirror/apply-batch      : Drive から download → GCS mirror へ最大 10 件 upload
  POST /mirror/remove-batch     : GCS mirror から最大 10 件削除

このサービスは Workflow から HTTP で呼ばれる前提で、各 endpoint は同期的に完了する
(retry / step status patch は Workflow 側の責務)。RequestDoc には触らない。

依存:
  - Google Drive SA 鍵 (Secret Manager 経由で /etc/sa/drive-agent-key.json)
  - Firebase Storage bucket (default gs://{project}.firebasestorage.app)

mirror パス規約 (manual uploads の knowledges/manual_upload と同バケット):
  organizations/{orgId}/spaces/{spaceId}/fileSpaces/{fileSpaceId}/knowledges/driveSync/{driveFileId}/{ts}{ext}
"""

from __future__ import annotations

import hashlib
import os
import ssl
import traceback
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.cloud import firestore
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from drive_client import (
    DRIVE_FOLDER_MIME_TYPE,
    download_file,
    list_files,
    test_connection,
)
from knowledge_storage_paths import resolve_knowledge_storage_bucket
from gcs_mirror import (
    DEFAULT_MIRROR_EXT,
    GOOGLE_WORKSPACE_EXPORT_EXT,
    apply_batch,
    delete_batch,
    list_mirror_inventory,
    mirror_object_path,
    mirror_prefix,
)

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "en-aistudio-development")
MIRROR_BUCKET = resolve_knowledge_storage_bucket(PROJECT_ID)
TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_READONLY_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def _resolve_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if not raw:
        return [
            "http://localhost:3000",
            "https://storyvault-dev.web.app",
            "https://storyvault-dev.firebaseapp.com",
            "https://en-aistudio.app",
            "https://en-aistudio-development.web.app",
            "https://en-aistudio-development.firebaseapp.com",
        ]
    if raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="drive-to-gcs-sync")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=600,
)

_db_client: firestore.Client | None = None


def _get_db() -> firestore.Client:
    global _db_client
    if _db_client is None:
        _db_client = firestore.Client(project=PROJECT_ID)
    return _db_client


def _oauth_client_id() -> str:
    return os.getenv("GOOGLE_WORKSPACE_OAUTH_CLIENT_ID", "").strip()


def _oauth_client_secret() -> str:
    return os.getenv("GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET", "").strip()


def _fernet() -> Fernet | None:
    raw = os.getenv("GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY", "").strip()
    if not raw:
        return None
    try:
        return Fernet(raw.encode("utf-8"))
    except Exception:
        return None


def _unprotect_token(payload: Any) -> str:
    if isinstance(payload, str):
        return payload
    if not isinstance(payload, dict):
        return ""
    value = str(payload.get("value") or "")
    if payload.get("mode") != "fernet":
        return value
    f = _fernet()
    if not f:
        raise RuntimeError("GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY is required")
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Stored Google Workspace token cannot be decrypted") from exc


def _connection_ref(organization_id: str, user_id: str) -> firestore.DocumentReference:
    return (
        _get_db()
        .collection("organizations")
        .document(organization_id)
        .collection("externalServiceConfigs")
        .document("googleWorkspaceOAuth")
        .collection("users")
        .document(user_id)
    )


def _operation_metadata_from_body(body: dict[str, Any]) -> dict[str, Any]:
    metadata = body.get("operationMetadata") or {}
    if isinstance(metadata, dict):
        return metadata
    items = body.get("items") or []
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and isinstance(item.get("operationMetadata"), dict):
                return item["operationMetadata"]
    return {}


def _drive_service_from_operation_metadata(operation_metadata: dict[str, Any]):
    organization_id = str(operation_metadata.get("organizationId") or "").strip()
    requested_by = operation_metadata.get("requestedBy") or {}
    user_id = str(requested_by.get("userId") or "").strip()
    if not organization_id or not user_id:
        raise RuntimeError(
            "operationMetadata.organizationId and requestedBy.userId are required"
        )

    client_id = _oauth_client_id()
    client_secret = _oauth_client_secret()
    if not client_id or not client_secret:
        raise RuntimeError(
            "Google Workspace OAuth client is not configured for drive-to-gcs-sync"
        )

    snap = _connection_ref(organization_id, user_id).get()
    if not snap.exists:
        raise RuntimeError(
            "Google Workspace が未接続です。Google アカウントを接続してください。"
        )
    doc = snap.to_dict() or {}
    refresh_token = _unprotect_token(doc.get("refreshToken"))
    if not refresh_token:
        raise RuntimeError("Google Workspace refresh token is missing")

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=TOKEN_URL,
        client_id=client_id,
        client_secret=client_secret,
        scopes=DRIVE_READONLY_SCOPES,
    )
    creds.refresh(GoogleAuthRequest())
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _drive_service_from_body(body: dict[str, Any]):
    metadata = _operation_metadata_from_body(body)
    if not metadata:
        raise RuntimeError("operationMetadata is required for Google Drive OAuth")
    return _drive_service_from_operation_metadata(metadata)


def _ok(payload: dict[str, Any]) -> JSONResponse:
    return JSONResponse(status_code=200, content=payload)


def _err(status: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"status": "error", "error": {"message": message}},
    )


def _drive_list_error_response(exc: BaseException) -> JSONResponse:
    if isinstance(exc, HttpError):
        status = getattr(getattr(exc, "resp", None), "status", None) or 502
        if status == 404:
            return _err(
                404,
                "指定された Drive フォルダが見つかりません。フォルダ ID と共有設定を確認してください",
            )
        if status == 403:
            return _err(
                403,
                "Drive フォルダへのアクセス権がありません。接続した Google アカウントの権限を確認してください",
            )
        return _err(502, f"Drive API error ({status}): {exc}")
    if isinstance(exc, FileNotFoundError):
        return _err(503, str(exc))
    if isinstance(
        exc, (ssl.SSLError, BrokenPipeError, ConnectionResetError, ConnectionError, TimeoutError, OSError)
    ):
        return _err(
            503,
            "Google Drive への接続が一時的に失敗しました。しばらく待ってから再試行してください",
        )
    return _err(500, f"Drive list failed: {exc}")


def _normalize_batch_items(raw_items: list[Any] | None) -> list[dict[str, Any]]:
    """Workflow から渡される items のネストを 1 段フラット化する。"""
    out: list[dict[str, Any]] = []
    for it in raw_items or []:
        if isinstance(it, list):
            out.extend(_normalize_batch_items(it))
        elif isinstance(it, dict):
            out.append(it)
    return out


# -----------------------------------------------------------------------------
# Scan endpoints (FE 動作確認 / Workflow listDriveFolder)
# -----------------------------------------------------------------------------


@app.post("/scan/list-folder")
async def list_folder_endpoint(request: Request) -> JSONResponse:
    """
    Drive フォルダの中身を再帰列挙する。

    body: {
      "rootFolderId": str,                # 走査開始 folder (必須)
      "targetFolderId": str | None,       # 指定があればその子孫だけ返す (rootFolderId と一致でも OK)
      "recursive": bool = true,
    }

    returns: {
      "files": [ { "id", "name", "mimeType", "modifiedTime", "size", "webViewLink", ... } ],
      "fileCount": int,
      "rootFolderId": str,
      "targetFolderId": str | None,
    }
    """
    try:
        body = await request.json()
    except Exception as exc:
        return _err(400, f"Invalid JSON body: {exc}")

    root_folder_id = (body or {}).get("rootFolderId") or (body or {}).get(
        "root_folder_id"
    )
    root_folder_resource_key = (body or {}).get("rootFolderResourceKey") or (
        body or {}
    ).get("root_folder_resource_key")
    target_folder_id = (body or {}).get("targetFolderId") or (body or {}).get(
        "target_folder_id"
    )
    target_folder_resource_key = (body or {}).get("targetFolderResourceKey") or (
        body or {}
    ).get("target_folder_resource_key")
    recursive = bool((body or {}).get("recursive", True))

    if not root_folder_id and not target_folder_id:
        return _err(400, "rootFolderId or targetFolderId is required")

    folder_to_list = target_folder_id or root_folder_id

    try:
        drive_service = _drive_service_from_body(body or {})
        all_items = list_files(
            drive_service,
            folder_to_list,
            recursive=recursive,
            resource_keys={
                root_folder_id: root_folder_resource_key,
                target_folder_id: target_folder_resource_key,
            },
        )
    except Exception as exc:
        traceback.print_exc()
        return _drive_list_error_response(exc)

    files_only = [
        f for f in all_items if f.get("mimeType") != DRIVE_FOLDER_MIME_TYPE
    ]

    return _ok(
        {
            "files": files_only,
            "fileCount": len(files_only),
            "rootFolderId": root_folder_id,
            "targetFolderId": target_folder_id,
        }
    )


@app.post("/scan/test-connection")
async def test_connection_endpoint(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        body = {}
    root_folder_id = (body or {}).get("rootFolderId") or (body or {}).get(
        "root_folder_id"
    )
    root_folder_resource_key = (body or {}).get("rootFolderResourceKey") or (
        body or {}
    ).get("root_folder_resource_key")
    if not root_folder_id:
        return _err(400, "rootFolderId is required")
    try:
        drive_service = _drive_service_from_body(body or {})
    except Exception as exc:
        return _err(403, str(exc))
    result = test_connection(drive_service, root_folder_id, root_folder_resource_key)
    return _ok(result)


# -----------------------------------------------------------------------------
# Mirror endpoints (Workflow diffWithMirror / mirrorAdd / mirrorRemove)
# -----------------------------------------------------------------------------


def _resolve_mirror_ext(mime_type: str | None, name: str | None) -> str:
    """driveModifiedTime 後に付与する拡張子を決める"""
    mt = (mime_type or "").lower()
    if mt in GOOGLE_WORKSPACE_EXPORT_EXT:
        return GOOGLE_WORKSPACE_EXPORT_EXT[mt]
    if name and "." in name:
        # 末尾の .ext を流用
        ext = "." + name.rsplit(".", 1)[-1].lower()
        if 1 < len(ext) <= 8:
            return ext
    return DEFAULT_MIRROR_EXT


def _drive_files_to_inventory(
    drive_files: list[dict[str, Any]],
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
    operation_metadata: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """drive list → { driveFileId: {expectedMirrorPath, driveModifiedTime, name, mime} }"""
    out: dict[str, dict[str, Any]] = {}
    for f in drive_files:
        drive_id = f.get("id")
        if not drive_id:
            continue
        modified = f.get("modifiedTime") or f.get("modified_time") or ""
        ext = _resolve_mirror_ext(f.get("mimeType"), f.get("name"))
        object_path = mirror_object_path(
            organization_id=organization_id,
            space_id=space_id,
            file_space_id=file_space_id,
            drive_file_id=drive_id,
            drive_modified_time=modified,
            ext=ext,
        )
        out[drive_id] = {
            "driveFileId": drive_id,
            "driveModifiedTime": modified,
            "name": f.get("name"),
            "mimeType": f.get("mimeType"),
            "size": f.get("size"),
            "webViewLink": f.get("webViewLink"),
            "resourceKey": f.get("resourceKey"),
            "expectedMirrorPath": object_path,
            "mirrorExt": ext,
        }
        if operation_metadata:
            out[drive_id]["operationMetadata"] = operation_metadata
    return out


@app.post("/mirror/diff")
async def mirror_diff_endpoint(request: Request) -> JSONResponse:
    """
    Drive list と GCS mirror inventory を突き合わせて
    {toAdd, toUpdate, toRemove, unchanged} を返す。

    body: {
      "organizationId": str,
      "spaceId": str,
      "fileSpaceId": str,
      "driveFiles": [ {id, name, mimeType, modifiedTime, ...} ],
      "operationType": "syncFolder" | "syncSingleFolder",
      "targetFolderId": str | None,    # syncSingleFolder で他フォルダ消さない用のヒント
    }

    returns: {
      "mirrorPrefix": "gs://...",
      "toAdd":    [...],
      "toUpdate": [...],
      "toRemove": [...],
      "unchanged":[...],
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
    drive_files: list[dict[str, Any]] = (body or {}).get("driveFiles") or []
    operation_type = (body or {}).get("operationType") or "syncFolder"
    operation_metadata = _operation_metadata_from_body(body or {})

    if not organization_id or not space_id or not file_space_id:
        return _err(
            400,
            "organizationId, spaceId, fileSpaceId are required for diff",
        )

    expected = _drive_files_to_inventory(
        drive_files,
        organization_id=organization_id,
        space_id=space_id,
        file_space_id=file_space_id,
        operation_metadata=operation_metadata,
    )

    try:
        actual = list_mirror_inventory(
            bucket=MIRROR_BUCKET,
            organization_id=organization_id,
            space_id=space_id,
            file_space_id=file_space_id,
        )
    except Exception as exc:
        traceback.print_exc()
        return _err(500, f"mirror inventory failed: {exc}")

    to_add: list[dict[str, Any]] = []
    to_update: list[dict[str, Any]] = []
    unchanged: list[dict[str, Any]] = []
    to_remove: list[dict[str, Any]] = []

    for drive_id, exp in expected.items():
        existing_entries = actual.get(drive_id) or []
        latest = max(
            existing_entries,
            key=lambda e: e.get("driveModifiedTime") or "",
            default=None,
        )
        if latest is None:
            to_add.append(exp)
        elif (latest.get("driveModifiedTime") or "") < (
            exp.get("driveModifiedTime") or ""
        ):
            payload = dict(exp)
            payload["previousMirrorPath"] = latest.get("objectPath")
            to_update.append(payload)
        else:
            unchanged.append(exp)

    # syncFolder の場合のみ、Drive に存在しなくなった mirror を削除候補にする。
    # syncSingleFolder では他フォルダの mirror を巻き込まないよう削除はスキップ。
    if operation_type == "syncFolder":
        for drive_id, entries in actual.items():
            if drive_id not in expected:
                for e in entries:
                    to_remove.append(
                        {
                            "driveFileId": drive_id,
                            "objectPath": e.get("objectPath"),
                        }
                    )

    return _ok(
        {
            "mirrorPrefix": mirror_prefix(
                bucket=MIRROR_BUCKET,
                organization_id=organization_id,
                space_id=space_id,
                file_space_id=file_space_id,
            ),
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


def _download_and_upload(
    *,
    drive_file_id: str,
    drive_mime_type: str | None,
    drive_name: str | None,
    drive_resource_key: str | None = None,
    object_path: str,
    drive_service: Any | None = None,
) -> dict[str, Any]:
    """Drive から download して GCS mirror に upload。
    Returns: {ok, gsUri, size, md5, effectiveMime, error?}
    """
    try:
        content, effective_mime = download_file(
            drive_service,
            drive_file_id,
            drive_mime_type,
            drive_resource_key,
        )
        md5 = hashlib.md5(content).hexdigest()
        size = len(content)
        gs_uri = apply_batch.upload_bytes_to_mirror(
            bucket=MIRROR_BUCKET,
            object_path=object_path,
            data=content,
            content_type=effective_mime,
            metadata={
                "driveFileId": drive_file_id,
                "driveOriginalName": drive_name or "",
                "driveOriginalMime": drive_mime_type or "",
                "effectiveMime": effective_mime,
            },
        )
        return {
            "ok": True,
            "driveFileId": drive_file_id,
            "gsUri": gs_uri,
            "size": size,
            "md5": md5,
            "effectiveMime": effective_mime,
        }
    except Exception as exc:
        traceback.print_exc()
        return {
            "ok": False,
            "driveFileId": drive_file_id,
            "error": f"{type(exc).__name__}: {exc}",
        }


@app.post("/mirror/apply-batch")
async def mirror_apply_batch_endpoint(request: Request) -> JSONResponse:
    """
    Drive → GCS Mirror 取り込み (最大 10 件)。

    body: {
      "items": [
        {
          "driveFileId": str,
          "driveModifiedTime": str,
          "name": str | None,
          "mimeType": str | None,
          "expectedMirrorPath": str,    # mirror_object_path() の結果
          "previousMirrorPath": str | None,  # 更新時の旧 path (2-phase commit で削除)
        }
      ],
      "deleteStaleVersions": true (default)
    }

    returns: {
      "results": [ { ok, driveFileId, gsUri, size, md5 } ],
      "added": int, "updated": int, "failed": int,
      "failures": [ { driveFileId, error } ],
    }
    """
    try:
        body = await request.json()
    except Exception as exc:
        return _err(400, f"Invalid JSON body: {exc}")

    items: list[dict[str, Any]] = _normalize_batch_items((body or {}).get("items"))
    if len(items) > 10:
        return _err(400, f"items must be <= 10, got {len(items)}")
    delete_stale = bool((body or {}).get("deleteStaleVersions", True))
    try:
        drive_service = _drive_service_from_body(body or {})
    except Exception as exc:
        traceback.print_exc()
        return _err(500, f"Drive OAuth credential resolution failed: {exc}")

    results: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    added = 0
    updated = 0

    for it in items:
        drive_id = it.get("driveFileId")
        object_path = it.get("expectedMirrorPath")
        if not drive_id or not object_path:
            failures.append(
                {
                    "driveFileId": drive_id,
                    "error": "driveFileId and expectedMirrorPath are required",
                }
            )
            continue
        previous_mirror_path = it.get("previousMirrorPath")
        res = _download_and_upload(
            drive_file_id=drive_id,
            drive_mime_type=it.get("mimeType"),
            drive_name=it.get("name"),
            drive_resource_key=it.get("resourceKey"),
            object_path=object_path,
            drive_service=drive_service,
        )
        results.append(res)
        if res.get("ok"):
            if previous_mirror_path:
                updated += 1
                if delete_stale and previous_mirror_path != object_path:
                    try:
                        apply_batch.delete_object(
                            bucket=MIRROR_BUCKET,
                            object_path=previous_mirror_path,
                        )
                    except Exception as exc:
                        print(
                            "[mirror/apply-batch] failed to delete stale "
                            f"{previous_mirror_path}: {exc}"
                        )
            else:
                added += 1
        else:
            failures.append(
                {
                    "driveFileId": drive_id,
                    "error": res.get("error") or "unknown",
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


@app.post("/mirror/remove-batch")
async def mirror_remove_batch_endpoint(request: Request) -> JSONResponse:
    """
    GCS mirror から最大 10 件削除。

    body: {
      "items": [ { "driveFileId": str, "objectPath": str } ]
    }

    returns: {
      "results": [ { ok, driveFileId, objectPath } ],
      "removed": int, "failed": int,
      "failures": [ { driveFileId, objectPath, error } ],
    }
    """
    try:
        body = await request.json()
    except Exception as exc:
        return _err(400, f"Invalid JSON body: {exc}")

    items: list[dict[str, Any]] = _normalize_batch_items((body or {}).get("items"))
    if len(items) > 10:
        return _err(400, f"items must be <= 10, got {len(items)}")

    results: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    removed = 0

    for it in items:
        drive_id = it.get("driveFileId")
        object_path = it.get("objectPath")
        if not object_path:
            failures.append(
                {
                    "driveFileId": drive_id,
                    "objectPath": object_path,
                    "error": "objectPath is required",
                }
            )
            continue
        try:
            delete_batch.delete_object(
                bucket=MIRROR_BUCKET, object_path=object_path
            )
            results.append(
                {"ok": True, "driveFileId": drive_id, "objectPath": object_path}
            )
            removed += 1
        except Exception as exc:
            traceback.print_exc()
            err = f"{type(exc).__name__}: {exc}"
            results.append(
                {
                    "ok": False,
                    "driveFileId": drive_id,
                    "objectPath": object_path,
                    "error": err,
                }
            )
            failures.append(
                {
                    "driveFileId": drive_id,
                    "objectPath": object_path,
                    "error": err,
                }
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
            "service": "drive-to-gcs-sync",
            "project": PROJECT_ID,
            "mirrorBucket": MIRROR_BUCKET,
        }
    )
