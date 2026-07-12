"""Unit tests for knowledge_storage_paths (legacy test module name retained)."""

from __future__ import annotations

import pytest

from knowledge_storage_paths import (
    drive_sync_mirror_list_prefix,
    drive_sync_mirror_object_path,
    drive_sync_mirror_prefix_gs_uri,
    parse_drive_sync_mirror_blob,
    resolve_knowledge_storage_bucket,
)


def test_resolve_drive_mirror_bucket_defaults_to_firebase(monkeypatch):
    monkeypatch.delenv("DRIVE_MIRROR_BUCKET", raising=False)
    monkeypatch.delenv("FIREBASE_STORAGE_BUCKET", raising=False)
    assert resolve_knowledge_storage_bucket("my-project") == "my-project.firebasestorage.app"


def test_mirror_object_path_and_prefix():
    prefix = drive_sync_mirror_list_prefix(
        organization_id="org-1",
        space_id="space-1",
        file_space_id="fs-1",
    )
    assert prefix.endswith("/knowledges/driveSync/")
    path = drive_sync_mirror_object_path(
        organization_id="org-1",
        space_id="space-1",
        file_space_id="fs-1",
        drive_file_id="drv-1",
        drive_modified_time="2024-05-27T01:23:45.123Z",
        ext=".pdf",
    )
    assert path.startswith(prefix)
    gs = drive_sync_mirror_prefix_gs_uri(
        bucket="bk",
        organization_id="org-1",
        space_id="space-1",
        file_space_id="fs-1",
    )
    assert gs == f"gs://bk/{prefix}"


def test_parse_mirror_inventory_blob():
    prefix = drive_sync_mirror_list_prefix(
        organization_id="o",
        space_id="s",
        file_space_id="f",
    )
    name = f"{prefix}drv-A/2024-05-27T01_23_45.123Z.pdf"
    parsed = parse_drive_sync_mirror_blob(blob_name=name, list_prefix=prefix)
    assert parsed == ("drv-A", "2024-05-27T01:23:45.123Z")
