"""
Step 2: 圧縮処理

FFmpegで動画を圧縮（WebM/MKV/MP4 → H.264 MP4、容量最小化重視）。
-crf 36 で強めの圧縮、解像度は最大480pに制限、音声64k で容量削減を最大化。
"""

import os
import subprocess
from localPackages.common.context import RequestContext, context
from localPackages.common.logger import logger
from localPackages.common import firestore_client


def execute(ctx: RequestContext, input_path: str) -> str:
    """
    Step 2: FFmpegで動画を圧縮

    params:
        ctx: RequestContext
        input_path: 入力動画の一時パス

    returns: str - 圧縮後の一時ファイルパス
    """
    logger.start_operation("Step 2: 動画圧縮")

    output_path = os.path.join(ctx.temp_dir, "output_compressed.mp4")

    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx, status="processing",
            message="動画を圧縮中（H.264 MP4、最大480p、容量最小化）",
            current_step="compressing"
        )

    # FFmpeg: 容量最小化 - crf 36, 最大480p, 音声64k（フルHD/4Kは縮小、元が480p以下はそのまま）
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vf", "scale='min(iw,854)':'min(ih,480)'",
        "-c:v", "libx264",
        "-crf", "36",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-b:a", "64k",
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
            logger.error(f"FFmpeg圧縮エラー: {result.stderr}")
            if ctx.collection_name and ctx.document_id:
                firestore_client.log_processing_status(
                    ctx, status="processing",
                    message=f"圧縮エラー: {result.stderr[:200]}",
                    current_step="compressing",
                    error=result.stderr[:500],
                )
            raise RuntimeError(f"FFmpeg圧縮失敗: {result.stderr[:200]}")

        if not os.path.exists(output_path):
            raise RuntimeError(f"圧縮後のファイルが見つかりません: {output_path}")

        output_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        logger.success(f"圧縮完了: {output_path} ({output_size_mb:.2f} MB)")
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx, status="processing",
                message=f"圧縮完了 ({output_size_mb:.2f} MB)",
                current_step="compressing"
            )
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg圧縮タイムアウト")
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx, status="processing",
                message="圧縮がタイムアウトしました",
                current_step="compressing",
                error="Timeout",
            )
        raise RuntimeError("FFmpeg圧縮がタイムアウトしました")

    logger.complete_operation("Step 2: 動画圧縮")
    return output_path
