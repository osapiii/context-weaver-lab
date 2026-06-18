"""
Unit tests for gcs_mirror helpers (no real GCS / Drive needed).
"""

from __future__ import annotations

import importlib
import os
import sys
import types
from unittest.mock import MagicMock

import pytest


@pytest.fixture()
def gcs_mirror_module(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")

    fake_storage = types.ModuleType("google.cloud.storage")
    fake_storage.Client = MagicMock()
    sys.modules.setdefault("google", types.ModuleType("google"))
    sys.modules.setdefault("google.cloud", types.ModuleType("google.cloud"))
    sys.modules["google.cloud.storage"] = fake_storage
    setattr(sys.modules["google.cloud"], "storage", fake_storage)

    here = os.path.dirname(__file__)
    sys.path.insert(0, os.path.abspath(os.path.join(here, "..")))
    if "gcs_mirror" in sys.modules:
        del sys.modules["gcs_mirror"]
    module = importlib.import_module("gcs_mirror")
    yield module


def test_mirror_object_path_replaces_colons(gcs_mirror_module):
    path = gcs_mirror_module.mirror_object_path(
        organization_id="org-1",
        space_id="space-1",
        file_space_id="fs-1",
        drive_file_id="drv-1",
        drive_modified_time="2024-05-27T01:23:45.123Z",
        ext=".pdf",
    )
    assert path == (
        "organizations/org-1/spaces/space-1/fileSpaces/fs-1/knowledges/driveSync/"
        "drv-1/2024-05-27T01_23_45.123Z.pdf"
    )


def test_mirror_prefix(gcs_mirror_module):
    p = gcs_mirror_module.mirror_prefix(
        bucket="bk",
        organization_id="org-1",
        space_id="space-1",
        file_space_id="fs-1",
    )
    assert p == (
        "gs://bk/organizations/org-1/spaces/space-1/fileSpaces/fs-1/knowledges/driveSync/"
    )


def test_mirror_object_path_handles_missing_timestamp(gcs_mirror_module):
    path = gcs_mirror_module.mirror_object_path(
        organization_id="o",
        space_id="s",
        file_space_id="f",
        drive_file_id="d",
        drive_modified_time="",
    )
    assert path.endswith("/unknown.bin")


def test_list_mirror_inventory_groups_by_drive_file_id(
    gcs_mirror_module, monkeypatch
):
    prefix = (
        "organizations/org-1/spaces/space-1/fileSpaces/fs-1/knowledges/driveSync/"
    )
    fake_blob_a1 = MagicMock(
        name=f"{prefix}drv-A/2024-05-27T01_23_45.123Z.pdf",
        size=1234,
        content_type="application/pdf",
        md5_hash="abc",
    )
    fake_blob_a1.name = f"{prefix}drv-A/2024-05-27T01_23_45.123Z.pdf"
    fake_blob_a2 = MagicMock(
        size=2222,
        content_type="application/pdf",
        md5_hash="def",
    )
    fake_blob_a2.name = f"{prefix}drv-A/2024-06-01T00_00_00.000Z.pdf"
    fake_blob_b1 = MagicMock(
        size=99, content_type="text/csv", md5_hash="b"
    )
    fake_blob_b1.name = f"{prefix}drv-B/2024-05-27T01_23_45.123Z.csv"

    fake_client = MagicMock()
    fake_client.list_blobs.return_value = [fake_blob_a1, fake_blob_a2, fake_blob_b1]
    monkeypatch.setattr(
        gcs_mirror_module, "_get_storage_client", lambda: fake_client
    )

    inventory = gcs_mirror_module.list_mirror_inventory(
        bucket="bk",
        organization_id="org-1",
        space_id="space-1",
        file_space_id="fs-1",
    )
    assert sorted(inventory.keys()) == ["drv-A", "drv-B"]
    assert len(inventory["drv-A"]) == 2
    assert inventory["drv-B"][0]["objectPath"] == fake_blob_b1.name
