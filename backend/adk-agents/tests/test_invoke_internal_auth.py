"""Tests for internal ADK invoke auth."""
from __future__ import annotations

from common import invoke_internal_auth


def test_internal_invoke_allows_adc_without_gemini_byok(monkeypatch):
    monkeypatch.setenv("ADK_INTERNAL_INVOKE_SECRET", "secret")
    monkeypatch.setattr(
        invoke_internal_auth,
        "resolve_request_gemini_api_key",
        lambda _uid: None,
    )
    monkeypatch.setattr(
        invoke_internal_auth,
        "resolve_request_openai_api_key",
        lambda _uid: None,
    )
    monkeypatch.setattr(
        invoke_internal_auth,
        "load_user_global_system_prompt",
        lambda _uid: None,
    )
    monkeypatch.setattr(
        invoke_internal_auth,
        "load_user_pinned_knowledge",
        lambda _uid: [],
    )

    user = invoke_internal_auth.require_user_or_internal_invoke(
        x_en_aistudio_internal_invoke="secret",
        x_en_aistudio_requested_uid="user-1",
    )

    assert user["uid"] == "user-1"
    assert user["internal_invoke"] is True
    assert user["auth_disabled"] is True
    assert user["has_gemini_api_key"] is False
