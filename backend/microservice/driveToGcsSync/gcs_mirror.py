"""
GCS mirror utilities for drive-to-gcs-sync.

Paths: knowledge_storage_paths (knowledges/driveSync under fileSpace).
"""

from __future__ import annotations

from typing import Any

from google.cloud import storage

from knowledge_storage_paths import (
    DEFAULT_MIRROR_EXT,
    GOOGLE_WORKSPACE_EXPORT_EXT,
    build_mirror_inventory_entry,
    drive_sync_mirror_list_prefix,
    drive_sync_mirror_object_path,
    drive_sync_mirror_prefix_gs_uri,
    parse_drive_sync_mirror_blob,
)

__all__ = [
    "DEFAULT_MIRROR_EXT",
    "GOOGLE_WORKSPACE_EXPORT_EXT",
    "mirror_prefix",
    "mirror_object_path",
    "list_mirror_inventory",
    "apply_batch",
    "delete_batch",
]


def mirror_prefix(
    *,
    bucket: str,
    organization_id: str,
    space_id: str,
    file_space_id: str,
) -> str:
    return drive_sync_mirror_prefix_gs_uri(
        bucket=bucket,
        organization_id=organization_id,
        space_id=space_id,
        file_space_id=file_space_id,
    )


def mirror_object_path(
    *,
    organization_id: str,
    space_id: str,
    file_space_id: str,
    drive_file_id: str,
    drive_modified_time: str,
    ext: str = DEFAULT_MIRROR_EXT,
) -> str:
    return drive_sync_mirror_object_path(
        organization_id=organization_id,
        space_id=space_id,
        file_space_id=file_space_id,
        drive_file_id=drive_file_id,
        drive_modified_time=drive_modified_time,
        ext=ext,
    )


_storage_singleton: storage.Client | None = None


def _get_storage_client() -> storage.Client:
    global _storage_singleton
    if _storage_singleton is None:
        _storage_singleton = storage.Client()
    return _storage_singleton


def list_mirror_inventory(
    *,
    bucket: str,
    organization_id: str,
    space_id: str,
    file_space_id: str,
) -> dict[str, list[dict[str, Any]]]:
    """{driveFileId: [{objectPath, driveModifiedTime, size, contentType}]}"""
    prefix = drive_sync_mirror_list_prefix(
        organization_id=organization_id,
        space_id=space_id,
        file_space_id=file_space_id,
    )
    out: dict[str, list[dict[str, Any]]] = {}
    client = _get_storage_client()
    for blob in client.list_blobs(bucket, prefix=prefix):
        name = blob.name or ""
        parsed = parse_drive_sync_mirror_blob(blob_name=name, list_prefix=prefix)
        if parsed is None:
            continue
        drive_file_id, original_ts = parsed
        entry = build_mirror_inventory_entry(
            blob_name=name,
            drive_modified_time=original_ts,
            size=blob.size,
            content_type=blob.content_type,
            md5=blob.md5_hash,
        )
        out.setdefault(drive_file_id, []).append(entry)
    return out


class apply_batch:  # noqa: N801 (used as namespace by main.py)
    @staticmethod
    def upload_bytes_to_mirror(
        *,
        bucket: str,
        object_path: str,
        data: bytes,
        content_type: str | None,
        metadata: dict[str, str] | None = None,
    ) -> str:
        client = _get_storage_client()
        blob = client.bucket(bucket).blob(object_path)
        if content_type:
            blob.content_type = content_type
        if metadata:
            blob.metadata = {k: str(v) for k, v in metadata.items()}
        if content_type:
            blob.upload_from_string(data, content_type=content_type)
        else:
            blob.upload_from_string(data)
        return f"gs://{bucket}/{object_path}"

    @staticmethod
    def delete_object(*, bucket: str, object_path: str) -> None:
        delete_batch.delete_object(bucket=bucket, object_path=object_path)


class delete_batch:  # noqa: N801
    @staticmethod
    def delete_object(*, bucket: str, object_path: str) -> None:
        client = _get_storage_client()
        blob = client.bucket(bucket).blob(object_path)
        blob.delete()
