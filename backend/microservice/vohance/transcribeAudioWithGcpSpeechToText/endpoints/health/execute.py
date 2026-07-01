"""
Healthエンドポイント実行モジュール（Aqua Voice版）

サービスの健全性と外部API設定状態をチェックします。
"""

import time
from typing import Dict, Any, Tuple
from localPackages.common.logger import logger
from localPackages.common.context import context
from localPackages.common import gcs_storage


def execute() -> Tuple[Dict[str, Any], int]:
    """
    ヘルスチェックを実行
    
    returns: Tuple[Dict[str, Any], int] -
             (レスポンスボディ, HTTPステータスコード)
    """
    try:
        # GCS接続確認
        gcs_access = gcs_storage.validate_gcs_access()
        
        # Aqua Voice API設定確認
        aqua_voice_ready = _check_aqua_voice_configuration()
        
        # 全体のステータス判定
        all_healthy = gcs_access and aqua_voice_ready
        status = "healthy" if all_healthy else "degraded"
        
        health_info = {
            "status": status,
            "service": context.get_service_info(),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "api_status": {
                "gcs_access": gcs_access,
                "aqua_voice_api": aqua_voice_ready
            },
            "configuration": {
                "aqua_voice_base_url": context.config.aqua_voice_base_url,
                "aqua_voice_model": context.config.aqua_voice_model,
                "timeout": context.config.aqua_voice_timeout,
                "paragraph_formatting": context.config.enable_paragraph_formatting
            }
        }

        # エラー詳細を追加
        if not all_healthy:
            errors = []
            if not gcs_access:
                errors.append("GCS access not available")
            if not aqua_voice_ready:
                errors.append("AQUA_VOICE_API_KEY is not configured")
            health_info["errors"] = errors

        status_code = 200 if status == "healthy" else 503
        return health_info, status_code

    except Exception as e:
        logger.error(f"❌ ヘルスチェックエラー: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
        }, 500


def _check_aqua_voice_configuration() -> bool:
    """
    Aqua Voice API設定状態を確認
    
    returns: bool - 設定済みの場合True
    """
    if context.config.aqua_voice_api_key:
        logger.info("✅ Aqua Voice APIキー設定確認成功")
        return True

    logger.error("❌ Aqua Voice APIキーが未設定です")
    return False
