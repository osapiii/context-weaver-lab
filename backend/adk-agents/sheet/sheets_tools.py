"""Google Sheets API ツール群 (sheet agent 用).

すべての tool は session state.sheet を参照して操作対象を解決する.
LLM は spreadsheet_id を引数で受け取らないので、接続 UI で確定していない状態だと
session state が空 → tool が「spreadsheet_id 未設定」エラーを返す.

認証:
    Cloud Run の service account credentials (ADC) を使用.
    対象シートを SA メールに編集者として共有する必要がある.

return 値の規約:
    成功時:
        {
            "ok": True,
            "data": ...,                # 読み取り系の主データ
            "artifacts": [
                {"kind": "sheet_op", "summary": "...", "range": "...", "status": "applied"|"proposed"}
            ]
        }
    失敗時:
        {
            "ok": False,
            "error": "...",
            "artifacts": [
                {"kind": "sheet_op", "summary": "...", "status": "failed"}
            ]
        }
"""
from __future__ import annotations

import logging
import re
from typing import Any

from common.tool_state import read_tool_state
from common.workspace_state_buckets import task_bucket_from_session_state
from google.auth import default as google_auth_default
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
_A1_CELL_RE = re.compile(r"^[A-Za-z]+\d+(?::[A-Za-z]+\d+)?$")


def _get_service():
    creds, _ = google_auth_default(scopes=_SCOPES)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _sheet_bucket(tool_context: Any) -> dict[str, Any]:
    return task_bucket_from_session_state(read_tool_state(tool_context), "sheet")


def _resolve_spreadsheet_id(tool_context: Any) -> str | None:
    bucket = _sheet_bucket(tool_context)
    sid = bucket.get("spreadsheet_id")
    if isinstance(sid, str) and sid:
        return sid
    return None


def _resolve_spreadsheet_url(tool_context: Any, spreadsheet_id: str) -> str:
    bucket = _sheet_bucket(tool_context)
    url = bucket.get("spreadsheet_url")
    if isinstance(url, str) and url.strip():
        return url.strip()
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"


def _resolve_target_sheet_name(tool_context: Any) -> str | None:
    bucket = _sheet_bucket(tool_context)
    name = bucket.get("target_sheet_name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


def _normalize_range(range_a1: str, target_sheet_name: str | None) -> str:
    trimmed = (range_a1 or "").strip()
    if not trimmed:
        return trimmed
    if "!" in trimmed:
        return trimmed
    if not target_sheet_name:
        return trimmed
    if _A1_CELL_RE.match(trimmed):
        return f"{target_sheet_name}!{trimmed}"
    return trimmed


def _sheet_op_artifact(
    *,
    tool_context: Any,
    summary: str,
    status: str,
    range_a1: str | None = None,
    sheet_name: str | None = None,
) -> dict[str, Any]:
    sid = _resolve_spreadsheet_id(tool_context)
    artifact: dict[str, Any] = {
        "kind": "sheet_op",
        "summary": summary,
        "status": status,
    }
    if range_a1:
        artifact["range"] = range_a1
    if sheet_name:
        artifact["sheet_name"] = sheet_name
    if sid:
        artifact["spreadsheet_url"] = _resolve_spreadsheet_url(tool_context, sid)
    return artifact


def _missing_id_error() -> dict[str, Any]:
    return {
        "ok": False,
        "error": "spreadsheet_id が session state に未設定です. 接続 UI でスプレッドシートを確定してください.",
        "artifacts": [
            {
                "kind": "sheet_op",
                "summary": "操作対象シートが未設定です",
                "status": "failed",
            }
        ],
    }


def _format_http_error(
    exc: HttpError, attempted: str, tool_context: Any
) -> dict[str, Any]:
    status = exc.resp.status if hasattr(exc, "resp") else "?"
    body = getattr(exc, "content", b"").decode("utf-8", errors="ignore")[:200]
    logger.warning("Sheets API error: status=%s body=%s", status, body)
    return {
        "ok": False,
        "error": f"Sheets API HTTP {status}: {body}",
        "artifacts": [
            _sheet_op_artifact(
                tool_context=tool_context,
                summary=f"{attempted} に失敗 (HTTP {status})",
                status="failed",
            )
        ],
    }


def list_sheets(tool_context: Any) -> dict[str, Any]:
    """スプレッドシート内のシート (タブ) 一覧を取得する.

    Returns:
        {"ok": True, "data": [{"title": "Sheet1", "sheet_id": 0, "row_count": 1000, "col_count": 26}, ...]}
    """
    sid = _resolve_spreadsheet_id(tool_context)
    if not sid:
        return _missing_id_error()
    try:
        svc = _get_service()
        meta = svc.spreadsheets().get(spreadsheetId=sid).execute()
    except HttpError as exc:
        return _format_http_error(exc, "シート一覧取得", tool_context)
    sheets = []
    for sh in meta.get("sheets", []):
        props = sh.get("properties", {})
        grid = props.get("gridProperties", {})
        sheets.append(
            {
                "title": props.get("title"),
                "sheet_id": props.get("sheetId"),
                "row_count": grid.get("rowCount"),
                "col_count": grid.get("columnCount"),
            }
        )
    return {
        "ok": True,
        "data": sheets,
        "artifacts": [
            _sheet_op_artifact(
                tool_context=tool_context,
                summary=f"シート一覧を取得 ({len(sheets)} 件)",
                status="applied",
            )
        ],
    }


def read_range(range: str, tool_context: Any) -> dict[str, Any]:
    """A1 記法で範囲を読み取る. 例: range='Sheet1!A1:D10' または 'A1:D10' (接続タブが補完)."""
    sid = _resolve_spreadsheet_id(tool_context)
    if not sid:
        return _missing_id_error()
    target = _resolve_target_sheet_name(tool_context)
    effective_range = _normalize_range(range, target)
    try:
        svc = _get_service()
        resp = (
            svc.spreadsheets()
            .values()
            .get(spreadsheetId=sid, range=effective_range)
            .execute()
        )
    except HttpError as exc:
        return _format_http_error(exc, f"{effective_range} の読み取り", tool_context)
    values = resp.get("values", [])
    return {
        "ok": True,
        "data": {"range": resp.get("range"), "values": values, "rows": len(values)},
        "artifacts": [
            _sheet_op_artifact(
                tool_context=tool_context,
                summary=f"{effective_range} を読み取り ({len(values)} 行)",
                range_a1=effective_range,
                sheet_name=target,
                status="applied",
            )
        ],
    }


def update_range(
    range: str, values: list[list[Any]], tool_context: Any
) -> dict[str, Any]:
    """A1 範囲に values を書き込む (USER_ENTERED で数式も解釈)."""
    sid = _resolve_spreadsheet_id(tool_context)
    if not sid:
        return _missing_id_error()
    target = _resolve_target_sheet_name(tool_context)
    effective_range = _normalize_range(range, target)
    try:
        svc = _get_service()
        resp = (
            svc.spreadsheets()
            .values()
            .update(
                spreadsheetId=sid,
                range=effective_range,
                valueInputOption="USER_ENTERED",
                body={"values": values},
            )
            .execute()
        )
    except HttpError as exc:
        return _format_http_error(exc, f"{effective_range} の更新", tool_context)
    updated_cells = resp.get("updatedCells", 0)
    updated_range = resp.get("updatedRange") or effective_range
    return {
        "ok": True,
        "data": {
            "updated_range": updated_range,
            "updated_cells": updated_cells,
        },
        "artifacts": [
            _sheet_op_artifact(
                tool_context=tool_context,
                summary=f"{effective_range} を更新 ({updated_cells} セル)",
                range_a1=updated_range,
                sheet_name=target,
                status="applied",
            )
        ],
    }


def append_rows(
    sheet_name: str, values: list[list[Any]], tool_context: Any
) -> dict[str, Any]:
    """指定したタブの末尾に行を追加する.

    Args:
        sheet_name: 追加先タブ名。空文字の場合は接続 UI で確定したタブを使用.
        values: 2 次元配列. 1 要素 = 1 行.
    """
    sid = _resolve_spreadsheet_id(tool_context)
    if not sid:
        return _missing_id_error()
    target = (sheet_name or "").strip() or _resolve_target_sheet_name(tool_context)
    if not target:
        return {
            "ok": False,
            "error": "追加先のシート名が未設定です",
            "artifacts": [
                _sheet_op_artifact(
                    tool_context=tool_context,
                    summary="追加先シート名が未設定",
                    status="failed",
                )
            ],
        }
    try:
        svc = _get_service()
        resp = (
            svc.spreadsheets()
            .values()
            .append(
                spreadsheetId=sid,
                range=f"{target}!A:A",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": values},
            )
            .execute()
        )
    except HttpError as exc:
        return _format_http_error(exc, f"{target} への行追加", tool_context)
    updates = resp.get("updates", {})
    return {
        "ok": True,
        "data": {
            "updated_range": updates.get("updatedRange"),
            "updated_cells": updates.get("updatedCells"),
            "updated_rows": updates.get("updatedRows"),
        },
        "artifacts": [
            _sheet_op_artifact(
                tool_context=tool_context,
                summary=(
                    f"{target} に {updates.get('updatedRows', len(values))} 行追加"
                ),
                range_a1=updates.get("updatedRange"),
                sheet_name=target,
                status="applied",
            )
        ],
    }
