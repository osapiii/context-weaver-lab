"""
Google Drive API client for drive-to-gcs-sync.

OAuth credentials are built by the caller. This module owns Drive API retry
behavior, Google Workspace exports, recursive listing, and resource-key support
for link-shared folders/files.
"""

from __future__ import annotations

import io
import ssl
import time
from typing import Callable, Optional, TypeVar

from googleapiclient.discovery import Resource, build
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
    """Retry transient SSL / network failures around Google API calls."""
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


DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"


def build_drive_service(credentials) -> Resource:
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def _resource_key_header(resource_keys: dict[str, str | None] | None) -> str | None:
    pairs = [
        f"{file_id}/{resource_key}"
        for file_id, resource_key in (resource_keys or {}).items()
        if file_id and resource_key
    ]
    return ",".join(pairs) if pairs else None


def _apply_resource_key_header(
    request: object,
    resource_keys: dict[str, str | None] | None,
) -> None:
    header = _resource_key_header(resource_keys)
    if not header:
        return
    headers = getattr(request, "headers", None)
    if isinstance(headers, dict):
        headers["X-Goog-Drive-Resource-Keys"] = header


def list_files(
    service: Resource,
    folder_id: str,
    recursive: bool = False,
    resource_keys: dict[str, str | None] | None = None,
) -> list[dict]:
    all_files: list[dict] = []
    page_token: Optional[str] = None
    fields = (
        "nextPageToken, files(id, name, mimeType, modifiedTime, parents, size, "
        "webViewLink, thumbnailLink, resourceKey)"
    )
    known_resource_keys = dict(resource_keys or {})
    while True:
        request = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields=fields,
            pageToken=page_token,
            pageSize=200,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        )
        _apply_resource_key_header(request, known_resource_keys)
        response = _execute_with_retry(request.execute)
        files = response.get("files", [])
        for file in files:
            if file.get("id") and file.get("resourceKey"):
                known_resource_keys[file["id"]] = file["resourceKey"]
        all_files.extend(files)
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    if not recursive:
        return all_files

    result: list[dict] = []
    for item in all_files:
        result.append(item)
        if item.get("mimeType") == DRIVE_FOLDER_MIME_TYPE:
            result.extend(
                list_files(
                    service,
                    item["id"],
                    recursive=True,
                    resource_keys=known_resource_keys,
                )
            )
    return result


_GOOGLE_WORKSPACE_EXPORT = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.presentation": "application/pdf",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.drawing": "image/png",
}


def download_file(
    service: Resource,
    file_id: str,
    mime_type: str | None = None,
    resource_key: str | None = None,
) -> tuple[bytes, str]:
    export_mime = _GOOGLE_WORKSPACE_EXPORT.get(mime_type or "")
    if export_mime:
        request = service.files().export_media(fileId=file_id, mimeType=export_mime)
        effective_mime = export_mime
    else:
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        effective_mime = mime_type or "application/octet-stream"
    _apply_resource_key_header(request, {file_id: resource_key})

    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _status, done = _execute_with_retry(
            lambda: downloader.next_chunk()  # noqa: B023 — retry same chunk
        )
    return buf.getvalue(), effective_mime


def test_connection(
    service: Resource,
    root_folder_id: str,
    root_folder_resource_key: str | None = None,
) -> dict:
    try:
        request = service.files().get(
            fileId=root_folder_id,
            fields="id, name, mimeType, resourceKey",
            supportsAllDrives=True,
        )
        _apply_resource_key_header(request, {root_folder_id: root_folder_resource_key})
        folder = _execute_with_retry(request.execute)
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
                "error": "アクセス権がありません。接続した Google アカウントのフォルダ権限を確認してください",
            }
        return {"ok": False, "error": f"Drive API error: {e}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
