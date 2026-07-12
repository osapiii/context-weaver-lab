"""
Step 2a: MP4変換処理

WebM/MKV等をH.264 MP4に変換（解像度・画質維持）。既にMP4の場合はスキップ。
"""

import os
import subprocess
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import firestore_client

MP4_EXTENSIONS = (".mp4", ".m4v")


def execute(ctx: RequestContext, input_path: str) -> str:
    """
    Step 2a: 必要に応じてMP4に変換

    params:
        ctx: RequestContext
        input_path: 入力動画の一時パス（ダウンロード済み）

    returns: str - 変換後（またはそのまま）の一時ファイルパス
    """
    logger.start_operation("Step 2a: MP4変換")

    ext = os.path.splitext(input_path)[1].lower()
    if ext in MP4_EXTENSIONS:
        logger.info("既にMP4形式のため変換スキップ")
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx, status="processing",
                message="入力がMP4形式のため変換スキップ",
                current_step="converting"
            )
        logger.complete_operation("Step 2a: MP4変換")
        return input_path

    output_path = os.path.join(ctx.temp_dir, "converted.mp4")

    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx, status="processing",
            message="動画をMP4形式に変換中（解像度・画質維持）",
            current_step="converting"
        )

    # FFmpeg: フォーマット変換のみ、解像度・画質維持
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "medium",
        "-c:a", "aac",
        "-b:a", "192k",
        "-threads", "0",
        "-y",
        output_path,
    ]
    logger.debug(f"FFmpegコマンド: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode != 0:
            logger.error(f"FFmpeg変換エラー: {result.stderr}")
            if ctx.collection_name and ctx.document_id:
                firestore_client.log_processing_status(
                    ctx, status="processing",
                    message=f"変換エラー: {result.stderr[:200]}",
                    current_step="converting",
                    error=result.stderr[:500],
                )
            raise RuntimeError(f"FFmpeg変換失敗: {result.stderr[:200]}")

        if not os.path.exists(output_path):
            raise RuntimeError(f"変換後のファイルが見つかりません: {output_path}")

        output_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        logger.success(f"変換完了: {output_path} ({output_size_mb:.2f} MB)")
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx, status="processing",
                message=f"変換完了 ({output_size_mb:.2f} MB)",
                current_step="converting"
            )
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg変換タイムアウト")
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx, status="processing",
                message="変換がタイムアウトしました",
                current_step="converting",
                error="Timeout",
            )
        raise RuntimeError("FFmpeg変換がタイムアウトしました")

    logger.complete_operation("Step 2a: MP4変換")
    return output_path
