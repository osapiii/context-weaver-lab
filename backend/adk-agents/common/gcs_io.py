"""GCS blob 読み取り (attachments / knowledge 共通)."""
from __future__ import annotations

import logging

from google.cloud import storage

logger = logging.getLogger(__name__)

INLINE_MAX_BYTES = 20 * 1024 * 1024


def parse_gcs_uri(gcs_path: str) -> tuple[str, str] | None:
    if not gcs_path.startswith("gs://"):
        return None
    parts = gcs_path.replace("gs://", "", 1).split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0], parts[1]


def fetch_gcs_bytes(
    gcs_path: str,
    *,
    max_bytes: int = INLINE_MAX_BYTES,
) -> bytes | None:
    parsed = parse_gcs_uri(gcs_path.strip())
    if not parsed:
        logger.warning("invalid gcs path: %s", gcs_path)
        return None
    bucket_name, blob_path = parsed
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        blob.reload()
        if blob.size and blob.size > max_bytes:
            logger.warning(
                "gcs object too large: %s (%s bytes)", gcs_path, blob.size
            )
            return None
        return blob.download_as_bytes()
    except Exception as exc:
        logger.warning("gcs fetch failed: path=%s err=%s", gcs_path, exc)
        return None
