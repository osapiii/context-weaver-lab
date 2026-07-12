"""Tests for Firestore global system prompt loader."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from common.user_settings_auth import load_user_global_system_prompt


@pytest.fixture
def mock_firestore(monkeypatch):
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {"prompt": "  私はシーライフの社長です  "}

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

    monkeypatch.setattr(
        "common.user_settings_auth.fb_firestore.client", lambda: client
    )
    monkeypatch.setattr(
        "common.user_settings_auth._ensure_firebase_initialized", lambda: None
    )
    return client


def test_load_user_global_system_prompt(mock_firestore):
    assert load_user_global_system_prompt("uid-abc") == "私はシーライフの社長です"


def test_load_user_pinned_knowledge(mock_firestore):
    from common.user_settings_auth import load_user_pinned_knowledge

    snap = mock_firestore.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value
    snap.exists = True
    snap.to_dict.return_value = {
        "items": [
            {
                "id": "doc-1",
                "name": "会社概要.pdf",
                "gcs_path": "gs://bucket/path.pdf",
                "mime_type": "application/pdf",
            }
        ]
    }
    items = load_user_pinned_knowledge("uid-abc")
    assert len(items) == 1
    assert items[0]["gcs_path"] == "gs://bucket/path.pdf"
