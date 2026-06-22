"""Tests for invoke agent mode resolution."""
from __future__ import annotations

from common.invoke_mode import resolve_invoke_agent_mode


def test_resolve_prefers_body_mode_over_stale_session():
    mode = resolve_invoke_agent_mode(
        url_mode="consultation",
        mode_state={"active_mode": "image"},
        session_state={"mode": "consultation"},
    )
    assert mode == "image"


def test_resolve_uses_session_when_body_missing():
    mode = resolve_invoke_agent_mode(
        url_mode="consultation",
        mode_state={"active_mode": "consultation"},
        session_state={"mode": "image"},
    )
    assert mode == "consultation"


def test_resolve_falls_back_to_url():
    mode = resolve_invoke_agent_mode(
        url_mode="consultation",
        mode_state=None,
        session_state={},
    )
    assert mode == "consultation"


def test_resolve_accepts_vibe_control_mode():
    mode = resolve_invoke_agent_mode(
        url_mode="vibe_control",
        mode_state={"active_mode": "vibe_control"},
        session_state={},
    )
    assert mode == "vibe_control"


def test_resolve_accepts_application_scan_mode():
    mode = resolve_invoke_agent_mode(
        url_mode="application_scan",
        mode_state={"active_mode": "application_scan"},
        session_state={},
    )
    assert mode == "application_scan"


def test_resolve_accepts_separated_vibe_modes():
    capability_mode = resolve_invoke_agent_mode(
        url_mode="vibe_capability_structuring",
        mode_state={"active_mode": "vibe_capability_structuring"},
        session_state={},
    )
    story_mode = resolve_invoke_agent_mode(
        url_mode="vibe_story_generation",
        mode_state={"active_mode": "vibe_story_generation"},
        session_state={},
    )
    assert capability_mode == "vibe_capability_structuring"
    assert story_mode == "vibe_story_generation"
