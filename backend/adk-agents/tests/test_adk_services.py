"""Tests for ADK services registry."""
from __future__ import annotations

import os

from common.services import (
    _resolve_artifact_bucket,
    _resolve_sessions_collection,
    create_adk_services,
)


def test_resolve_sessions_collection_default(monkeypatch):
    monkeypatch.delenv("FIRESTORE_ADK_SESSIONS_COLLECTION", raising=False)
    monkeypatch.delenv("FIRESTORE_SESSIONS_COLLECTION", raising=False)
    assert _resolve_sessions_collection() == "adkSessions"


def test_resolve_sessions_collection_legacy_alias(monkeypatch):
    monkeypatch.setenv("FIRESTORE_SESSIONS_COLLECTION", "slidesAgentSessions")
    monkeypatch.delenv("FIRESTORE_ADK_SESSIONS_COLLECTION", raising=False)
    assert _resolve_sessions_collection() == "slidesAgentSessions"


def test_resolve_artifact_bucket_priority(monkeypatch):
    monkeypatch.setenv("ADK_ARTIFACT_BUCKET", "adk-bucket")
    monkeypatch.setenv("GCS_ARTIFACT_BUCKET", "gcs-bucket")
    monkeypatch.setenv("FIREBASE_STORAGE_BUCKET", "firebase-bucket")
    assert _resolve_artifact_bucket() == "adk-bucket"


def test_create_adk_services_memory_backends(monkeypatch):
    monkeypatch.setenv("ADK_SESSION_BACKEND", "memory")
    monkeypatch.setenv("ADK_ARTIFACT_BACKEND", "memory")
    monkeypatch.delenv("ADK_ARTIFACT_BUCKET", raising=False)
    services = create_adk_services()
    assert services.session_service is not None
    assert services.artifact_service is not None
    assert services.bucket_name == ""
