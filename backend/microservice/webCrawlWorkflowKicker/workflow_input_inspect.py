"""Read Workflows input artifacts (JSON stored as .yml) from GCS for admin UI."""

from __future__ import annotations

import json
from typing import Any, Callable

from google.cloud import storage


def parse_gs_uri(gs_uri: str) -> tuple[str, str]:
    """``gs://{bucket}/{object_path}`` → ``(bucket, object_path)``."""
    if not gs_uri or not gs_uri.startswith("gs://"):
        raise ValueError(f"Not a gs:// URI: {gs_uri!r}")
    rest = gs_uri[len("gs://") :]
    if "/" not in rest:
        raise ValueError(f"Missing object path in {gs_uri!r}")
    bucket, object_path = rest.split("/", 1)
    if not bucket or not object_path:
        raise ValueError(f"Empty bucket or object path in {gs_uri!r}")
    return bucket, object_path


def fetch_workflow_input_artifact(
    *,
    storage_client: storage.Client,
    gs_uri: str | None,
    allowed_buckets: frozenset[str],
    resolve_conventional_path: Callable[[], tuple[str, str]] | None = None,
) -> dict[str, Any]:
    """Fetch and parse the input manifest from GCS.

    Either ``gs_uri`` or ``resolve_conventional_path`` (when gs_uri is absent)
    must yield bucket + object_path.
    """
    if gs_uri:
        bucket, object_path = parse_gs_uri(gs_uri)
        if bucket not in allowed_buckets:
            raise ValueError(
                f"inputArtifactUri bucket {bucket!r} is not in allowed buckets "
                f"{sorted(allowed_buckets)!r}"
            )
    else:
        if resolve_conventional_path is None:
            raise ValueError(
                "gsUri or a conventional path resolver is required"
            )
        bucket, object_path = resolve_conventional_path()
        if bucket not in allowed_buckets:
            raise ValueError(
                f"resolved bucket {bucket!r} is not in allowed buckets "
                f"{sorted(allowed_buckets)!r}"
            )

    blob = storage_client.bucket(bucket).blob(object_path)
    if not blob.exists():
        return {
            "found": False,
            "bucket": bucket,
            "objectPath": object_path,
            "gsUri": f"gs://{bucket}/{object_path}",
            "manifest": None,
        }

    raw_bytes = blob.download_as_bytes()
    raw_text = raw_bytes.decode("utf-8", errors="replace")
    try:
        manifest = json.loads(raw_text) if raw_text.strip() else {}
    except json.JSONDecodeError:
        manifest = {"__raw__": raw_text}

    return {
        "found": True,
        "bucket": bucket,
        "objectPath": object_path,
        "gsUri": f"gs://{bucket}/{object_path}",
        "sizeBytes": len(raw_bytes),
        "contentType": blob.content_type,
        "updatedAt": blob.updated.isoformat() if blob.updated else None,
        "manifest": manifest,
    }
