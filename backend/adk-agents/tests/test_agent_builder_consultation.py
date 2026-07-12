"""Tests for consultation mode tools in agent_builder."""
from __future__ import annotations

import pytest

pytest.importorskip("google.adk")

from common.agent_builder import build_agent_for_mode  # noqa: E402


@pytest.fixture(autouse=True)
def _env_project(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")


def _tool_names(agent) -> list[str]:
    names: list[str] = []
    for tool in agent.tools:
        name = getattr(tool, "name", None) or type(tool).__name__
        names.append(str(name))
    return names


def test_build_consultation_agent_has_web_fetch_tool():
    agent = build_agent_for_mode(
        "consultation",
        datastore_path=None,
        model="gemini-2.5-flash",
    )
    assert agent.name == "en_consultation_agent"
    joined = " ".join(_tool_names(agent)).lower()
    assert "fetch_web_page" in joined or "fetchwebpage" in joined.replace("_", "")
