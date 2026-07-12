"""
Step 1: ダウンロード処理

GCSから動画ファイルをダウンロードし、一時ファイルとして保存します。
"""

import os
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import gcs_storage
from localPackages.common import firestore_client


def execute(ctx: RequestContext) -> str:
    """
    Step 1: GCSから動画をダウンロード

    params: {
        ctx: RequestContext - リクエストコンテキスト
    }

    returns: str - ダウンロードした動画ファイルの一時パス
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

    # GCSから動画をダウンロード（バイトデータとして取得、一時ファイルも保存される）
    video_data = gcs_storage.download_video_from_gcs(ctx)

    # コンテキストから一時ファイルパスを取得
    video_path = ctx.downloaded_video_path
    
    if not video_path or not os.path.exists(video_path):
        raise ValueError(f"動画ファイルのダウンロードに失敗しました: {video_path}")

    # Firestoreに進捗を記録（完了）
    if ctx.collection_name and ctx.document_id:
        file_size_mb = os.path.getsize(video_path) / (1024 * 1024) if os.path.exists(video_path) else 0
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"動画ダウンロード完了 ({file_size_mb:.2f} MB)",
            current_step="downloading"
        )

    logger.complete_operation("Step 1: 動画ダウンロード")

    return video_path
