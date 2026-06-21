"""Tests for application_scan tools."""
from __future__ import annotations

from application_scan.tools import _normalize_url, read_application_scan_setup


class FakeContext:
    def __init__(self, state):
        self.state = state


def test_read_application_scan_setup_redacts_credentials():
    ctx = FakeContext(
        {
            "application_scan": {
                "phase": "setup",
                "setup": {
                    "start_url": "https://example.com/app",
                    "username": "demo@example.com",
                    "password": "secret",
                    "max_pages": 200,
                    "capture_screenshots": True,
                    "file_space_id": "fs1",
                },
            }
        }
    )
    result = read_application_scan_setup(ctx)
    assert result["ok"] is True
    assert result["has_username"] is True
    assert result["has_password"] is True
    assert result["max_pages"] == 50
    assert "secret" not in str(result)


def test_read_application_scan_setup_requires_start_url():
    result = read_application_scan_setup(FakeContext({"application_scan": {"setup": {}}}))
    assert result["ok"] is False
    assert result["missing"] == ["start_url"]


def test_normalize_url_ignores_query_and_fragment():
    assert (
        _normalize_url("https://example.com/?business=0#service")
        == "https://example.com/"
    )
    assert (
        _normalize_url("?business=1#section", base_url="https://example.com/")
        == "https://example.com/"
    )
    assert (
        _normalize_url("/news/article?utm_source=x", base_url="https://example.com/")
        == "https://example.com/news/article"
    )
