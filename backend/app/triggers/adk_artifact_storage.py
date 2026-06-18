"""
ADK artifact bucket → canonical Firebase Storage + Firestore artifacts subcollection.

Triggered on object.finalized in ADK_ARTIFACT_BUCKET only.
"""
from __future__ import annotations

import logging

from firebase_admin import initialize_app
from firebase_functions import storage_fn
from firebase_functions.params import StringParam
from firebase_functions.storage_fn import CloudEvent, StorageObjectData

from lib.adk_artifact_publish import ingest_from_storage_event

try:
    initialize_app()
except ValueError:
    pass

logger = logging.getLogger(__name__)

# os.environ is empty at deploy analysis time; StringParam binds .env.<project> on deploy.
ADK_ARTIFACT_BUCKET = StringParam(
    "ADK_ARTIFACT_BUCKET",
    description="GCS bucket where ADK GcsArtifactService writes objects",
)


@storage_fn.on_object_finalized(
    bucket=ADK_ARTIFACT_BUCKET,
    memory=512,
    timeout_sec=120,
)
def on_adk_artifact_object_finalized(
    event: CloudEvent[StorageObjectData],
) -> None:
    data = event.data
    if data is None:
        return
    bucket = (data.bucket or "").strip()
    name = (data.name or "").strip()
    if not bucket or not name:
        return
    result = ingest_from_storage_event(
        bucket_name=bucket,
        object_name=name,
        content_type=data.content_type,
        size_bytes=int(data.size) if data.size is not None else None,
    )
    if result:
        logger.info("adk artifact ingest %s %s -> %s", bucket, name, result)
