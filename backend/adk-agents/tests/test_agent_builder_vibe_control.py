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


def test_build_vibe_capability_structuring_agent_has_tools(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    agent = build_agent_for_mode(
        "vibe_capability_structuring",
        datastore_path=None,
        model="gemini-2.5-flash",
    )
    assert agent.name == "vibe_capability_structuring_agent"
    joined = " ".join(_tool_names(agent)).lower()
    assert "read_capability_structuring_context" in joined
    assert "save_capability_structure" in joined


def test_build_vibe_zapping_analysis_agent_has_tools(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    agent = build_agent_for_mode(
        "vibe_zapping_analysis",
        datastore_path=None,
        model="gemini-2.5-flash",
    )
    assert agent.name == "vibe_zapping_analysis_agent"
    joined = " ".join(_tool_names(agent)).lower()
    assert "read_zapping_analysis_context" in joined
    assert "save_zapping_analysis" not in joined
    assert agent.output_schema is not None
    assert agent.output_key == "vibe_zapping_analysis"


def test_build_vibe_story_generation_agent_has_tools(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    agent = build_agent_for_mode(
        "vibe_story_generation",
        datastore_path=None,
        model="gemini-2.5-flash",
    )
    assert agent.name == "vibe_story_generation_agent"
    joined = " ".join(_tool_names(agent)).lower()
    assert "read_story_generation_context" in joined
    assert "save_story_generation" in joined
