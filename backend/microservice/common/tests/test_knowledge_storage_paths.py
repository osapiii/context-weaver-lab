"""Unit tests for knowledge_storage_paths."""

from __future__ import annotations

import pytest

from knowledge_storage_paths import (
    drive_sync_mirror_list_prefix,
    drive_sync_mirror_object_path,
    drive_sync_workflow_input_object_path,
    manual_upload_object_path,
    parse_drive_sync_mirror_blob,
    resolve_knowledge_storage_bucket,
    web_crawl_list_prefix,
    web_crawl_session_prefix,
)


def test_resolve_knowledge_storage_bucket_defaults_to_firebase(monkeypatch):
    monkeypatch.delenv("DRIVE_MIRROR_BUCKET", raising=False)
    monkeypatch.delenv("FIREBASE_STORAGE_BUCKET", raising=False)
    monkeypatch.delenv("DRIVE_SYNC_INPUTS_BUCKET", raising=False)
    assert (
        resolve_knowledge_storage_bucket("my-project")
        == "my-project.firebasestorage.app"
    )


def test_drive_sync_mirror_paths():
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


def test_manual_upload_path():
    path = manual_upload_object_path(
        organization_id="o",
        space_id="s",
        file_space_id="f",
        file_name="report.pdf",
    )
    assert path.endswith("/knowledges/manual_upload/report.pdf")


def test_workflow_input_path():
    path = drive_sync_workflow_input_object_path(
        organization_id="o",
        space_id="s",
        request_id="req-1",
    )
    assert path == (
        "organizations/o/spaces/s/knowledges/driveSync/workflowInputs/req-1.yml"
    )


def test_web_crawl_paths():
    list_prefix = web_crawl_list_prefix(
        organization_id="o",
        space_id="s",
        file_space_id="f",
    )
    assert list_prefix.endswith("/knowledges/webCrawl/")
    session = web_crawl_session_prefix(
        organization_id="o",
        space_id="s",
        file_space_id="f",
        session_folder="2026-05-20_example.com_abc",
    )
    assert session == (
        "organizations/o/spaces/s/fileSpaces/f/knowledges/webCrawl/"
        "2026-05-20_example.com_abc"
    )


def test_parse_drive_sync_mirror_blob():
    prefix = drive_sync_mirror_list_prefix(
        organization_id="o",
        space_id="s",
        file_space_id="f",
    )
    name = f"{prefix}drv-A/2024-05-27T01_23_45.123Z.pdf"
    parsed = parse_drive_sync_mirror_blob(blob_name=name, list_prefix=prefix)
    assert parsed == ("drv-A", "2024-05-27T01:23:45.123Z")
