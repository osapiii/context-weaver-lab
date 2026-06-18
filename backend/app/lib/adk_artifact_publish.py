"""Ingest ADK artifact GCS objects into canonical Storage + Firestore."""
from __future__ import annotations

import logging
import os
import uuid
from typing import Any

from firebase_admin import storage as firebase_storage
from google.api_core import exceptions as gcp_exceptions
from google.cloud import firestore, storage
from google.cloud.firestore_v1 import FieldFilter

from lib.adk_artifact_catalog import (
    ArtifactDescriptor,
    allowed_app_names_from_env,
    build_descriptor,
    parse_adk_storage_object_name,
)

logger = logging.getLogger(__name__)

FIRESTORE_SESSIONS_COLLECTION = os.environ.get(
    "FIRESTORE_ADK_SESSIONS_COLLECTION", "adkSessions"
)


def _source_bucket() -> str:
    return (os.environ.get("ADK_ARTIFACT_BUCKET") or "").strip()


def _storage_bucket() -> str:
    return (
        os.environ.get("EN_AISTUDIO_GCS_BUCKET")
        or os.environ.get("EN_AISTUDIO_STORAGE_BUCKET")
        or os.environ.get("FIREBASE_STORAGE_BUCKET")
        or os.environ.get("NUXT_PUBLIC_FIREBASECONFIG_STORAGEBUCKET")
        or ""
    ).strip()


def _parse_gs_uri(gs_uri: str) -> tuple[str, str]:
    if not gs_uri.startswith("gs://"):
        raise ValueError(f"invalid gs uri: {gs_uri}")
    rest = gs_uri[5:]
    slash = rest.find("/")
    if slash <= 0:
        raise ValueError(f"invalid gs uri: {gs_uri}")
    return rest[:slash], rest[slash + 1 :]


def _probe_session_doc_paths(
    db: firestore.Client,
    *,
    user_id: str,
    session_id: str,
    max_orgs: int = 100,
) -> list[firestore.DocumentSnapshot]:
    """Fallback when collection group indexes are still building."""
    matches: list[firestore.DocumentSnapshot] = []
    for org_snap in db.collection("organizations").limit(max_orgs).stream():
        org_id = org_snap.id
        admin_ref = db.collection(f"organizations/{org_id}/adminUsers").document(
            user_id
        )
        if not admin_ref.get().exists:
            continue
        for space_snap in db.collection(f"organizations/{org_id}/spaces").stream():
            ref = db.document(
                f"organizations/{org_id}/spaces/{space_snap.id}/"
                f"{FIRESTORE_SESSIONS_COLLECTION}/{session_id}"
            )
            snap = ref.get()
            if not snap.exists:
                continue
            data = snap.to_dict() or {}
            if str(data.get("uid") or "") != user_id:
                continue
            matches.append(snap)
            return matches
    return matches


def _firestore_query_retryable(exc: BaseException) -> bool:
    if isinstance(
        exc,
        (gcp_exceptions.FailedPrecondition, gcp_exceptions.InvalidArgument),
    ):
        return True
    return False


def lookup_session_scope(
    db: firestore.Client,
    *,
    user_id: str,
    session_id: str,
) -> tuple[str, str, str] | None:
    """Return (organization_id, space_id, uid) for adkSessions/{sessionId}."""
    coll = db.collection_group(FIRESTORE_SESSIONS_COLLECTION)
    candidates: list[firestore.DocumentSnapshot] = []
    try:
        candidates = list(
            coll.where(filter=FieldFilter("sessionId", "==", session_id))
            .limit(20)
            .stream()
        )
    except Exception as exc:
        if _firestore_query_retryable(exc):
            logger.warning(
                "adk session lookup by sessionId failed (index may be building): %s",
                exc,
            )
            candidates = _probe_session_doc_paths(
                db, user_id=user_id, session_id=session_id
            )
            if not candidates:
                return None
        else:
            raise
    if not candidates:
        try:
            candidates = [
                snap
                for snap in coll.where(filter=FieldFilter("uid", "==", user_id)).stream()
                if snap.id == session_id
            ]
        except Exception as exc:
            if _firestore_query_retryable(exc):
                logger.warning(
                    "adk session lookup by uid failed (index may be building): %s",
                    exc,
                )
                candidates = _probe_session_doc_paths(
                    db, user_id=user_id, session_id=session_id
                )
            else:
                raise
            if not candidates:
                return None
    for snap in candidates:
        data = snap.to_dict() or {}
        if str(data.get("uid") or "") != user_id:
            continue
        path_parts = snap.reference.path.split("/")
        if len(path_parts) < 6:
            continue
        org_id = str(data.get("organizationId") or path_parts[1])
        space_id = str(data.get("spaceId") or path_parts[3])
        uid = str(data.get("uid") or user_id)
        return org_id, space_id, uid
    return None


def _patch_firebase_download_metadata(blob: Any, *, content_type: str | None) -> None:
    """Server-side GCS copy must set firebaseStorageDownloadTokens for client getDownloadURL."""
    blob.reload()
    metadata = dict(blob.metadata or {})
    if not metadata.get("firebaseStorageDownloadTokens"):
        metadata["firebaseStorageDownloadTokens"] = str(uuid.uuid4())
    if content_type:
        blob.content_type = content_type
    blob.metadata = metadata
    blob.patch()


def copy_to_canonical(
    storage_client: storage.Client,
    *,
    descriptor: ArtifactDescriptor,
) -> None:
    """Copy ADK source object into Firebase Storage with download-token metadata.

    Firebase Storage is GCS under the hood; use firebase_admin.storage for the
    destination so objects work with client getDownloadURL when tokens are set.
    """
    src_bucket, src_blob = _parse_gs_uri(descriptor.source_gcs_path)
    dst_bucket, dst_blob = _parse_gs_uri(descriptor.storage_gcs_path)
    src = storage_client.bucket(src_bucket).blob(src_blob)
    if not src.exists():
        raise FileNotFoundError(f"ADK source missing: {descriptor.source_gcs_path}")

    fb_bucket = firebase_storage.bucket(dst_bucket)
    dst = fb_bucket.blob(dst_blob)
    if dst.exists():
        _patch_firebase_download_metadata(dst, content_type=descriptor.content_type)
        return

    download_token = str(uuid.uuid4())
    content_type = descriptor.content_type or "application/octet-stream"
    # firebase_admin Blob.upload_from_string does not accept metadata= (unlike
    # google-cloud-storage). Set download tokens via blob.metadata + patch.
    dst.upload_from_string(
        src.download_as_bytes(),
        content_type=content_type,
    )
    dst.metadata = {"firebaseStorageDownloadTokens": download_token}
    dst.content_type = content_type
    dst.patch()


def artifact_doc_path(
    *,
    organization_id: str,
    space_id: str,
    session_id: str,
    artifact_id: str,
) -> str:
    return (
        f"organizations/{organization_id}/spaces/{space_id}/"
        f"{FIRESTORE_SESSIONS_COLLECTION}/{session_id}/artifacts/{artifact_id}"
    )


def upsert_artifact_doc(
    db: firestore.Client,
    *,
    descriptor: ArtifactDescriptor,
    organization_id: str,
    space_id: str,
    session_id: str,
    uid: str,
    status: str,
    sync_error: str | None = None,
    message_id: str | None = None,
    response_id: str | None = None,
) -> None:
    ref = db.document(
        artifact_doc_path(
            organization_id=organization_id,
            space_id=space_id,
            session_id=session_id,
            artifact_id=descriptor.artifact_id,
        )
    )
    payload: dict[str, Any] = {
        "artifactId": descriptor.artifact_id,
        "sessionId": session_id,
        "organizationId": organization_id,
        "spaceId": space_id,
        "uid": uid,
        "kind": descriptor.kind,
        "adkFilename": descriptor.adk_filename,
        "adkVersion": descriptor.adk_version,
        "sourceGcsPath": descriptor.source_gcs_path,
        "storageGcsPath": descriptor.storage_gcs_path,
        "contentType": descriptor.content_type,
        "bytes": descriptor.bytes,
        "name": descriptor.name,
        "status": status,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if descriptor.prompt:
        payload["prompt"] = descriptor.prompt
    if sync_error:
        payload["syncError"] = sync_error
    elif status == "ready":
        payload["syncError"] = firestore.DELETE_FIELD
    if message_id:
        payload["messageId"] = message_id
    if response_id:
        payload["responseId"] = response_id
    snap = ref.get()
    if not snap.exists:
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
    ref.set(payload, merge=True)


def ingest_from_storage_event(
    *,
    bucket_name: str,
    object_name: str,
    content_type: str | None = None,
    size_bytes: int | None = None,
    db: firestore.Client | None = None,
    storage_client: storage.Client | None = None,
) -> dict[str, Any] | None:
    """GCS object.finalized handler body. Returns summary dict or None if skipped."""
    source_bucket = _source_bucket()
    dest_bucket = _storage_bucket()
    if not source_bucket or not dest_bucket:
        logger.warning("ADK_ARTIFACT_BUCKET or EN_AISTUDIO_GCS_BUCKET unset; skip")
        return None
    if bucket_name != source_bucket:
        return None

    allowed = allowed_app_names_from_env(os.environ.get("ADK_APP_NAMES"))
    parsed = parse_adk_storage_object_name(object_name, allowed_app_names=allowed)
    if parsed is None:
        return None

    db = db or firestore.Client()
    storage_client = storage_client or storage.Client()

    scope = lookup_session_scope(
        db, user_id=parsed.user_id, session_id=parsed.session_id
    )
    if scope is None:
        logger.warning(
            "adk session not found uid=%s session=%s object=%s",
            parsed.user_id,
            parsed.session_id,
            object_name,
        )
        return {
            "skipped": True,
            "reason": "session_not_found",
            "sessionId": parsed.session_id,
        }

    org_id, space_id, uid = scope
    descriptor = build_descriptor(
        parsed=parsed,
        source_bucket=source_bucket,
        storage_bucket=dest_bucket,
        organization_id=org_id,
        space_id=space_id,
        content_type=content_type,
        size_bytes=size_bytes or 0,
    )

    upsert_artifact_doc(
        db,
        descriptor=descriptor,
        organization_id=org_id,
        space_id=space_id,
        session_id=parsed.session_id,
        uid=uid,
        status="syncing",
    )
    try:
        copy_to_canonical(storage_client, descriptor=descriptor)
        upsert_artifact_doc(
            db,
            descriptor=descriptor,
            organization_id=org_id,
            space_id=space_id,
            session_id=parsed.session_id,
            uid=uid,
            status="ready",
        )
    except Exception as exc:
        logger.exception("artifact ingest failed object=%s", object_name)
        upsert_artifact_doc(
            db,
            descriptor=descriptor,
            organization_id=org_id,
            space_id=space_id,
            session_id=parsed.session_id,
            uid=uid,
            status="failed",
            sync_error=str(exc)[:500],
        )
        return {"artifactId": descriptor.artifact_id, "status": "failed"}

    return {
        "artifactId": descriptor.artifact_id,
        "status": "ready",
        "storageGcsPath": descriptor.storage_gcs_path,
    }
