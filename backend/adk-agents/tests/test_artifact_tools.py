"""Tests for common artifact tools."""
from __future__ import annotations

from common.artifact_tools import add_html_document, add_markdown_document


def test_add_markdown_document_returns_artifact():
    result = add_markdown_document("Summary", "# Title\n\nBody")
    assert result["ok"] is True
    artifacts = result["artifacts"]
    assert len(artifacts) == 1
    assert artifacts[0]["kind"] == "markdown_document"
    assert artifacts[0]["title"] == "Summary"
    assert artifacts[0]["body"].startswith("# Title")


def test_add_html_document_returns_artifact():
    html = "<!DOCTYPE html><html><body><h1>Report</h1></body></html>"
    result = add_html_document("HTML Report", html)
    assert result["ok"] is True
    artifacts = result["artifacts"]
    assert len(artifacts) == 1
    assert artifacts[0]["kind"] == "html_document"
    assert artifacts[0]["title"] == "HTML Report"
    assert "Report" in artifacts[0]["body"]
