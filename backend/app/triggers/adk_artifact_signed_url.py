"""Callable: signed GET URL for ADK artifact blobs (GCS Admin SDK)."""
from __future__ import annotations

import logging
import os
import re

from firebase_admin import initialize_app
from firebase_functions import https_fn
from google.cloud import storage

from lib.gcs_signed_url import generate_blob_signed_url

try:
    initialize_app()
except ValueError:
    pass

logger = logging.getLogger(__name__)

_ALLOWED_BUCKETS = frozenset(
    b.strip()
    for b in (
        os.environ.get("ADK_ARTIFACT_BUCKET", ""),
        os.environ.get("EN_AISTUDIO_GCS_BUCKET", ""),
        os.environ.get("NUXT_PUBLIC_FIREBASECONFIG_STORAGEBUCKET", ""),
        "en-aistudio-development-adk-artifacts",
        "en-aistudio-development.firebasestorage.app",
    )
    if b.strip()
)


def _parse_gs_uri(gs_uri: str) -> tuple[str, str]:
    if not gs_uri.startswith("gs://"):
        raise ValueError(f"invalid gs uri: {gs_uri}")
    rest = gs_uri[5:]
    slash = rest.find("/")
    if slash <= 0:
        raise ValueError(f"invalid gs uri: {gs_uri}")
    return rest[:slash], rest[slash + 1 :]


def _is_allowed_path(*, bucket: str, object_path: str) -> bool:
    if bucket not in _ALLOWED_BUCKETS:
        return False
    if object_path.startswith("organizations/"):
        return True
    if re.match(r"^en-aistudio-adk-agent/[^/]+/[^/]+/.+/\d+$", object_path):
        return True
    return False


@https_fn.on_call(
    region="asia-northeast1",
    memory=512,
    timeout_sec=60,
)
def get_artifact_signed_url(
    req: https_fn.CallableRequest,
) -> dict[str, str]:
    if not req.auth or not req.auth.uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="ログインが必要です",
        )

    raw = req.data.get("storageGcsPath") if isinstance(req.data, dict) else None
    if not isinstance(raw, str) or not raw.strip().startswith("gs://"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="storageGcsPath (gs://...) が必要です",
        )

    try:
        bucket_name, object_path = _parse_gs_uri(raw.strip())
    except ValueError as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=str(exc),
        ) from exc

    if not _is_allowed_path(bucket=bucket_name, object_path=object_path):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="許可されていないストレージパスです",
        )

    client = storage.Client()
    blob = client.bucket(bucket_name).blob(object_path)
    if not blob.exists():
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="オブジェクトが見つかりません",
        )

    try:
        url = generate_blob_signed_url(
            bucket_name=bucket_name,
            blob_name=object_path,
            expiration_seconds=3600,
            method="GET",
        )
    except Exception as exc:
        logger.exception(
            "signed url failed bucket=%s object=%s",
            bucket_name,
            object_path,
        )
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"署名 URL の生成に失敗しました: {exc}",
        ) from exc
    logger.info(
        "artifact signed url uid=%s bucket=%s object=%s",
        req.auth.uid,
        bucket_name,
        object_path,
    )
    return {"url": url}
