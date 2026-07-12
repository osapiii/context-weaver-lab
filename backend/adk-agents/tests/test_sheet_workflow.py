"""sheet_workflow invoke validation."""
from __future__ import annotations

from common.sheet_workflow import (
    is_sheet_mode_selected,
    sheet_state_patch_from_mode_state,
    sheet_turn_context_summary,
    validate_sheet_invoke,
)


def test_is_sheet_mode_selected_from_mode_state():
    assert is_sheet_mode_selected({"sheet_mode_selected": True}) is True
    assert is_sheet_mode_selected({"sheet_mode_selected": False}) is False


def test_validate_sheet_invoke_requires_gate():
    assert (
        validate_sheet_invoke(
            agent_mode="sheet",
            mode_state={"sheet_mode_selected": False},
        )
        == "SHEET_MODE_NOT_SELECTED"
    )


def test_validate_sheet_invoke_ok_when_complete():
    assert (
        validate_sheet_invoke(
            agent_mode="sheet",
            mode_state={
                "sheet_mode_selected": True,
                "spreadsheet_id": "abc123456789012345678",
                "target_sheet_name": "Sheet1",
            },
        )
        is None
    )


def test_validate_sheet_invoke_skips_non_sheet_agent():
    assert validate_sheet_invoke(agent_mode="writing", mode_state={}) is None


def test_sheet_turn_context_summary_includes_target_tab():
    summary = sheet_turn_context_summary(
        mode_state={
            "sheet_mode_selected": True,
            "spreadsheet_id": "abc123",
            "spreadsheet_url": "https://docs.google.com/spreadsheets/d/abc123/edit",
            "target_sheet_name": "シート1",
            "target_sheet_gid": 0,
        }
    )
    assert summary is not None
    assert "シート1" in summary
    assert "abc123" in summary
    assert "聞き返す" in summary


def test_sheet_turn_context_summary_none_when_not_selected():
    assert sheet_turn_context_summary(mode_state={"sheet_mode_selected": False}) is None


def test_sheet_state_patch_writes_sheet_bucket():
    patch = sheet_state_patch_from_mode_state(
        {
            "sheet_mode_selected": True,
            "spreadsheet_id": "abc",
            "spreadsheet_url": "https://example.com/edit",
            "target_sheet_name": "Data",
            "target_sheet_gid": 3,
        }
    )
    sheet = patch["sheet"]
    assert sheet["spreadsheet_id"] == "abc"
    assert sheet["target_sheet_name"] == "Data"
    assert sheet["target_sheet_gid"] == 3
