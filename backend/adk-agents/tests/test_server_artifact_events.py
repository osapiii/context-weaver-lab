"""Tests for artifact SSE event helpers."""
from __future__ import annotations

from common.adk_artifact_io import emit_tool_artifact_events


def test_emit_tool_artifact_events_refs_and_inline():
    events = emit_tool_artifact_events(
        {
            "artifact_refs": [
                {"filename": "a.md", "version": 0, "kind": "markdown_document"}
            ],
            "artifacts": [{"kind": "citation", "title": "Source"}],
        }
    )
    assert events == [
        (
            "artifact_ref",
            {"filename": "a.md", "version": 0, "kind": "markdown_document"},
        ),
        ("artifact", {"kind": "citation", "title": "Source"}),
    ]
