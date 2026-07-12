"""Tests for adk_artifact_io helpers."""
from __future__ import annotations

from google.genai import types as gtypes

from common.adk_artifact_io import part_to_json_payload, safe_artifact_filename


def test_safe_artifact_filename_sanitizes_title():
    name = safe_artifact_filename("粗利分析レポート!", ".md")
    assert name.endswith(".md")
    assert "粗利分析レポート" in name


def test_part_to_json_payload_text():
    part = gtypes.Part(text="# Title")
    payload = part_to_json_payload(
        part,
        filename="doc.md",
        version=0,
        custom_metadata={"kind": "markdown_document", "title": "Doc"},
    )
    assert payload["body"] == "# Title"
    assert payload["kind"] == "markdown_document"
    assert payload["title"] == "Doc"
