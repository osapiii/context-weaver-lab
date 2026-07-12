"""
Step 4: Firestore更新

videoドキュメントに storagePath（③圧縮版）、originalStoragePath（①）、
convertedStoragePath（②）を更新。
"""

from datetime import datetime, timezone
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import firestore_client


def execute(
    ctx: RequestContext,
    compressed_path: str,
    original_path: str,
    converted_path: str,
) -> None:
    """
    Step 4: Firestoreのvideoドキュメントを更新

    params:
        ctx: RequestContext
        compressed_path: 圧縮版のGCSパス（③）
        original_path: オリジナルのGCSパス（①、sourceFilePath）
        converted_path: MP4変換版のGCSパス（②。MP4の場合は①と同一）
    """
    logger.start_operation("Step 4: Firestore更新")

    input_data = ctx.get_param("input", {})
    org_id = input_data.get("organizationId", "")
    space_id = input_data.get("spaceId", "")
    video_id = input_data.get("videoId", "")
    bucket_name = ctx.output_bucket_name

    video_doc_path = f"organizations/{org_id}/spaces/{space_id}/videos/{video_id}"

    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx, status="processing",
            message="動画ドキュメントを更新中",
            current_step="updating"
        )

    client = firestore_client.get_client()
    doc_ref = client.document(video_doc_path)
    doc_ref.update({
        "storagePath": compressed_path,
        "storageBucket": bucket_name,
        "originalStoragePath": original_path,
        "originalStorageBucket": bucket_name,
        "convertedStoragePath": converted_path,
        "convertedStorageBucket": bucket_name,
        "updatedAt": datetime.now(timezone.utc),
    })

    logger.success(f"Firestore更新完了: {video_doc_path}")
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx, status="processing",
            message="動画ドキュメント更新完了",
            current_step="updating"
        )

    logger.complete_operation("Step 4: Firestore更新")
