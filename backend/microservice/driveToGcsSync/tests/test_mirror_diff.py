"""
Integration-ish tests for /mirror/diff endpoint, exercised via FastAPI TestClient.
"""

from __future__ import annotations

import importlib
import os
import sys
import types
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

_MIRROR_PREFIX = (
    "organizations/org-1/spaces/space-1/fileSpaces/fs-1/knowledges/driveSync/"
)


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
    for name in ("main", "gcs_mirror", "drive_client", "knowledge_storage_paths"):
        if name in sys.modules:
            del sys.modules[name]
    module = importlib.import_module("main")
    yield module


def test_mirror_diff_to_add_when_no_mirror(app_module, monkeypatch):
    monkeypatch.setattr(
        app_module,
        "list_mirror_inventory",
        lambda **_: {},
    )
    client = TestClient(app_module.app)
    resp = client.post(
        "/mirror/diff",
        json={
            "organizationId": "org-1",
            "spaceId": "space-1",
            "fileSpaceId": "fs-1",
            "operationType": "syncFolder",
            "driveFiles": [
                {
                    "id": "drv-A",
                    "name": "a.pdf",
                    "mimeType": "application/pdf",
                    "modifiedTime": "2024-05-27T01:23:45.000Z",
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["counts"]["toAdd"] == 1
    assert body["counts"]["toUpdate"] == 0
    assert body["counts"]["toRemove"] == 0
    assert body["toAdd"][0]["driveFileId"] == "drv-A"
    assert body["toAdd"][0]["expectedMirrorPath"].startswith(
        f"{_MIRROR_PREFIX}drv-A/"
    )


def test_mirror_diff_to_update_when_modified_time_newer(app_module, monkeypatch):
    monkeypatch.setattr(
        app_module,
        "list_mirror_inventory",
        lambda **_: {
            "drv-A": [
                {
                    "objectPath": f"{_MIRROR_PREFIX}drv-A/2024-01-01T00_00_00.000Z.pdf",
                    "driveModifiedTime": "2024-01-01T00:00:00.000Z",
                    "size": 1,
                    "contentType": "application/pdf",
                    "md5": "x",
                }
            ]
        },
    )
    client = TestClient(app_module.app)
    resp = client.post(
        "/mirror/diff",
        json={
            "organizationId": "org-1",
            "spaceId": "space-1",
            "fileSpaceId": "fs-1",
            "operationType": "syncFolder",
            "driveFiles": [
                {
                    "id": "drv-A",
                    "name": "a.pdf",
                    "mimeType": "application/pdf",
                    "modifiedTime": "2024-05-27T01:23:45.000Z",
                }
            ],
        },
    )
    body = resp.json()
    assert body["counts"]["toUpdate"] == 1
    assert body["toUpdate"][0]["previousMirrorPath"].startswith(
        f"{_MIRROR_PREFIX}drv-A/"
    )


def test_mirror_diff_to_remove_only_for_sync_folder(app_module, monkeypatch):
    monkeypatch.setattr(
        app_module,
        "list_mirror_inventory",
        lambda **_: {
            "drv-stale": [
                {
                    "objectPath": f"{_MIRROR_PREFIX}drv-stale/2024-01-01T00_00_00.000Z.bin",
                    "driveModifiedTime": "2024-01-01T00:00:00.000Z",
                    "size": 1,
                    "contentType": None,
                    "md5": None,
                }
            ]
        },
    )
    client = TestClient(app_module.app)

    # syncSingleFolder should NOT mark stale for removal
    resp_single = client.post(
        "/mirror/diff",
        json={
            "organizationId": "org-1",
            "spaceId": "space-1",
            "fileSpaceId": "fs-1",
            "operationType": "syncSingleFolder",
            "driveFiles": [],
        },
    )
    assert resp_single.json()["counts"]["toRemove"] == 0

    # syncFolder DOES mark stale for removal
    resp_full = client.post(
        "/mirror/diff",
        json={
            "organizationId": "org-1",
            "spaceId": "space-1",
            "fileSpaceId": "fs-1",
            "operationType": "syncFolder",
            "driveFiles": [],
        },
    )
    body = resp_full.json()
    assert body["counts"]["toRemove"] == 1
    assert body["toRemove"][0]["driveFileId"] == "drv-stale"
