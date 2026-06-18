"""
Google Drive API client (drive-to-gcs-sync local copy).

Cloud Run の build context は単一 directory なので、共通 `backend/microservice/common/drive_client.py`
を deploy.sh で COPY する。ここでは re-export だけ持つ (実体は同名ファイル).

ローカルテスト時 (deploy.sh を経由しない場合) は repo root の `backend/microservice/common/drive_client.py`
の symlink もしくはコピーが置かれている前提。
"""

from __future__ import annotations

import io
import os
import ssl
import time
from typing import Callable, Optional, TypeVar

from google.oauth2 import service_account
from googleapiclient.discovery import build, Resource
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload

T = TypeVar("T")

_RETRYABLE_NETWORK_ERRORS = (
    ssl.SSLError,
    BrokenPipeError,
    ConnectionResetError,
    ConnectionError,
    TimeoutError,
    OSError,
)
_MAX_DRIVE_API_ATTEMPTS = 4


def _execute_with_retry(execute_fn: Callable[[], T]) -> T:
    """Google OAuth / Drive API 呼び出しの一時的な SSL / 接続断をリトライする。"""
    last_exc: BaseException | None = None
    for attempt in range(_MAX_DRIVE_API_ATTEMPTS):
        try:
            return execute_fn()
        except HttpError:
            raise
        except _RETRYABLE_NETWORK_ERRORS as exc:
            last_exc = exc
            if attempt >= _MAX_DRIVE_API_ATTEMPTS - 1:
                raise
            time.sleep(min(2**attempt, 8))
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("_execute_with_retry: unreachable")


DEFAULT_SA_KEY_PATH = "/etc/sa/drive-agent-key.json"
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"


def _resolve_sa_key_path() -> str:
    return os.getenv("GOOGLE_DRIVE_SA_KEY_PATH", DEFAULT_SA_KEY_PATH)


def _build_drive_service() -> Resource:
    key_path = _resolve_sa_key_path()
    if not os.path.exists(key_path):
        raise FileNotFoundError(
            f"Service Account key not found at {key_path}. "
            "Set GOOGLE_DRIVE_SA_KEY_PATH or mount the secret via --set-secrets."
        )
    credentials = service_account.Credentials.from_service_account_file(
        key_path, scopes=DRIVE_SCOPES
    )
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


_drive_service_singleton: Optional[Resource] = None


def get_drive_service() -> Resource:
    global _drive_service_singleton
    if _drive_service_singleton is None:
        _drive_service_singleton = _build_drive_service()
    return _drive_service_singleton


def list_files(folder_id: str, recursive: bool = False) -> list[dict]:
    service = get_drive_service()
    all_files: list[dict] = []
    page_token: Optional[str] = None
    fields = (
        "nextPageToken, files(id, name, mimeType, modifiedTime, parents, size, "
        "webViewLink, thumbnailLink)"
    )
    while True:
        request = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields=fields,
            pageToken=page_token,
            pageSize=200,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        )
        response = _execute_with_retry(request.execute)
        all_files.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    if not recursive:
        return all_files

    result: list[dict] = []
    for f in all_files:
        result.append(f)
        if f.get("mimeType") == DRIVE_FOLDER_MIME_TYPE:
            result.extend(list_files(f["id"], recursive=True))
    return result


_GOOGLE_WORKSPACE_EXPORT = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.presentation": "application/pdf",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.drawing": "image/png",
}


def download_file(file_id: str, mime_type: str | None = None) -> tuple[bytes, str]:
    service = get_drive_service()
    export_mime = _GOOGLE_WORKSPACE_EXPORT.get(mime_type or "")
    if export_mime:
        request = service.files().export_media(fileId=file_id, mimeType=export_mime)
        effective_mime = export_mime
    else:
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        effective_mime = mime_type or "application/octet-stream"

    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _status, done = _execute_with_retry(
            lambda: downloader.next_chunk()  # noqa: B023 — retry same chunk
        )
    return buf.getvalue(), effective_mime


def test_connection(root_folder_id: str) -> dict:
    try:
        service = get_drive_service()
        folder = _execute_with_retry(
            lambda: service.files()
            .get(
                fileId=root_folder_id,
                fields="id, name, mimeType",
                supportsAllDrives=True,
            )
            .execute()
        )
        if folder.get("mimeType") != DRIVE_FOLDER_MIME_TYPE:
            return {"ok": False, "error": "指定された ID はフォルダではありません"}
        return {"ok": True, "rootFolderName": folder.get("name", "(no name)")}
    except HttpError as e:
        status = getattr(e, "resp", None) and e.resp.status
        if status == 404:
            return {
                "ok": False,
                "error": "フォルダが見つかりません。ID が正しいか確認してください",
            }
        if status == 403:
            return {
                "ok": False,
                "error": "アクセス権がありません。Service Account に共有されているか確認してください",
            }
        return {"ok": False, "error": f"Drive API error: {e}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
