"""
Step 2: GCSアップロード処理

生成された音声データをGoogle Cloud Storageにアップロードします。
"""

from typing import Dict, Any
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import gcs_storage


def execute(ctx: RequestContext, audio_data: bytes) -> Dict[str, Any]:
    """
    Step 2: 音声データをGCSにアップロード

    params: {
        ctx: RequestContext - リクエストコンテキスト
            - ctx.output_gcs_path: GCS出力パス（gs://bucket/path形式）
        audio_data: bytes - アップロードする音声データ
    }

    returns: Dict[str, Any] - アップロード結果
        - gcs_path: アップロード先GCSパス
        - audio_size_bytes: 音声ファイルサイズ
    """
    logger.start_operation("Step 2: GCSアップロード")

    # GCSに保存
    save_result = gcs_storage.save_audio_to_gcs(ctx, audio_data)

    logger.success(f"GCSアップロード完了: {ctx.output_gcs_path}")
    logger.complete_operation("Step 2: GCSアップロード")

    return {
        "gcs_path": ctx.output_gcs_path,
        "audio_size_bytes": len(audio_data)
    }
