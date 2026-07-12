"""Callable: AI Studio シートモード用スプレッドシート接続確認."""
from __future__ import annotations

import logging
import re

from firebase_admin import initialize_app
from firebase_functions import https_fn
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from triggers.google_workspace_oauth import credentials_for_user

try:
    initialize_app()
except ValueError:
    pass

logger = logging.getLogger(__name__)

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
_SPREADSHEET_ID_RE = re.compile(r"^[a-zA-Z0-9-_]{20,}$")


def _normalize_spreadsheet_id(raw: str) -> str:
    trimmed = (raw or "").strip()
    if not trimmed:
        return ""
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", trimmed)
    if match:
        return match.group(1)
    if trimmed.startswith("http"):
        return ""
    return trimmed.split("?")[0].split("#")[0]


def _get_sheets_service(organization_id: str, user_id: str):
    creds = credentials_for_user(
        organization_id=organization_id,
        user_id=user_id,
        scopes=_SCOPES,
    )
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


@https_fn.on_call(
    region="asia-northeast1",
    memory=512,
    timeout_sec=60,
)
def verify_ai_studio_spreadsheet(
    req: https_fn.CallableRequest,
) -> dict:
    if not req.auth or not req.auth.uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="ログインが必要です",
        )

    data = req.data if isinstance(req.data, dict) else {}
    organization_id = str(data.get("organizationId") or "").strip()
    if not organization_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="organizationId is required",
        )
    raw_url = data.get("spreadsheetUrl")
    raw_id = data.get("spreadsheetId")
    spreadsheet_id = ""
    if isinstance(raw_id, str) and raw_id.strip():
        spreadsheet_id = _normalize_spreadsheet_id(raw_id)
    elif isinstance(raw_url, str) and raw_url.strip():
        spreadsheet_id = _normalize_spreadsheet_id(raw_url)

    if not spreadsheet_id or not _SPREADSHEET_ID_RE.match(spreadsheet_id):
        return {
            "ok": False,
            "error": "有効なスプレッドシート URL または ID を入力してください",
        }

    spreadsheet_url = (
        f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"
    )

    try:
        svc = _get_sheets_service(organization_id, req.auth.uid)
        meta = svc.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    except HttpError as exc:
        status = exc.resp.status if hasattr(exc, "resp") else "?"
        logger.warning(
            "verify_ai_studio_spreadsheet failed: id=%s status=%s",
            spreadsheet_id,
            status,
        )
        if status in (403, 404):
            return {
                "ok": False,
                "error": (
                    "スプレッドシートにアクセスできません。"
                    "Google Workspace 接続とシート権限を確認してください。"
                ),
            }
        return {
            "ok": False,
            "error": f"Sheets API エラー (HTTP {status})",
        }
    except Exception as exc:
        logger.exception("verify_ai_studio_spreadsheet unexpected error")
        return {"ok": False, "error": str(exc)[:300]}

    sheet_names = []
    for sh in meta.get("sheets", []):
        props = sh.get("properties", {})
        title = props.get("title")
        sheet_id = props.get("sheetId")
        if isinstance(title, str) and title.strip():
            entry: dict = {"title": title.strip()}
            if isinstance(sheet_id, int):
                entry["sheetId"] = sheet_id
            sheet_names.append(entry)

    if not sheet_names:
        return {"ok": False, "error": "シート（タブ）が見つかりません"}

    return {
        "ok": True,
        "spreadsheetId": spreadsheet_id,
        "spreadsheetUrl": spreadsheet_url,
        "sheetNames": sheet_names,
    }
