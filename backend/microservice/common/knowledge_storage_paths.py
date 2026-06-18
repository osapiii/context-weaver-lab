"""
Knowledge object paths under the Firebase Storage default bucket.

GCS layout (under organizations/{orgId}/spaces/{spaceId}/):

  fileSpaces/{fileSpaceId}/knowledges/driveSync/{driveFileId}/{ts}{ext}
      — Drive sync mirror bytes

  fileSpaces/{fileSpaceId}/knowledges/manual_upload/{fileName}
      — Manual FileSpace uploads

  fileSpaces/{fileSpaceId}/knowledges/webCrawl/{sessionFolder}/
      — Web crawl markdown + images (workflow step2 SSOT)

  knowledges/driveSync/workflowInputs/{requestId}.yml
      — Ephemeral Workflow input manifest (kicker PUT; customTime + lifecycle TTL)

Firestore document metadata remains at:
  fileSpaces/{fileSpaceId}/documents/{docId}
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

KNOWLEDGES_SEGMENT = "knowledges"
DRIVE_SYNC_SEGMENT = "driveSync"
MANUAL_UPLOAD_SEGMENT = "manual_upload"
WEB_CRAWL_SEGMENT = "webCrawl"
WORKFLOW_INPUTS_SEGMENT = "workflowInputs"
FILE_SPACES_SEGMENT = "fileSpaces"

DEFAULT_MIRROR_EXT = ".bin"

GOOGLE_WORKSPACE_EXPORT_EXT = {
    "application/vnd.google-apps.document": ".pdf",
    "application/vnd.google-apps.presentation": ".pdf",
    "application/vnd.google-apps.spreadsheet": ".csv",
    "application/vnd.google-apps.drawing": ".png",
}

_TIME_SAFE_RE = re.compile(r"[^0-9A-Za-z_\-\.T]")


def resolve_knowledge_storage_bucket(project_id: str) -> str:
    """Firebase Storage bucket (GCS API). Override via env."""
    explicit = (os.getenv("DRIVE_MIRROR_BUCKET") or "").strip()
    if explicit:
        return explicit
    firebase = (os.getenv("FIREBASE_STORAGE_BUCKET") or "").strip()
    if firebase:
        return firebase
    legacy_inputs = (os.getenv("DRIVE_SYNC_INPUTS_BUCKET") or "").strip()
    if legacy_inputs:
        return legacy_inputs
    return f"{project_id}.firebasestorage.app"


def safe_drive_modified_timestamp(value: str | None) -> str:
    if not value:
        return "unknown"
    safe = value.replace(":", "_")
    return _TIME_SAFE_RE.sub("_", safe)


def _file_space_knowledges_prefix(
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
) -> str:
    return (
        f"organizations/{organization_id}/spaces/{space_id}/"
        f"{FILE_SPACES_SEGMENT}/{file_space_id}/{KNOWLEDGES_SEGMENT}/"
    )


def drive_sync_mirror_list_prefix(
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
) -> str:
    return (
        f"{_file_space_knowledges_prefix(organization_id=organization_id, space_id=space_id, file_space_id=file_space_id)}"
        f"{DRIVE_SYNC_SEGMENT}/"
    )


def drive_sync_mirror_object_path(
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
    drive_file_id: str,
    drive_modified_time: str,
    ext: str = DEFAULT_MIRROR_EXT,
) -> str:
    ts = safe_drive_modified_timestamp(drive_modified_time)
    safe_ext = ext if ext.startswith(".") else f".{ext}"
    return (
        f"{drive_sync_mirror_list_prefix(organization_id=organization_id, space_id=space_id, file_space_id=file_space_id)}"
        f"{drive_file_id}/{ts}{safe_ext}"
    )


def drive_sync_mirror_prefix_gs_uri(
    *,
    bucket: str,
    organization_id: str,
    space_id: str,
    file_space_id: str,
) -> str:
    return (
        f"gs://{bucket}/"
        f"{drive_sync_mirror_list_prefix(organization_id=organization_id, space_id=space_id, file_space_id=file_space_id)}"
    )


def manual_upload_object_path(
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
    file_name: str,
) -> str:
    return (
        f"{_file_space_knowledges_prefix(organization_id=organization_id, space_id=space_id, file_space_id=file_space_id)}"
        f"{MANUAL_UPLOAD_SEGMENT}/{file_name}"
    )


def web_crawl_list_prefix(
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
) -> str:
    """Prefix for all web crawl sessions under a FileSpace."""
    return (
        f"{_file_space_knowledges_prefix(organization_id=organization_id, space_id=space_id, file_space_id=file_space_id)}"
        f"{WEB_CRAWL_SEGMENT}/"
    )


def web_crawl_session_prefix(
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
    session_folder: str,
) -> str:
    """GCS object prefix for one crawl session (no trailing slash).

    Example: ``.../knowledges/webCrawl/2026-05-20_example.com_a1b2c3``
    """
    folder = session_folder.strip().strip("/")
    if not folder:
        raise ValueError("session_folder must be non-empty")
    return (
        f"{web_crawl_list_prefix(organization_id=organization_id, space_id=space_id, file_space_id=file_space_id)}"
        f"{folder}"
    )


def drive_sync_workflow_input_object_path(
    *,
    organization_id: str,
    space_id: str,
    request_id: str,
) -> str:
    return (
        f"organizations/{organization_id}/spaces/{space_id}/"
        f"{KNOWLEDGES_SEGMENT}/{DRIVE_SYNC_SEGMENT}/"
        f"{WORKFLOW_INPUTS_SEGMENT}/{request_id}.yml"
    )


def drive_sync_workflow_input_gs_uri(
    *,
    bucket: str,
    organization_id: str,
    space_id: str,
    request_id: str,
) -> str:
    return (
        f"gs://{bucket}/"
        f"{drive_sync_workflow_input_object_path(organization_id=organization_id, space_id=space_id, request_id=request_id)}"
    )


def parse_drive_sync_mirror_blob(
    *,
    blob_name: str,
    list_prefix: str,
) -> tuple[str, str] | None:
    """Parse mirror object under driveSync list prefix → (driveFileId, driveModifiedTime)."""
    if not blob_name.startswith(list_prefix):
        return None
    rest = blob_name[len(list_prefix) :]
    parts = rest.split("/", 1)
    if len(parts) < 2:
        return None
    drive_file_id, leaf = parts
    if not drive_file_id:
        return None
    ts = leaf.rsplit(".", 1)[0] if "." in leaf else leaf
    original_ts = ts.replace("_", ":") if "T" in ts else ts
    return drive_file_id, original_ts


def build_mirror_inventory_entry(
    *,
    blob_name: str,
    drive_modified_time: str,
    size: int | None,
    content_type: str | None,
    md5: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "objectPath": blob_name,
        "driveModifiedTime": drive_modified_time,
        "size": size,
        "contentType": content_type,
    }
    if md5 is not None:
        entry["md5"] = md5
    if metadata is not None:
        entry["metadata"] = metadata
    return entry


def workflow_input_custom_time() -> datetime:
    """UTC now — set on ephemeral workflow input blobs for lifecycle TTL."""
    return datetime.now(timezone.utc)


# Backward-compatible aliases (drive mirror migration)
drive_mirror_list_prefix = drive_sync_mirror_list_prefix
mirror_object_path = drive_sync_mirror_object_path
mirror_prefix_gs_uri = drive_sync_mirror_prefix_gs_uri
parse_mirror_inventory_blob = parse_drive_sync_mirror_blob
resolve_drive_mirror_bucket = resolve_knowledge_storage_bucket

DRIVE_MIRROR_SEGMENT = DRIVE_SYNC_SEGMENT
