"""Tests for web_tools.fetch_web_page."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from common.web_tools import fetch_web_page


def test_fetch_web_page_rejects_non_http_url():
    result = fetch_web_page("file:///etc/passwd")
    assert result["ok"] is False
    assert "http" in result["error"]


def test_fetch_web_page_rejects_localhost():
    result = fetch_web_page("http://127.0.0.1/admin")
    assert result["ok"] is False


@patch("common.web_tools.requests.get")
def test_fetch_web_page_extracts_html_text(mock_get: MagicMock):
    mock_get.return_value = MagicMock(
        status_code=200,
        headers={"Content-Type": "text/html; charset=utf-8"},
        text=(
            "<html><head><title>Example Corp</title></head>"
            "<body><h1>会社概要</h1><p>本社は東京都です。</p></body></html>"
        ),
        raise_for_status=MagicMock(),
    )

    result = fetch_web_page("https://example.com/about")
    assert result["ok"] is True
    assert result["title"] == "Example Corp"
    assert "本社は東京都" in result["text"]
    assert result["url"] == "https://example.com/about"
