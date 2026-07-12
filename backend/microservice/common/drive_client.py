"""
Google Drive API クライアント (共通モジュール)

webCrawler microservice (Drive にクロール結果を書き込む) と
driveToGcsSync microservice (Drive → GCS ミラー) で共用する Drive API ラッパー。
(driveToGcsSync 側は deploy.sh で本モジュールを COPY して同梱する)

認証方式: Service Account (JSON 鍵)
  - Cloud Run へは `--set-secrets=/etc/sa/drive-agent-key.json=en-aistudio-drive-agent-key:latest`
    で Secret Manager の値をファイルとしてマウントする運用
  - env `GOOGLE_DRIVE_SA_KEY_PATH` で鍵パスを上書き可能 (デフォルト /etc/sa/drive-agent-key.json)
  - ローカル開発時は `GOOGLE_DRIVE_SA_KEY_PATH=/path/to/key.json` を指定

スコープ: https://www.googleapis.com/auth/drive (フォルダ作成 + ファイル up/down/delete)
"""

import io
import os
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build, Resource
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload


DEFAULT_SA_KEY_PATH = "/etc/sa/drive-agent-key.json"
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"


def _resolve_sa_key_path() -> str:
    """Service Account 鍵ファイルパス解決 (env 上書き可)"""
    return os.getenv("GOOGLE_DRIVE_SA_KEY_PATH", DEFAULT_SA_KEY_PATH)


def _build_drive_service() -> Resource:
    """Drive v3 service クライアント生成"""
    key_path = _resolve_sa_key_path()
    if not os.path.exists(key_path):
        raise FileNotFoundError(
            f"Service Account key not found at {key_path}. "
            "Set GOOGLE_DRIVE_SA_KEY_PATH or mount the secret via --set-secrets."
        )
    credentials = service_account.Credentials.from_service_account_file(
        key_path, scopes=DRIVE_SCOPES
    )
    # cache_discovery=False で grpc 警告を抑止 (read-only サービスでは推奨)
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


# モジュールレベルキャッシュ (同一プロセス内で Drive service を再利用)
_drive_service_singleton: Optional[Resource] = None


def get_drive_service() -> Resource:
    """Drive service (キャッシュ済み singleton)"""
    global _drive_service_singleton
    if _drive_service_singleton is None:
        _drive_service_singleton = _build_drive_service()
    return _drive_service_singleton


# === ヘルパー関数群 ===


def create_folder(parent_folder_id: str, name: str) -> str:
    """指定親フォルダ配下に新規フォルダ作成、folder_id を返す"""
    service = get_drive_service()
    file_metadata = {
        "name": name,
        "mimeType": DRIVE_FOLDER_MIME_TYPE,
        "parents": [parent_folder_id],
    }
    folder = (
        service.files()
        .create(body=file_metadata, fields="id", supportsAllDrives=True)
        .execute()
    )
    return folder["id"]


def find_or_create_folder(parent_folder_id: str, name: str) -> str:
    """同名フォルダがあればその id、なければ新規作成"""
    service = get_drive_service()
    # 完全一致 + フォルダ mime + trashed=False で検索
    escaped_name = name.replace("'", "\\'")
    query = (
        f"name = '{escaped_name}' and "
        f"mimeType = '{DRIVE_FOLDER_MIME_TYPE}' and "
        f"'{parent_folder_id}' in parents and "
        f"trashed = false"
    )
    response = (
        service.files()
        .list(
            q=query,
            fields="files(id, name)",
            pageSize=1,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        )
        .execute()
    )
    files = response.get("files", [])
    if files:
        return files[0]["id"]
    return create_folder(parent_folder_id, name)


def upload_bytes(
    folder_id: str,
    filename: str,
    content_bytes: bytes,
    mime_type: str = "application/octet-stream",
) -> dict:
    """指定フォルダに bytes を upload、{id, webViewLink} を返す"""
    service = get_drive_service()
    file_metadata = {"name": filename, "parents": [folder_id]}
    media = MediaIoBaseUpload(
        io.BytesIO(content_bytes), mimetype=mime_type, resumable=False
    )
    uploaded = (
        service.files()
        .create(
            body=file_metadata,
            media_body=media,
            fields="id, name, webViewLink, mimeType, size, modifiedTime",
            supportsAllDrives=True,
        )
        .execute()
    )
    return uploaded


def upload_string(
    folder_id: str,
    filename: str,
    text: str,
    mime_type: str = "text/markdown",
) -> dict:
    """指定フォルダに文字列 (utf-8) を upload"""
    return upload_bytes(folder_id, filename, text.encode("utf-8"), mime_type)


def list_files(folder_id: str, recursive: bool = False) -> list[dict]:
    """指定フォルダ配下のファイル/サブフォルダ一覧

    Returns:
        list of {id, name, mimeType, modifiedTime, parents, size, webViewLink, thumbnailLink}
    """
    service = get_drive_service()
    all_files: list[dict] = []
    page_token: Optional[str] = None
    fields = (
        "nextPageToken, files(id, name, mimeType, modifiedTime, parents, size, "
        "webViewLink, thumbnailLink)"
    )

    # まずは直接の子だけ取る
    while True:
        response = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed = false",
                fields=fields,
                pageToken=page_token,
                pageSize=200,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        all_files.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    if not recursive:
        return all_files

    # recursive: 子フォルダを深さ優先で展開
    result: list[dict] = []
    for f in all_files:
        result.append(f)
        if f.get("mimeType") == DRIVE_FOLDER_MIME_TYPE:
            result.extend(list_files(f["id"], recursive=True))
    return result


def get_files_by_ids(file_ids: list[str]) -> list[dict]:
    """Drive fileId からメタデータを取得 (バッチ取り込み用)."""
    if not file_ids:
        return []
    service = get_drive_service()
    fields = (
        "id, name, mimeType, modifiedTime, parents, size, "
        "webViewLink, thumbnailLink"
    )
    result: list[dict] = []
    for file_id in file_ids:
        meta = (
            service.files()
            .get(
                fileId=file_id,
                fields=fields,
                supportsAllDrives=True,
            )
            .execute()
        )
        if meta:
            result.append(meta)
    return result


def list_files_light(folder_id: str, recursive: bool = False) -> list[dict]:
    """list_files の軽量版 (id / mimeType / modifiedTime のみ). プレビュー・件数突合用."""
    service = get_drive_service()
    all_files: list[dict] = []
    page_token: Optional[str] = None
    fields = "nextPageToken, files(id, mimeType, modifiedTime)"

    while True:
        response = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed = false",
                fields=fields,
                pageToken=page_token,
                pageSize=200,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
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
            result.extend(list_files_light(f["id"], recursive=True))
    return result


# Google Workspace 形式 → エクスポート時の mime
_GOOGLE_WORKSPACE_EXPORT = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.presentation": "application/pdf",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.drawing": "image/png",
}


def download_file(file_id: str, mime_type: str | None = None) -> tuple[bytes, str]:
    """ファイルをバイト列でダウンロード。

    Google Workspace 形式 (Docs/Slides/Sheets/Drawings) は get_media が 403 を返すので、
    export_media で PDF/CSV/PNG にエクスポートして返す。

    Returns:
        (content, effective_mime_type)
    """
    service = get_drive_service()
    export_mime = _GOOGLE_WORKSPACE_EXPORT.get(mime_type or "")

    if export_mime:
        # Google Workspace: export_media を使う
        request = service.files().export_media(fileId=file_id, mimeType=export_mime)
        effective_mime = export_mime
    else:
        # 通常ファイル
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        effective_mime = mime_type or "application/octet-stream"

    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _status, done = downloader.next_chunk()
    return buf.getvalue(), effective_mime


def delete_file(file_id: str) -> None:
    """ファイル/フォルダを削除 (ゴミ箱経由ではなく完全削除)"""
    service = get_drive_service()
    service.files().delete(fileId=file_id, supportsAllDrives=True).execute()


def get_folder_web_view_link(folder_id: str) -> str:
    """フォルダの Drive WebView URL を取得"""
    service = get_drive_service()
    folder = (
        service.files()
        .get(fileId=folder_id, fields="webViewLink", supportsAllDrives=True)
        .execute()
    )
    return folder.get("webViewLink", f"https://drive.google.com/drive/folders/{folder_id}")


def test_connection(root_folder_id: str) -> dict:
    """設定 UI の「動作確認」用 — root フォルダの list を 1 件取って返す

    Returns:
        {"ok": True, "rootFolderName": str} もしくは {"ok": False, "error": str}
    """
    try:
        service = get_drive_service()
        folder = (
            service.files()
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
