"""
Step 3: アップロード処理

分割された動画セグメントをGCSにアップロードします。
"""

from typing import List, Dict, Any
from localPackages.common.context import RequestContext, VideoSegment
from localPackages.common.logger import logger
from localPackages.common import gcs_storage
from localPackages.common import firestore_client


def execute(ctx: RequestContext, segments: List[VideoSegment]) -> List[Dict[str, Any]]:
    """
    Step 3: 分割された動画をGCSにアップロード

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        segments: List[VideoSegment] - 分割された動画セグメント
    }

    returns: List[Dict[str, Any]] - アップロード結果のリスト
    """
    logger.start_operation("Step 3: 分割動画アップロード")

    # Firestoreに進捗を記録
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message="分割された動画をアップロード中",
            current_step="uploading",
            progress={
                "uploaded": 0,
                "total": len(segments)
            }
        )

    upload_results = []

    for i, segment in enumerate(segments):
        # Firestoreにアップロード開始を記録
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"セグメント{i + 1}/{len(segments)}をアップロード開始",
                current_step="uploading",
                progress={
                    "uploaded": i,
                    "total": len(segments)
                }
            )
        
        # 各セグメントをアップロード
        result = gcs_storage.upload_video_to_gcs(ctx, segment)
        upload_results.append(result)

        # Firestoreにアップロード完了を記録
        if ctx.collection_name and ctx.document_id:
            size_mb = result.get("size_bytes", 0) / (1024 * 1024) if result.get("size_bytes") else 0
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"セグメント{i + 1}/{len(segments)}をアップロード完了 ({size_mb:.2f} MB)",
                current_step="uploading",
                progress={
                    "uploaded": i + 1,
                    "total": len(segments)
                }
            )

    # コンテキストにアップロード結果を保存
    ctx.upload_results = upload_results

    # Firestoreに全アップロード完了を記録
    if ctx.collection_name and ctx.document_id:
        total_size_mb = sum(r.get("size_bytes", 0) for r in upload_results) / (1024 * 1024)
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"全セグメントのアップロード完了 ({len(segments)}個, 合計 {total_size_mb:.2f} MB)",
            current_step="uploading"
        )

    logger.complete_operation("Step 3: 分割動画アップロード")

    return upload_results
