"""
Step 2: 動画分割処理

ダウンロードした動画データを指定されたタイムスタンプで分割します。
"""

from typing import List
from localPackages.common.context import RequestContext, VideoSegment
from localPackages.common.logger import logger
from localPackages.core import video_processor
from localPackages.common import firestore_client


def execute(ctx: RequestContext, video_data: bytes) -> List[VideoSegment]:
    """
    Step 2: 動画を分割

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        video_data: bytes - ダウンロードした動画データ
    }

    returns: List[VideoSegment] - 分割された動画セグメントのリスト
    """
    logger.start_operation("Step 2: 動画分割処理")

    # cutoffSecondsを取得
    cutoff_seconds = ctx.get_param('cutoffSeconds', [])
    expected_segments = len(cutoff_seconds) + 1

    # Firestoreに進捗を記録（開始）
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"動画を{expected_segments}個のセグメントに分割中",
            current_step="splitting"
        )

    # video_processor.split_videoを呼び出し
    segments = video_processor.split_video(ctx, video_data)

    # コンテキストにセグメント情報を保存
    ctx.segments = segments

    # Firestoreに進捗を記録（完了）
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"動画分割完了 ({len(segments)}個のセグメント)",
            current_step="splitting"
        )

    logger.complete_operation("Step 2: 動画分割処理")
    logger.success(f"動画を{len(segments)}個のセグメントに分割完了")

    return segments
