"""Tests for BYOK auth helpers."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from common.byok_auth import (
    load_user_gemini_api_key,
    load_user_openai_api_key,
    resolve_request_gemini_api_key,
    resolve_request_openai_api_key,
)


@pytest.fixture
def mock_firestore(monkeypatch):
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {"apiKey": "  test-key-123  "}

    doc_ref = MagicMock()
    doc_ref.get.return_value = snap

    secrets_col = MagicMock()
    secrets_col.document.return_value = doc_ref

    user_doc = MagicMock()
    user_doc.collection.return_value = secrets_col

    users_col = MagicMock()
    users_col.document.return_value = user_doc

    client = MagicMock()
    client.collection.return_value = users_col

    monkeypatch.setattr("common.byok_auth.fb_firestore.client", lambda: client)
    monkeypatch.setattr("common.byok_auth._ensure_firebase_initialized", lambda: None)
    return client


def test_load_user_gemini_api_key(mock_firestore):
    assert load_user_gemini_api_key("uid-abc") == "test-key-123"


def test_resolve_request_gemini_api_key_prefers_firestore(mock_firestore, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    assert resolve_request_gemini_api_key("uid-abc") == "test-key-123"


def test_resolve_request_gemini_api_key_env_fallback(monkeypatch):
    monkeypatch.setattr(
        "common.byok_auth.load_user_gemini_api_key", lambda uid: None
    )
    monkeypatch.setenv("GEMINI_API_KEY", "env-dev-key")
    assert resolve_request_gemini_api_key("uid-abc") == "env-dev-key"


def test_load_user_openai_api_key(mock_firestore):
    assert load_user_openai_api_key("uid-abc") == "test-key-123"


def test_resolve_request_openai_api_key_env_fallback(monkeypatch):
    monkeypatch.setattr(
        "common.byok_auth.load_user_openai_api_key", lambda uid: None
    )
    monkeypatch.setenv("OPENAI_API_KEY", "sk-env-dev")
    assert resolve_request_openai_api_key("uid-abc") == "sk-env-dev"
