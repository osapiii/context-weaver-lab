"""Tests for guide mode in agent_builder."""
from __future__ import annotations

import pytest

pytest.importorskip("google.adk")

from common.agent_builder import build_agent_for_mode  # noqa: E402


@pytest.fixture(autouse=True)
def _env_project(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")


def test_build_guide_agent_has_search_tool():
    path = (
        "projects/test-project/locations/global/collections/default_collection"
        "/dataStores/en-aistudio-platform-guide"
    )
    agent = build_agent_for_mode(
        "guide",
        datastore_path=path,
        model="gemini-2.5-flash-lite",
    )
    assert agent.name == "en_guide_agent"
    tool_names = [getattr(t, "name", None) or type(t).__name__ for t in agent.tools]
    assert any("search" in str(n).lower() or "Vertex" in str(n) for n in tool_names)


def test_build_guide_agent_unknown_mode_raises():
    with pytest.raises(ValueError, match="Unknown agent mode"):
        build_agent_for_mode("invalid", datastore_path=None, model="gemini-2.5-flash")
