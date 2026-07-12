"""AI Studio シートモード invoke 前検証."""
from __future__ import annotations

from typing import Any

from .workspace_state_buckets import patch_task_bucket, task_bucket_from_mode_state


def _sheet_bucket(mode_state: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(mode_state, dict):
        return {}
    return task_bucket_from_mode_state(mode_state, "sheet")


def is_sheet_mode_selected(mode_state: dict[str, Any] | None) -> bool:
    return _sheet_bucket(mode_state).get("sheet_mode_selected") is True


def _spreadsheet_id_from_mode_state(mode_state: dict[str, Any]) -> str | None:
    sid = mode_state.get("spreadsheet_id")
    if isinstance(sid, str) and sid.strip():
        return sid.strip()
    return None


def _target_sheet_name_from_mode_state(mode_state: dict[str, Any]) -> str | None:
    name = mode_state.get("target_sheet_name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


def validate_sheet_invoke(
    *,
    agent_mode: str,
    mode_state: dict[str, Any] | None,
) -> str | None:
    """シートワークフロー invoke 前検証。エラーコード文字列 or None."""
    if agent_mode != "sheet":
        return None
    if not is_sheet_mode_selected(mode_state=mode_state):
        return "SHEET_MODE_NOT_SELECTED"
    bucket = _sheet_bucket(mode_state)
    if not _spreadsheet_id_from_mode_state(bucket):
        return "SHEET_SPREADSHEET_NOT_SET"
    if not _target_sheet_name_from_mode_state(bucket):
        return "SHEET_TARGET_NOT_SET"
    return None


def sheet_turn_context_summary(*, mode_state: dict[str, Any] | None) -> str | None:
    """LLM 向けに接続済みスプレッドシートの具体値を返す（ツール用 state とは別に毎ターン注入）."""
    bucket = _sheet_bucket(mode_state)
    if not bucket or not is_sheet_mode_selected(mode_state=mode_state):
        return None
    sid = _spreadsheet_id_from_mode_state(bucket)
    target = _target_sheet_name_from_mode_state(bucket)
    if not sid or not target:
        return None
    url = bucket.get("spreadsheet_url")
    url_line = (
        f"- URL: {url.strip()}\n"
        if isinstance(url, str) and url.strip()
        else f"- spreadsheet_id: `{sid}`\n"
    )
    gid = bucket.get("target_sheet_gid")
    gid_line = (
        f"- タブ gid: {gid}\n" if isinstance(gid, int) else ""
    )
    return (
        "接続 UI で確定済みの編集対象です。ユーザーにシート名・URL・ID の再入力は求めないでください。\n"
        f"- **編集対象タブ (target_sheet_name)**: `{target}`\n"
        f"{url_line}"
        f"{gid_line}"
        "- A1 記法でタブ名を省略した `read_range` / `update_range` は、このタブに自動補完されます。\n"
        "- 書き出し・追記依頼では、まず `read_range` で先頭数行を確認し、"
        f"続けて `update_range` または `append_rows`（sheet_name 省略可）で **`{target}`** に反映してください。\n"
        "- 「どのシートに書くか」だけをユーザーに聞き返すのは禁止（接続タブが既知のため）。"
    )


def sheet_state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    """state.sheet / mode_state.sheet バケット patch."""
    bucket = _sheet_bucket(mode_state)
    if not is_sheet_mode_selected(mode_state=mode_state):
        return {}
    sid = _spreadsheet_id_from_mode_state(bucket)
    if not sid:
        return {}
    sheet_patch: dict[str, Any] = {
        "sheet_mode_selected": True,
        "spreadsheet_id": sid,
    }
    url = bucket.get("spreadsheet_url")
    if isinstance(url, str) and url.strip():
        sheet_patch["spreadsheet_url"] = url.strip()
    target = _target_sheet_name_from_mode_state(bucket)
    if target:
        sheet_patch["target_sheet_name"] = target
    gid = bucket.get("target_sheet_gid")
    if isinstance(gid, int):
        sheet_patch["target_sheet_gid"] = gid
    patch: dict[str, Any] = {"mode_state": {"active_mode": "sheet"}}
    patch_task_bucket(patch, "sheet", sheet_patch)
    return patch
