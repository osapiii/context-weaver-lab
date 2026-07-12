"""research_writer: v13 スタンプ付与."""
from __future__ import annotations

import json
from pathlib import Path

from adk.agent_tools.research_writer import stamp_research_v13
from adk.schemas.research import RESEARCH_SCHEMA_ID, Research

_FIXTURE = (
    Path(__file__).resolve().parent / "fixtures" / "research.sample.json"
)


def test_stamp_fills_deck_id_and_schema() -> None:
    data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    data["deck_id"] = ""
    data["$schema"] = ""
    research = Research.model_validate(data)
    stamped = stamp_research_v13(research, "2026-06-03_test-deck")
    assert stamped.deck_id == "2026-06-03_test-deck"
    assert stamped.schema_ == RESEARCH_SCHEMA_ID
    assert stamped.meta.schema_version == "13"
