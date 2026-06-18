"""
Unit tests for google-drive-workflow-kicker.

We exercise `_kick()` directly with monkey-patched GCS / Firestore / Workflows
clients so the test doesn't need real GCP credentials.
"""

from __future__ import annotations

import importlib
import os
import sys
import types
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def main_module(monkeypatch):
    """Reload the module so env vars take effect cleanly between tests."""
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    monkeypatch.setenv("WORKFLOW_LOCATION", "us-central1")
    monkeypatch.setenv("WORKFLOW_NAME", "gdrive-sync")
    monkeypatch.setenv("FIREBASE_STORAGE_BUCKET", "test-project.firebasestorage.app")

    # Stub the google.cloud modules so we don't need real credentials.
    fake_firestore = types.ModuleType("google.cloud.firestore")

    class _FakeSentinel:
        def __init__(self, name):
            self._name = name

        def __repr__(self):
            return f"<sentinel {self._name}>"

    fake_firestore.SERVER_TIMESTAMP = _FakeSentinel("SERVER_TIMESTAMP")
    fake_firestore.DELETE_FIELD = _FakeSentinel("DELETE_FIELD")
    fake_firestore.Client = MagicMock()

    fake_storage = types.ModuleType("google.cloud.storage")
    fake_storage.Client = MagicMock()

    fake_workflows_v1 = types.ModuleType("google.cloud.workflows_v1")
    fake_workflows_v1.WorkflowsClient = MagicMock()

    fake_executions_v1 = types.ModuleType(
        "google.cloud.workflows.executions_v1"
    )

    class _FakeExecution:
        def __init__(self, argument=None):
            self.argument = argument
            self.name = None

    fake_executions_v1.Execution = _FakeExecution
    fake_executions_v1.ExecutionsClient = MagicMock()

    sys.modules.setdefault("google", types.ModuleType("google"))
    sys.modules.setdefault("google.cloud", types.ModuleType("google.cloud"))
    sys.modules["google.cloud.firestore"] = fake_firestore
    sys.modules["google.cloud.storage"] = fake_storage
    sys.modules["google.cloud.workflows_v1"] = fake_workflows_v1
    # `from google.cloud import workflows_v1` requires that attribute
    setattr(sys.modules["google.cloud"], "workflows_v1", fake_workflows_v1)
    setattr(sys.modules["google.cloud"], "firestore", fake_firestore)
    setattr(sys.modules["google.cloud"], "storage", fake_storage)
    sys.modules.setdefault(
        "google.cloud.workflows", types.ModuleType("google.cloud.workflows")
    )
    sys.modules["google.cloud.workflows.executions_v1"] = fake_executions_v1
    setattr(
        sys.modules["google.cloud.workflows"],
        "executions_v1",
        fake_executions_v1,
    )

    if "main" in sys.modules:
        del sys.modules["main"]
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    module = importlib.import_module("main")
    yield module


def _wire_clients(main_module):
    mock_db = MagicMock()
    mock_storage = MagicMock()
    mock_blob = MagicMock()
    mock_storage.bucket.return_value.blob.return_value = mock_blob

    mock_executions = MagicMock()
    fake_execution = MagicMock()
    fake_execution.name = (
        "projects/test-project/locations/us-central1/workflows/"
        "gdrive-sync/executions/exec-abc"
    )
    mock_executions.create_execution.return_value = fake_execution

    with (
        patch.object(main_module, "_get_db", return_value=mock_db),
        patch.object(main_module, "_get_storage", return_value=mock_storage),
        patch.object(
            main_module, "_get_executions_client", return_value=mock_executions
        ),
    ):
        return mock_db, mock_storage, mock_blob, mock_executions, fake_execution


def test_kick_uploads_yaml_and_patches_request_doc(main_module):
    mock_db, mock_storage, mock_blob, mock_executions, fake_execution = _wire_clients(
        main_module
    )
    with (
        patch.object(main_module, "_get_db", return_value=mock_db),
        patch.object(main_module, "_get_storage", return_value=mock_storage),
        patch.object(
            main_module, "_get_executions_client", return_value=mock_executions
        ),
    ):
        result = main_module._kick(
            {
                "requestPath": (
                    "organizations/org-1/spaces/space-1/requests/"
                    "googleDriveSyncRequests/logs/req-123"
                ),
                "requestId": "req-123",
                "operationType": "syncFolder",
                "input": {
                    "rootFolderId": "folder-root",
                    "targetFolderId": None,
                    "fileSpaceId": "store-1",
                    "description": "test",
                    "importIds": ["a", "b"],
                    "removeIds": ["c"],
                },
                "organizationId": "org-1",
                "operationMetadata": {"organizationId": "org-1", "spaceId": "space-1"},
            }
        )

    assert result["accepted"] is True
    assert result["executionName"] == fake_execution.name
    assert result["executionId"] == "exec-abc"
    assert result["consoleUrl"].endswith("/execution/exec-abc?project=test-project")
    assert result["inputArtifactUri"].startswith(
        "gs://test-project.firebasestorage.app/organizations/org-1/spaces/space-1/knowledges/driveSync/workflowInputs/"
    )

    mock_blob.upload_from_string.assert_called_once()
    yaml_text, _ = mock_blob.upload_from_string.call_args.args[0], None
    assert "importIds" in yaml_text
    assert "removeIds" in yaml_text

    # Firestore was patched twice (inputArtifactUri + workflow meta)
    assert mock_db.document.call_count >= 2
    mock_executions.create_execution.assert_called_once()


def test_kick_rejects_legacy_batch_type(main_module):
    with pytest.raises(ValueError):
        main_module._kick(
            {
                "requestPath": "organizations/o/spaces/s/requests/x/logs/r",
                "requestId": "r",
                "operationType": "syncFolderBatch",
                "input": {},
            }
        )


def test_kick_requires_request_path(main_module):
    with pytest.raises(ValueError):
        main_module._kick({"requestId": "r", "operationType": "syncFolder"})


# ---------------------------------------------------------------------------
# _fetch_input_artifact / /inspect-input
# ---------------------------------------------------------------------------


def _make_mock_storage_for_inspect(
    *, content_bytes: bytes | None, content_type: str = "application/x-yaml"
):
    """Build a mock storage client returning a blob with `content_bytes`.

    If `content_bytes is None`, `blob.exists()` returns False.
    """
    import datetime as _dt

    mock_storage = MagicMock()
    mock_blob = MagicMock()
    if content_bytes is None:
        mock_blob.exists.return_value = False
    else:
        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.return_value = content_bytes
        mock_blob.content_type = content_type
        mock_blob.updated = _dt.datetime(2026, 5, 27, 12, 34, 56)
    mock_storage.bucket.return_value.blob.return_value = mock_blob
    return mock_storage, mock_blob


def test_parse_gs_uri_valid(main_module):
    assert main_module._parse_gs_uri("gs://bucket/path/to/object.yml") == (
        "bucket",
        "path/to/object.yml",
    )


def test_parse_gs_uri_rejects_invalid(main_module):
    with pytest.raises(ValueError):
        main_module._parse_gs_uri("https://example.com/object")
    with pytest.raises(ValueError):
        main_module._parse_gs_uri("gs://only-bucket")
    with pytest.raises(ValueError):
        main_module._parse_gs_uri("")


def test_fetch_input_artifact_with_gs_uri_returns_manifest(main_module):
    payload = b'{"importIds": ["a", "b"], "removeIds": []}'
    mock_storage, _ = _make_mock_storage_for_inspect(content_bytes=payload)
    with patch.object(main_module, "_get_storage", return_value=mock_storage):
        result = main_module._fetch_input_artifact(
            organization_id="",
            space_id="",
            request_id="",
            gs_uri="gs://test-project.firebasestorage.app/organizations/org-1/spaces/space-1/knowledges/driveSync/workflowInputs/req-1.yml",
        )
    assert result["found"] is True
    assert result["bucket"] == "test-project.firebasestorage.app"
    assert result["objectPath"] == (
        "organizations/org-1/spaces/space-1/knowledges/driveSync/workflowInputs/req-1.yml"
    )
    assert result["sizeBytes"] == len(payload)
    assert result["contentType"] == "application/x-yaml"
    assert result["manifest"] == {"importIds": ["a", "b"], "removeIds": []}


def test_fetch_input_artifact_with_org_and_request_id(main_module):
    payload = b'{"operationType": "syncFolder"}'
    mock_storage, _ = _make_mock_storage_for_inspect(content_bytes=payload)
    with patch.object(main_module, "_get_storage", return_value=mock_storage):
        result = main_module._fetch_input_artifact(
            organization_id="org-1",
            space_id="space-1",
            request_id="req-1",
            gs_uri=None,
        )
    assert result["found"] is True
    assert result["objectPath"] == (
        "organizations/org-1/spaces/space-1/knowledges/driveSync/workflowInputs/req-1.yml"
    )
    assert result["manifest"] == {"operationType": "syncFolder"}


def test_fetch_input_artifact_rejects_foreign_bucket(main_module):
    mock_storage, _ = _make_mock_storage_for_inspect(content_bytes=b"{}")
    with patch.object(main_module, "_get_storage", return_value=mock_storage):
        with pytest.raises(ValueError):
            main_module._fetch_input_artifact(
                organization_id="",
                space_id="",
                request_id="",
                gs_uri="gs://some-other-bucket/x.yml",
            )


def test_fetch_input_artifact_missing_blob_returns_not_found(main_module):
    mock_storage, _ = _make_mock_storage_for_inspect(content_bytes=None)
    with patch.object(main_module, "_get_storage", return_value=mock_storage):
        result = main_module._fetch_input_artifact(
            organization_id="org-1",
            space_id="space-1",
            request_id="missing",
            gs_uri=None,
        )
    assert result["found"] is False
    assert result["manifest"] is None
    assert result["objectPath"] == (
        "organizations/org-1/spaces/space-1/knowledges/driveSync/workflowInputs/missing.yml"
    )


def test_fetch_input_artifact_handles_non_json_payload(main_module):
    payload = b"not-valid-json"
    mock_storage, _ = _make_mock_storage_for_inspect(content_bytes=payload)
    with patch.object(main_module, "_get_storage", return_value=mock_storage):
        result = main_module._fetch_input_artifact(
            organization_id="org-1",
            space_id="space-1",
            request_id="req-x",
            gs_uri=None,
        )
    assert result["found"] is True
    assert result["manifest"] == {"__raw__": "not-valid-json"}


def test_fetch_input_artifact_requires_org_and_request_when_no_uri(main_module):
    with pytest.raises(ValueError):
        main_module._fetch_input_artifact(
            organization_id="",
            space_id="",
            request_id="",
            gs_uri=None,
        )
