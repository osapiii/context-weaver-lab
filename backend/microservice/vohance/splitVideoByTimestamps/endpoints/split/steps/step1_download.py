"""
Step 1: ダウンロード処理

GCSから動画ファイルをダウンロードし、バイトデータとして返します。
"""

from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import gcs_storage
from localPackages.common import firestore_client


def execute(ctx: RequestContext) -> bytes:
    """
    Step 1: GCSから動画をダウンロード

    params: {
        ctx: RequestContext - リクエストコンテキスト
    }

    returns: bytes - ダウンロードした動画データ
    """
    logger.start_operation("Step 1: 動画ダウンロード")

    # Firestoreに進捗を記録（開始）
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message="動画をダウンロード中",
            current_step="downloading"
        )

    # GCSパス情報をログに記録
    source_path = ctx.get_source_gcs_path()
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"ダウンロード元: {source_path}",
            current_step="downloading"
        )

    # GCSから動画をダウンロード
    video_data = gcs_storage.download_video_from_gcs(ctx)

    # Firestoreに進捗を記録（完了）
    if ctx.collection_name and ctx.document_id:
        file_size_mb = len(video_data) / (1024 * 1024)
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"動画ダウンロード完了 ({file_size_mb:.2f} MB)",
            current_step="downloading"
        )

    logger.complete_operation("Step 1: 動画ダウンロード")

    return video_data
