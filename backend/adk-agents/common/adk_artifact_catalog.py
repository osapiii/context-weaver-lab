"""ADK artifact path catalog — pure functions (Functions + ADK shared logic)."""
from __future__ import annotations

import hashlib
import mimetypes
import re
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

_KIND_BY_SUFFIX = {
    ".pptx": "pptx",
    ".json": "plan_json",
    ".md": "narration",
    ".html": "html",
    ".zip": "package",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".svg": "image",
    ".csv": "csv_document",
}

_SAFE_FILENAME = re.compile(r"[^a-zA-Z0-9._-]+")


@dataclass(frozen=True)
class ParsedAdkStorageObject:
    app_name: str
    user_id: str
    session_id: str
    filename: str
    version: int


@dataclass(frozen=True)
class ArtifactDescriptor:
    artifact_id: str
    kind: str
    adk_filename: str
    adk_version: int
    source_gcs_path: str
    storage_gcs_path: str
    content_type: str
    name: str
    bytes: int
    prompt: str | None = None


def adk_blob_path(
    *,
    app_name: str,
    user_id: str,
    session_id: str,
    filename: str,
    version: int,
) -> str:
    return f"{app_name}/{user_id}/{session_id}/{filename}/{version}"


def source_gcs_path(*, bucket_name: str, blob_path: str) -> str:
    return f"gs://{bucket_name.strip()}/{blob_path.lstrip('/')}"


def safe_storage_filename(filename: str) -> str:
    base = filename.split("/")[-1] if "/" in filename else filename
    cleaned = _SAFE_FILENAME.sub("_", base).strip("._") or "artifact"
    return cleaned[:180]


def canonical_storage_blob_path(
    *,
    organization_id: str,
    space_id: str,
    session_id: str,
    filename: str,
    version: int,
) -> str:
    safe_name = safe_storage_filename(filename)
    return (
        f"organizations/{organization_id}/spaces/{space_id}/"
        f"adkSessions/{session_id}/artifacts/{safe_name}/v{version}"
    )


def storage_gcs_path(*, bucket_name: str, blob_path: str) -> str:
    return f"gs://{bucket_name.strip()}/{blob_path.lstrip('/')}"


def artifact_id(
    *,
    session_id: str,
    filename: str,
    version: int,
) -> str:
    raw = f"{session_id}:{filename}:{version}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def artifact_kind(filename: str, custom_metadata: dict[str, Any] | None = None) -> str:
    meta = custom_metadata or {}
    raw = meta.get("kind")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    suffix = PurePosixPath(filename).suffix.lower()
    return _KIND_BY_SUFFIX.get(suffix, "other")


def artifact_display_name(filename: str) -> str:
    base = filename.split("/")[-1] if "/" in filename else filename
    if "__" in base:
        return base.split("__", 1)[-1]
    return base


def parse_adk_storage_object_name(
    object_name: str,
    *,
    allowed_app_names: set[str] | frozenset[str],
) -> ParsedAdkStorageObject | None:
    """Parse GCS object name: {app}/{user}/{session}/{filename...}/{version}."""
    name = (object_name or "").strip().lstrip("/")
    if not name or name.startswith("organizations/"):
        return None
    parts = name.split("/")
    if len(parts) < 5:
        return None
    app_name = parts[0]
    if app_name not in allowed_app_names:
        return None
    user_id = parts[1]
    session_id = parts[2]
    version_raw = parts[-1]
    if not version_raw.isdigit():
        return None
    version = int(version_raw)
    filename = "/".join(parts[3:-1])
    if not user_id or not session_id or not filename:
        return None
    return ParsedAdkStorageObject(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
        filename=filename,
        version=version,
    )


def build_descriptor(
    *,
    parsed: ParsedAdkStorageObject,
    source_bucket: str,
    storage_bucket: str,
    organization_id: str,
    space_id: str,
    content_type: str | None = None,
    size_bytes: int = 0,
    custom_metadata: dict[str, Any] | None = None,
) -> ArtifactDescriptor:
    blob = adk_blob_path(
        app_name=parsed.app_name,
        user_id=parsed.user_id,
        session_id=parsed.session_id,
        filename=parsed.filename,
        version=parsed.version,
    )
    canonical = canonical_storage_blob_path(
        organization_id=organization_id,
        space_id=space_id,
        session_id=parsed.session_id,
        filename=parsed.filename,
        version=parsed.version,
    )
    display = artifact_display_name(parsed.filename)
    ctype = (
        content_type
        or mimetypes.guess_type(display)[0]
        or "application/octet-stream"
    )
    meta = custom_metadata or {}
    prompt = meta.get("prompt")
    prompt_str = prompt.strip() if isinstance(prompt, str) and prompt.strip() else None
    return ArtifactDescriptor(
        artifact_id=artifact_id(
            session_id=parsed.session_id,
            filename=parsed.filename,
            version=parsed.version,
        ),
        kind=artifact_kind(parsed.filename, meta),
        adk_filename=parsed.filename,
        adk_version=parsed.version,
        source_gcs_path=source_gcs_path(bucket_name=source_bucket, blob_path=blob),
        storage_gcs_path=storage_gcs_path(
            bucket_name=storage_bucket, blob_path=canonical
        ),
        content_type=ctype,
        name=display,
        bytes=size_bytes,
        prompt=prompt_str,
    )


def message_artifact_ref(
    *,
    artifact_id: str,
    kind: str,
    adk_filename: str | None = None,
    version: int | None = None,
) -> dict[str, str | int]:
    ref: dict[str, str | int] = {"artifactId": artifact_id, "kind": kind}
    if adk_filename and adk_filename.strip():
        ref["adkFilename"] = adk_filename.strip()
    if version is not None:
        ref["artifactVersion"] = version
    return ref


def allowed_app_names_from_env(raw: str | None) -> frozenset[str]:
    if not raw or not raw.strip():
        return frozenset({"en-aistudio-adk-agent", "slides-generator"})
    return frozenset(p.strip() for p in raw.split(",") if p.strip())
