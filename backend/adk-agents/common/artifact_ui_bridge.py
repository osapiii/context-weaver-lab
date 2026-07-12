"""ADK artifact catalog helpers for EN AIstudio UI (publish runs in Firebase Functions)."""
from __future__ import annotations

from typing import Any

from .adk_artifact_catalog import (
    ArtifactDescriptor,
    adk_blob_path,
    artifact_display_name,
    artifact_id,
    artifact_kind,
    build_descriptor,
    message_artifact_ref,
    parse_adk_storage_object_name,
)

__all__ = [
    "ArtifactDescriptor",
    "adk_blob_path",
    "artifact_display_name",
    "artifact_id",
    "artifact_kind",
    "build_descriptor",
    "message_artifact_ref",
    "parse_adk_storage_object_name",
    "message_artifact_ref_from_ref",
    "message_artifact_ref_from_tool_ref",
]


def message_artifact_ref_from_ref(
    *,
    session_id: str,
    filename: str,
    version: int,
    kind: str,
) -> dict[str, str]:
    aid = artifact_id(session_id=session_id, filename=filename, version=version)
    return message_artifact_ref(
        artifact_id=aid,
        kind=kind,
        adk_filename=filename,
        version=version,
    )


def message_artifact_ref_from_tool_ref(
    *,
    session_id: str,
    ref: dict[str, Any],
) -> dict[str, str] | None:
    """tool response `artifact_refs[]` から UI 用 ref を組み立てる (GCS resolve 不要)."""
    filename = ref.get("filename")
    if not isinstance(filename, str) or not filename.strip():
        return None
    version_raw = ref.get("version")
    if not isinstance(version_raw, int):
        return None
    kind_raw = ref.get("kind")
    kind = (
        str(kind_raw).strip()
        if isinstance(kind_raw, str) and str(kind_raw).strip()
        else "other"
    )
    meta = ref.get("custom_metadata")
    if kind == "other" and isinstance(meta, dict):
        meta_kind = meta.get("kind")
        if isinstance(meta_kind, str) and meta_kind.strip():
            kind = meta_kind.strip()
    return message_artifact_ref_from_ref(
        session_id=session_id,
        filename=filename.strip(),
        version=version_raw,
        kind=kind,
    )
