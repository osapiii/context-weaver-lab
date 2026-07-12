"""Tests for ADK artifact → Agent Search registration helper."""
from __future__ import annotations

from lib.adk_artifact_catalog import ArtifactDescriptor
from lib.adk_artifact_publish import (
    maybe_register_artifact_to_agent_search,
    upsert_storyvault_source_asset,
)


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
            "source": "storyvault-application-scan-sitemap",
            "scanId": "scan-1",
            "applicationId": "app-1",
            "applicationKey": "APP",
            "applicationName": "Example App",
            "repoFullName": "enostech/example",
            "sourceAssetId": "source-asset-sitemap",
        },
        organization_id="org",
        space_id="space",
        uid="user",
    )
    assert result and result["status"] == "queued"
    assert calls[0][0] == "https://context-store.example/context-store/fs1/upload"
    assert calls[0][1]["input"]["bucketName"] == "storage-bucket"
    assert calls[0][1]["input"]["documentId"] == "adk_abc123"
    custom = {
        item["key"]: item["stringValue"]
        for item in calls[0][1]["input"]["customMetadata"]
    }
    assert custom["source"] == "storyvault-application-scan-sitemap"
    assert custom["applicationId"] == "app-1"
    assert custom["sourceAssetId"] == "source-asset-sitemap"


def test_upsert_storyvault_source_asset_catalog_doc():
    writes = []

    class Snap:
        exists = False

    class Ref:
        def get(self):
            return Snap()

        def set(self, payload, merge):
            writes.append((payload, merge))

    class FakeDb:
        def __init__(self):
            self.path = ""

        def document(self, path):
            self.path = path
            return Ref()

    db = FakeDb()
    upsert_storyvault_source_asset(
        db,
        descriptor=_descriptor(),
        metadata={
            "agentSearchImport": "true",
            "fileSpaceId": "fs1",
            "source": "storyvault-application-screenshot-observation",
            "scanId": "scan-1",
            "phase": "screen_observation",
            "url": "https://example.com/app",
            "title": "Application screen observation 001",
            "applicationId": "app-1",
            "applicationKey": "APP",
            "applicationName": "Example App",
            "repoFullName": "enostech/example",
            "sourceAssetId": "source-asset-screen-001",
            "screenshotFilename": "application_scan_001_screenshot.png",
        },
        organization_id="org",
        space_id="space",
        discovery_import={"status": "queued", "documentId": "adk_abc123"},
    )

    assert db.path.endswith("/storyVaultSourceAssets/source-asset-screen-001")
    assert writes
    payload, merge = writes[0]
    assert merge is True
    assert payload["applicationId"] == "app-1"
    assert payload["sourceType"] == "application_screenshot"
    assert payload["discoveryStatus"] == "queued"
    assert payload["metadata"]["screenshotFilename"] == "application_scan_001_screenshot.png"


def test_upsert_storyvault_source_asset_screen_variant_metadata():
    writes = []

    class Snap:
        exists = False

    class Ref:
        def get(self):
            return Snap()

        def set(self, payload, merge):
            writes.append((payload, merge))

    class FakeDb:
        def __init__(self):
            self.path = ""

        def document(self, path):
            self.path = path
            return Ref()

    db = FakeDb()
    upsert_storyvault_source_asset(
        db,
        descriptor=_descriptor(),
        metadata={
            "agentSearchImport": "true",
            "fileSpaceId": "fs1",
            "source": "storyvault-application-screen-variant-observation",
            "scanId": "scan-1",
            "phase": "screen_variant",
            "screenUrl": "https://example.com/app",
            "routeKey": "/app",
            "title": "Application screen variant",
            "applicationId": "app-1",
            "applicationKey": "APP",
            "applicationName": "Example App",
            "repoFullName": "enostech/example",
            "sourceAssetId": "source-asset-variant-001",
            "screenId": "screen-001",
            "variantId": "variant-001",
            "captureKind": "screen_variant",
            "captureMethod": "gemini_computer_use",
            "variantKind": "menu_open",
            "parentScreenAssetId": "source-asset-screen-001",
            "interactionSteps": '[{"step":1,"action":"click_at"}]',
            "screenshotFilename": "application_screen_001_variant_01_screenshot.png",
        },
        organization_id="org",
        space_id="space",
        discovery_import={"status": "queued", "documentId": "adk_abc123"},
    )

    assert db.path.endswith("/storyVaultSourceAssets/source-asset-variant-001")
    payload, merge = writes[0]
    assert merge is True
    assert payload["sourceType"] == "application_screen_variant"
    assert payload["metadata"]["variantKind"] == "menu_open"
    assert payload["metadata"]["parentScreenAssetId"] == "source-asset-screen-001"
    assert payload["metadata"]["interactionSteps"] == '[{"step":1,"action":"click_at"}]'
