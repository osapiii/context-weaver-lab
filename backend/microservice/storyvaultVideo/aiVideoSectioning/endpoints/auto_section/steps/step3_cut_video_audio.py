"""
Step 3: 動画・音声カット処理

Gemini分析結果に基づいて、各セクションごとに動画と音声をカットします。
"""

from typing import List, Dict, Any
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.core.video_audio_processor import cut_video_and_audio, SectionSegment
from localPackages.common import firestore_client


def execute(
    ctx: RequestContext,
    video_path: str,
    sections: List[Dict[str, Any]]
) -> List[SectionSegment]:
    """
    Step 3: 動画と音声をセクションごとにカット

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        video_path: str - 入力動画ファイルパス,
        sections: List[Dict[str, Any]] - Gemini分析結果のセクション配列
    }

    returns: List[SectionSegment] - カットされたセクションセグメントのリスト
    """
    logger.start_operation("Step 3: 動画・音声カット処理")

    # Firestoreに進捗を記録（開始）
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"動画と音声を{len(sections)}個のセクションにカット中",
            current_step="cutting"
        )

    # 動画・音声カット処理を実行
    segments = cut_video_and_audio(ctx, video_path, sections)

    # Firestoreに進捗を記録（完了）
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"動画・音声カット完了 ({len(segments)}個のセクション)",
            current_step="cutting"
        )

    logger.complete_operation("Step 3: 動画・音声カット処理")

    return segments
