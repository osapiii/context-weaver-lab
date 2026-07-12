"""Tests for research invoke state patch helpers."""
from __future__ import annotations

from common.research_workflow import (
    is_research_pipeline_autonomous,
    is_research_pipeline_terminal,
    research_state_patch_from_mode_state,
    research_turn_context_summary,
    validate_research_invoke,
)


def test_research_state_patch_from_mode_state_bucket():
    patch = research_state_patch_from_mode_state(
        {
            "research": {
                "current_phase": "phase1_8_research",
                "theme": "AI 市場",
                "organization_name": "ENOSTECH",
                "file_space_id": "fs_1",
                "context_status": "ready",
            },
            "auto_mode": True,
        }
    )
    assert patch["phase"] == "phase1_8_research"
    assert patch["setup"]["theme"] == "AI 市場"
    assert patch["setup"]["auto_mode"] is True
    assert patch["setup"]["organization_name"] == "ENOSTECH"
    assert patch["setup"]["file_space_id"] == "fs_1"
    assert patch["setup"]["context_status"] == "ready"


def test_research_turn_context_summary():
    summary = research_turn_context_summary(
        mode_state={
            "research": {
                "phase": "phase1_hearing",
                "setup": {"theme": "半導体", "auto_mode": True},
            },
        }
    )
    assert "phase1_hearing" in summary
    assert "半導体" in summary
    assert "自動進行" in summary


def test_validate_research_invoke_rejects_unknown_phase():
    err = validate_research_invoke(
        agent_mode="research",
        mode_state={"current_phase": "phase99_unknown"},
    )
    assert err is not None
    assert "INVALID_RESEARCH_PHASE" in err


def test_research_pipeline_autonomous_flags():
    assert is_research_pipeline_autonomous(
        {"research": {"setup": {"pipeline_autonomous": True}}}
    )
    assert not is_research_pipeline_autonomous({"research": {"setup": {}}})


def test_research_pipeline_terminal():
    assert is_research_pipeline_terminal(
        {"research": {"payload": {"research_html_path": "/deck/research.html"}}}
    )
    assert not is_research_pipeline_terminal({"research": {"payload": {}}})


def test_research_turn_context_pipeline_autonomous():
    summary = research_turn_context_summary(
        mode_state={
            "research": {
                "setup": {"pipeline_autonomous": True, "theme": "IoT"},
            },
        }
    )
    assert "一気通貫" in summary
    assert "IoT" in summary


def test_research_turn_context_summary_includes_context_warning():
    summary = research_turn_context_summary(
        mode_state={
            "research": {
                "setup": {
                    "organization_name": "ENOSTECH",
                    "space_name": "開発",
                    "file_space_id": "fs_missing",
                    "context_status": "limited",
                    "context_warning": "fileSpace が未解決です",
                },
            },
        }
    )
    assert "ENOSTECH" in summary
    assert "コンテキスト状態" in summary
    assert "fileSpace が未解決です" in summary


def test_validate_research_invoke_ignores_other_modes():
    assert (
        validate_research_invoke(
            agent_mode="image",
            mode_state={"current_phase": "bogus"},
        )
        is None
    )
