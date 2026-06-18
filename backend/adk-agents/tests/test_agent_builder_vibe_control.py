"""Tests for VibeControl mode wiring in agent_builder."""
from __future__ import annotations

import pytest

pytest.importorskip("google.adk")

from common.agent_builder import build_agent_for_mode  # noqa: E402


def _tool_names(agent) -> list[str]:
    names: list[str] = []
    for tool in agent.tools:
        name = getattr(tool, "name", None) or type(tool).__name__
        names.append(str(name))
    return names


def test_build_vibe_control_agent_has_ssot_tools(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    agent = build_agent_for_mode(
        "vibe_control",
        datastore_path=None,
        model="gemini-2.5-flash",
    )
    assert agent.name == "en_aistudio_vibe_control_agent"
    joined = " ".join(_tool_names(agent)).lower()
    assert "read_vibe_control_sources" in joined
    assert "save_user_story_ssot" in joined
