"""Tests for workflow_input_inspect."""

from __future__ import annotations

import datetime as dt
from unittest.mock import MagicMock

import pytest

from workflow_input_inspect import fetch_workflow_input_artifact, parse_gs_uri


def _mock_storage(*, content: bytes | None, content_type: str = "application/x-yaml"):
    mock_storage = MagicMock()
    mock_blob = MagicMock()
    if content is None:
        mock_blob.exists.return_value = False
    else:
        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.return_value = content
        mock_blob.content_type = content_type
        mock_blob.updated = dt.datetime(2026, 5, 27, 12, 0, 0)
    mock_storage.bucket.return_value.blob.return_value = mock_blob
    return mock_storage


def test_parse_gs_uri_valid():
    assert parse_gs_uri("gs://my-bucket/org/req.yml") == (
        "my-bucket",
        "org/req.yml",
    )


def test_parse_gs_uri_rejects_invalid():
    with pytest.raises(ValueError):
        parse_gs_uri("https://example.com/x")


def test_fetch_with_gs_uri():
    payload = b'{"foo": 1}'
    storage = _mock_storage(content=payload)
    result = fetch_workflow_input_artifact(
        storage_client=storage,
        gs_uri="gs://my-bucket/org/req.yml",
        allowed_buckets=frozenset({"my-bucket"}),
    )
    assert result["found"] is True
    assert result["manifest"] == {"foo": 1}


def test_fetch_rejects_wrong_bucket():
    storage = _mock_storage(content=b"{}")
    with pytest.raises(ValueError, match="allowed buckets"):
        fetch_workflow_input_artifact(
            storage_client=storage,
            gs_uri="gs://other-bucket/org/req.yml",
            allowed_buckets=frozenset({"my-bucket"}),
        )


def test_fetch_conventional_path():
    payload = b'{"bar": 2}'
    storage = _mock_storage(content=payload)

    def resolve():
        return ("my-bucket", "org-1/req-1.yml")

    result = fetch_workflow_input_artifact(
        storage_client=storage,
        gs_uri=None,
        allowed_buckets=frozenset({"my-bucket"}),
        resolve_conventional_path=resolve,
    )
    assert result["found"] is True
    assert result["objectPath"] == "org-1/req-1.yml"
