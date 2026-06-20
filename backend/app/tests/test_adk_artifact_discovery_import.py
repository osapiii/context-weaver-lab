"""Tests for ADK artifact → Agent Search registration helper."""
from __future__ import annotations

from lib.adk_artifact_catalog import ArtifactDescriptor
from lib.adk_artifact_publish import maybe_register_artifact_to_agent_search


def _descriptor() -> ArtifactDescriptor:
    return ArtifactDescriptor(
        artifact_id="abc123",
        kind="json_document",
        adk_filename="application_scan_sitemap.json",
        adk_version=0,
        source_gcs_path="gs://adk-bucket/app/user/session/file/0",
        storage_gcs_path="gs://storage-bucket/organizations/org/spaces/space/adkSessions/s/artifacts/file/v0",
        content_type="application/json; charset=utf-8",
        name="application_scan_sitemap.json",
        bytes=100,
    )


def test_maybe_register_artifact_skips_without_metadata(monkeypatch):
    monkeypatch.setenv("CONTEXT_STORE_SERVICE_URL", "https://context-store.example")
    result = maybe_register_artifact_to_agent_search(
        descriptor=_descriptor(),
        metadata={},
        organization_id="org",
        space_id="space",
        uid="user",
    )
    assert result is None


def test_maybe_register_artifact_posts_to_context_store(monkeypatch):
    calls = []

    class Response:
        status_code = 200
        text = '{"ok":true}'

    def fake_post(url, json, timeout):
        calls.append((url, json, timeout))
        return Response()

    monkeypatch.setenv("CONTEXT_STORE_SERVICE_URL", "https://context-store.example/")
    monkeypatch.setattr("lib.adk_artifact_publish.requests.post", fake_post)
    result = maybe_register_artifact_to_agent_search(
        descriptor=_descriptor(),
        metadata={
            "agentSearchImport": "true",
            "fileSpaceId": "fs1",
            "scanId": "scan-1",
        },
        organization_id="org",
        space_id="space",
        uid="user",
    )
    assert result and result["status"] == "queued"
    assert calls[0][0] == "https://context-store.example/context-store/fs1/upload"
    assert calls[0][1]["input"]["bucketName"] == "storage-bucket"
    assert calls[0][1]["input"]["documentId"] == "adk_abc123"
