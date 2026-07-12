"""Golden research task bucket I/O."""
from __future__ import annotations

from common.golden_task_bucket_io import (
    merge_research_into_session_state,
    research_flat_to_golden,
    research_golden_to_effective_flat,
)


def test_research_flat_to_golden_from_legacy_flat():
    golden = research_flat_to_golden(
        {
            "current_phase": "phase2_svg",
            "theme": "補助金",
            "auto_mode": True,
            "deck_dir": "/tmp/decks/x",
        }
    )
    assert golden["phase"] == "phase2_svg"
    assert golden["setup"]["theme"] == "補助金"
    assert golden["setup"]["auto_mode"] is True
    assert golden["payload"]["deck_dir"] == "/tmp/decks/x"


def test_research_golden_to_effective_flat_roundtrip():
    bucket = research_flat_to_golden(
        {"current_phase": "phase1_hearing", "theme": "AI"}
    )
    flat = research_golden_to_effective_flat(bucket)
    assert flat["current_phase"] == "phase1_hearing"
    assert flat["theme"] == "AI"


def test_merge_research_into_session_state():
    state: dict = {}
    merge_research_into_session_state(
        state,
        {"current_phase": "phase3_html", "research_path": "/tmp/r.json"},
    )
    assert state["research"]["phase"] == "phase3_html"
    assert state["research"]["payload"]["research_path"] == "/tmp/r.json"
    assert state["research"]["invoke"]["status"] == "idle"
