"""Tests for application_scan mode wiring in agent_builder."""
from __future__ import annotations

import pytest

pytest.importorskip("google.adk")

from common.agent_builder import build_agent_for_mode  # noqa: E402


def _tool_names(agent) -> list[str]:
    return [str(getattr(tool, "name", None) or type(tool).__name__) for tool in agent.tools]


def test_build_application_scan_agent_has_scan_tools(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    agent = build_agent_for_mode(
        "application_scan",
        datastore_path=None,
        model="gemini-2.5-flash",
    )
    assert agent.name == "en_aistudio_application_scan_agent"
    joined = " ".join(_tool_names(agent)).lower()
    assert "read_application_scan_setup" in joined
    assert "run_application_scan" in joined
