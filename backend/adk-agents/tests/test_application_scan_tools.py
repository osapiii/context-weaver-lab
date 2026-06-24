"""Tests for application_scan tools."""
from __future__ import annotations

from application_scan.tools import (
    _looks_like_email_signin_page,
    _normalize_url,
    _screen_observation_markdown,
    read_application_scan_setup,
)


class FakeContext:
    def __init__(self, state):
        self.state = state


def test_read_application_scan_setup_redacts_credentials():
    ctx = FakeContext(
        {
            "application_scan": {
                "phase": "setup",
                "setup": {
                    "auth_mode": "credentials",
                    "start_url": "https://example.com/app",
                    "username": "demo@example.com",
                    "password": "secret",
                    "email_hint": "demo@example.com",
                    "authenticated_url": "https://example.com/__/auth/action?oobCode=secret-code",
                    "max_pages": 200,
                    "capture_screenshots": True,
                    "explore_variants": True,
                    "max_variants_per_screen": 20,
                    "max_steps_per_screen": 100,
                    "allow_chat_send": True,
                    "variant_only": True,
                    "target_screen_id": "screen-home",
                    "target_screen_url": "https://example.com/app/dashboard",
                    "target_route_key": "/app/dashboard",
                    "file_space_id": "fs1",
                    "application_id": "app-1",
                    "application_key": "APP",
                    "application_name": "Example App",
                    "repo_full_name": "enostech/example",
                },
            }
        }
    )
    result = read_application_scan_setup(ctx)
    assert result["ok"] is True
    assert result["auth_mode"] == "credentials"
    assert result["has_username"] is True
    assert result["has_password"] is True
    assert result["has_email_hint"] is True
    assert result["has_authenticated_url"] is True
    assert result["max_pages"] == 50
    assert result["explore_variants"] is True
    assert result["max_variants_per_screen"] == 10
    assert result["max_steps_per_screen"] == 30
    assert result["allow_chat_send"] is True
    assert result["variant_only"] is True
    assert result["target_screen_id"] == "screen-home"
    assert result["target_screen_url"] == "https://example.com/app/dashboard"
    assert result["target_route_key"] == "/app/dashboard"
    assert result["application_id"] == "app-1"
    assert result["repo_full_name"] == "enostech/example"
    assert "secret" not in str(result)
    assert "oobCode" not in str(result)


def test_read_application_scan_setup_requires_start_url():
    result = read_application_scan_setup(FakeContext({"application_scan": {"setup": {}}}))
    assert result["ok"] is False
    assert result["missing"] == ["start_url"]


def test_read_application_scan_setup_allows_email_link_without_start_url():
    result = read_application_scan_setup(
        FakeContext(
            {
                "application_scan": {
                    "setup": {
                        "auth_mode": "email_link_manual",
                        "authenticated_url": "https://example.com/__/auth/action?oobCode=secret-code",
                    },
                }
            }
        )
    )

    assert result["ok"] is True
    assert result["missing"] == []
    assert result["has_authenticated_url"] is True
    assert "oobCode" not in str(result)


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


def test_looks_like_email_signin_page_detects_unfinished_email_auth():
    assert _looks_like_email_signin_page(
        "https://haiff-production.web.app/admin/signin/?mode=signIn",
        "会社メールアドレス\nログインリンクを送信",
    )
    assert not _looks_like_email_signin_page(
        "https://haiff-production.web.app/admin",
        "こんばんは、今日はどうしますか?",
    )


def test_screen_observation_markdown_contains_searchable_context():
    body = _screen_observation_markdown(
        application_name="Example App",
        application_id="app-1",
        application_key="APP",
        repo_full_name="enostech/example",
        scan_id="scan-1",
        page_index=1,
        url="https://example.com/app",
        title="Dashboard",
        text_preview="Create workspace\nInvite members",
        screenshot_filename="application_scan_001_screenshot.png",
    )

    assert "# Screen 001: Dashboard" in body
    assert "Application ID: app-1" in body
    assert "Repository: enostech/example" in body
    assert "Route Key: /app" in body
    assert "Create workspace" in body
    assert "application_scan_001_screenshot.png" in body
