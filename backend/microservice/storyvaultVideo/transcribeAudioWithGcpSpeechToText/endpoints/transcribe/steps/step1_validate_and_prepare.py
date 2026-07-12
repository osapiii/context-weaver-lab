"""
Step 1: モード検証とソース準備（Aqua Voice版）

入力パラメータの検証、GCS URI構築を実行します。
YouTube URLモードは非対応で、GCS音声/動画ファイルのみをサポートします。
"""

import os
from typing import Dict, Any, Tuple
from localPackages.common.logger import logger
from localPackages.common.context import RequestContext
from localPackages.common import gcs_storage


def execute(ctx: RequestContext) -> Tuple[bool, str, Dict[str, Any]]:
    """
    モード検証とソース準備を実行
    
    params: {
        ctx: RequestContext - リクエストコンテキスト
    }
    
    returns: Tuple[bool, str, Dict[str, Any]] -
             (成功フラグ, GCS URI, エラー詳細)
    """
    logger.start_operation("step1_validate_and_prepare")

    try:
        # videoFileまたはaudioFileモードのみサポート
        if ctx.mode not in ['videoFile', 'audioFile']:
            error_details = {
                "step": "mode_validation",
                "message": f"youtube mode is not supported. Use audioFile or videoFile mode with GCS path. Received mode: {ctx.mode}",
                "supported_modes": ["audioFile", "videoFile"]
            }
            logger.error(f"❌ サポート外のモード: {ctx.mode}")
            logger.complete_operation("step1_validate_and_prepare", success=False)
            return False, "", error_details

        # GCS URIを構築
        if not ctx.source_file_bucket_name or not ctx.source_file_path:
            error_details = {
                "step": "gcs_uri_construction",
                "message": "sourceFileBucketName and sourceFilePath are required"
            }
            logger.error("❌ GCSパラメータが不足しています")
            logger.complete_operation("step1_validate_and_prepare", success=False)
            return False, "", error_details

        gcs_uri = f"gs://{ctx.source_file_bucket_name}/{ctx.source_file_path}"
        mode_label = "音声" if ctx.mode == 'audioFile' else "動画"
        logger.info(f"📁 {mode_label}ファイルのGCS URIを構築: {gcs_uri}")

        # GCSファイルの存在確認
        exists = gcs_storage.file_exists(
            ctx.source_file_bucket_name,
            ctx.source_file_path
        )

        if not exists:
            error_details = {
                "step": "gcs_file_validation",
                "message": f"Source file not found in GCS: {gcs_uri}"
            }
            logger.error(f"❌ GCSファイルが存在しません: {gcs_uri}")
            logger.complete_operation("step1_validate_and_prepare", success=False)
            return False, "", error_details

        logger.info(f"✅ GCSファイルの存在を確認: {gcs_uri}")

        # videoFileモードの場合、音声抽出が必要（Step 2で処理）
        if ctx.mode == 'videoFile':
            logger.info("🎬 動画ファイルモード: Step 2で音声抽出を実行します")

        logger.complete_operation("step1_validate_and_prepare", success=True)
        return True, gcs_uri, {}

    except Exception as e:
        error_details = {
            "step": "step1_validate_and_prepare",
            "message": f"Unexpected error: {str(e)}",
            "error_type": type(e).__name__
        }
        logger.error(f"❌ Step 1でエラー発生: {str(e)}")
        logger.complete_operation("step1_validate_and_prepare", success=False)
        return False, "", error_details
