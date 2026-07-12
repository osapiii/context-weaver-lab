"""Research plan draft — HITL 確認用に session.state.research へ書き込む."""
from __future__ import annotations

import json
from typing import Any

from .research_state_sync import write_research_state_key


def save_research_plan_draft(
    plan_json: str,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Briefing から生成した 1問1答プラン素案を state に保存する.

    Args:
        plan_json: JSON 文字列 — { deck, sections[], concerns[] } (research-v13 素案).
    """
    if tool_context is None:
        return {"ok": False, "error": "tool_context_missing"}
    try:
        raw = json.loads(plan_json) if isinstance(plan_json, str) else plan_json
    except (json.JSONDecodeError, TypeError) as exc:
        return {"ok": False, "error": f"invalid_json: {exc}"}
    if not isinstance(raw, dict):
        return {"ok": False, "error": "plan_must_be_object"}

    deck = raw.get("deck")
    sections = raw.get("sections")
    concerns = raw.get("concerns")
    if not isinstance(deck, dict):
        return {"ok": False, "error": "deck_required"}
    if not isinstance(sections, list) or len(sections) < 1:
        return {"ok": False, "error": "sections_required"}

    plan_draft = {
        "deck": deck,
        "sections": sections,
        "concerns": concerns if isinstance(concerns, list) else [],
    }

    try:
        state = tool_context.state
        write_research_state_key(state, "plan_draft", plan_draft)
        write_research_state_key(state, "workflow_phase", "plan_review")
        write_research_state_key(state, "current_phase", "plan_review")
        theme = deck.get("title")
        if isinstance(theme, str) and theme.strip():
            write_research_state_key(state, "theme", theme.strip())
    except Exception as exc:
        return {"ok": False, "error": f"state_write_failed: {exc}"}

    return {
        "ok": True,
        "workflow_phase": "plan_review",
        "section_count": len(sections),
        "concern_count": len(plan_draft["concerns"]),
        "message": "リサーチプラン素案を保存しました。UI で確認・編集できます。",
    }
