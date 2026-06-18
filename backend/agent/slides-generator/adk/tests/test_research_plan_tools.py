"""Tests for save_research_plan_draft tool."""
from __future__ import annotations

import json

from adk.agent_tools.research_plan_tools import save_research_plan_draft


class _FakeState(dict):
    pass


class _FakeToolContext:
    def __init__(self) -> None:
        self.state = _FakeState()


def test_save_research_plan_draft_writes_state() -> None:
    ctx = _FakeToolContext()
    plan = {
        "deck": {
            "title": "テストテーマ",
            "target_reader": "担当者",
            "intent": "調査",
        },
        "sections": [
            {"id": "Q1", "question": "最初の一歩は?", "kind": "definitional"},
            {"id": "Q2", "question": "コストは?", "kind": "comparative"},
        ],
        "concerns": [{"id": "C1", "text": "現場の反発"}],
    }
    result = save_research_plan_draft(plan_json=json.dumps(plan), tool_context=ctx)
    assert result["ok"] is True
    assert ctx.state.get("workflow_phase") == "plan_review"
    assert isinstance(ctx.state.get("plan_draft"), dict)
