"""Tests for /inspect-input (workflow input artifact debug)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_inspect_input_endpoint_defined():
    text = (ROOT / "main.py").read_text(encoding="utf-8")
    assert '@app.get("/inspect-input")' in text
    assert "workflow_input_inspect" in text


def test_fetch_workflow_input_artifact_with_gs_uri():
    import workflow_input_inspect as wii

    payload = b'{"url": "https://example.com"}'
    mock_storage = MagicMock()
    mock_blob = MagicMock()
    mock_blob.exists.return_value = True
    mock_blob.download_as_bytes.return_value = payload
    mock_blob.content_type = "application/x-yaml"
    mock_blob.updated = None
    mock_storage.bucket.return_value.blob.return_value = mock_blob

    result = wii.fetch_workflow_input_artifact(
        storage_client=mock_storage,
        gs_uri="gs://test-bucket/org-1/req-1.yml",
        allowed_buckets=frozenset({"test-bucket"}),
    )
    assert result["found"] is True
    assert result["manifest"] == {"url": "https://example.com"}


def test_fetch_rejects_unknown_bucket():
    import workflow_input_inspect as wii

    mock_storage = MagicMock()
    with pytest.raises(ValueError, match="allowed buckets"):
        wii.fetch_workflow_input_artifact(
            storage_client=mock_storage,
            gs_uri="gs://other-bucket/org-1/req-1.yml",
            allowed_buckets=frozenset({"test-bucket"}),
        )
