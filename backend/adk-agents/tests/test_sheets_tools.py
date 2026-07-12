"""sheets_tools helpers."""
from __future__ import annotations

from sheet.sheets_tools import (
    _normalize_range,
    _resolve_spreadsheet_id,
    _resolve_target_sheet_name,
    _sheet_op_artifact,
)


class _FakeState(dict):
    pass


class _FakeContext:
    def __init__(self, state: dict):
        self.state = _FakeState(state)


def test_resolve_spreadsheet_id_from_top_level():
    ctx = _FakeContext({"spreadsheet_id": "abc"})
    assert _resolve_spreadsheet_id(ctx) == "abc"


def test_resolve_target_sheet_name_from_mode_state():
    ctx = _FakeContext(
        {"mode_state": {"target_sheet_name": " 売上 "}}
    )
    assert _resolve_target_sheet_name(ctx) == "売上"


def test_normalize_range_prefixes_sheet_name():
    assert _normalize_range("A1:C3", "Sheet1") == "Sheet1!A1:C3"
    assert _normalize_range("Sheet1!A1", "Sheet1") == "Sheet1!A1"


def test_sheet_op_artifact_includes_spreadsheet_url():
    ctx = _FakeContext(
        {
            "spreadsheet_id": "abc",
            "spreadsheet_url": "https://docs.google.com/spreadsheets/d/abc/edit",
        }
    )
    art = _sheet_op_artifact(
        tool_context=ctx,
        summary="test",
        status="applied",
        range_a1="Sheet1!A1",
    )
    assert art["spreadsheet_url"].endswith("/abc/edit")
    assert art["kind"] == "sheet_op"
