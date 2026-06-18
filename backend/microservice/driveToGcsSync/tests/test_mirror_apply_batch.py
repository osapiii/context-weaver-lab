"""
Tests for /mirror/apply-batch — only the orchestration logic; Drive download and
GCS upload are stubbed.
"""

from __future__ import annotations

import importlib
import os
import sys
import types
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def app_module(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    monkeypatch.setenv("DRIVE_MIRROR_BUCKET", "test-project-drive-mirror")
    monkeypatch.setenv("GOOGLE_DRIVE_SA_KEY_PATH", "/tmp/nonexistent.json")

    fake_storage = types.ModuleType("google.cloud.storage")
    fake_storage.Client = MagicMock()
    sys.modules.setdefault("google", types.ModuleType("google"))
    sys.modules.setdefault("google.cloud", types.ModuleType("google.cloud"))
    sys.modules["google.cloud.storage"] = fake_storage
    setattr(sys.modules["google.cloud"], "storage", fake_storage)

    fake_oauth = types.ModuleType("google.oauth2")
    fake_sa = types.ModuleType("google.oauth2.service_account")

    class _FakeCreds:
        @staticmethod
        def from_service_account_file(*_args, **_kwargs):
            return MagicMock()

    fake_sa.Credentials = _FakeCreds
    sys.modules["google.oauth2"] = fake_oauth
    sys.modules["google.oauth2.service_account"] = fake_sa
    setattr(fake_oauth, "service_account", fake_sa)

    fake_discovery = types.ModuleType("googleapiclient.discovery")
    fake_discovery.build = MagicMock()
    fake_discovery.Resource = MagicMock
    fake_errors = types.ModuleType("googleapiclient.errors")

    class _HttpError(Exception):
        pass

    fake_errors.HttpError = _HttpError
    fake_http = types.ModuleType("googleapiclient.http")
    fake_http.MediaIoBaseDownload = MagicMock()
    fake_http.MediaIoBaseUpload = MagicMock()
    fake_apiclient = types.ModuleType("googleapiclient")
    sys.modules["googleapiclient"] = fake_apiclient
    sys.modules["googleapiclient.discovery"] = fake_discovery
    sys.modules["googleapiclient.errors"] = fake_errors
    sys.modules["googleapiclient.http"] = fake_http
    setattr(fake_apiclient, "discovery", fake_discovery)
    setattr(fake_apiclient, "errors", fake_errors)
    setattr(fake_apiclient, "http", fake_http)

    here = os.path.dirname(__file__)
    sys.path.insert(0, os.path.abspath(os.path.join(here, "..")))
    for name in ("main", "gcs_mirror", "drive_client"):
        if name in sys.modules:
            del sys.modules[name]
    module = importlib.import_module("main")
    yield module


def test_apply_batch_uploads_and_returns_counts(app_module, monkeypatch):
    monkeypatch.setattr(
        app_module,
        "download_file",
        lambda *_args, **_kw: (b"DATA", "application/pdf"),
    )

    upload_calls: list[dict] = []

    def _fake_upload(**kw):
        upload_calls.append(kw)
        return f"gs://{kw['bucket']}/{kw['object_path']}"

    monkeypatch.setattr(
        app_module.apply_batch, "upload_bytes_to_mirror", _fake_upload
    )

    delete_calls: list[dict] = []

    def _fake_delete(**kw):
        delete_calls.append(kw)

    monkeypatch.setattr(app_module.apply_batch, "delete_object", _fake_delete)

    client = TestClient(app_module.app)
    resp = client.post(
        "/mirror/apply-batch",
        json={
            "items": [
                {
                    "driveFileId": "drv-A",
                    "name": "a.pdf",
                    "mimeType": "application/pdf",
                    "driveModifiedTime": "2024-05-27T01:23:45.000Z",
                    "expectedMirrorPath": (
                        "organizations/org-1/spaces/space-1/fileSpaces/fs-1/"
                        "knowledges/driveSync/drv-A/2024-05-27T01_23_45.000Z.pdf"
                    ),
                },
                {
                    "driveFileId": "drv-B",
                    "name": "b.pdf",
                    "mimeType": "application/pdf",
                    "driveModifiedTime": "2024-06-01T00:00:00.000Z",
                    "expectedMirrorPath": (
                        "organizations/org-1/spaces/space-1/fileSpaces/fs-1/"
                        "knowledges/driveSync/drv-B/2024-06-01T00_00_00.000Z.pdf"
                    ),
                    "previousMirrorPath": (
                        "organizations/org-1/spaces/space-1/fileSpaces/fs-1/"
                        "knowledges/driveSync/drv-B/2024-01-01T00_00_00.000Z.pdf"
                    ),
                },
            ],
            "deleteStaleVersions": True,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["added"] == 1
    assert body["updated"] == 1
    assert body["failed"] == 0
    assert len(upload_calls) == 2
    assert len(delete_calls) == 1
    assert delete_calls[0]["object_path"].endswith("2024-01-01T00_00_00.000Z.pdf")


def test_apply_batch_flattens_nested_items(app_module, monkeypatch):
    monkeypatch.setattr(
        app_module,
        "download_file",
        lambda *_args, **_kw: (b"DATA", "application/pdf"),
    )
    monkeypatch.setattr(
        app_module.apply_batch,
        "upload_bytes_to_mirror",
        lambda **kw: f"gs://{kw['bucket']}/{kw['object_path']}",
    )

    client = TestClient(app_module.app)
    resp = client.post(
        "/mirror/apply-batch",
        json={
            "items": [
                [
                    {
                        "driveFileId": "drv-nested",
                        "expectedMirrorPath": "o/s/f/drv-nested/x.bin",
                        "driveModifiedTime": "2024-01-01T00:00:00.000Z",
                    }
                ]
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["added"] == 1


def test_apply_batch_rejects_more_than_10(app_module):
    client = TestClient(app_module.app)
    items = [
        {
            "driveFileId": f"drv-{i}",
            "expectedMirrorPath": f"o/s/f/drv-{i}/x.bin",
            "driveModifiedTime": "2024-01-01T00:00:00.000Z",
        }
        for i in range(11)
    ]
    resp = client.post("/mirror/apply-batch", json={"items": items})
    assert resp.status_code == 400
    assert "must be <= 10" in resp.text
