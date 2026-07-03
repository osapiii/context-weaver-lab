"""
/health エンドポイント実装

サービスの稼働状態とAPIクライアントの接続状態を確認します。
"""

import sys
from datetime import datetime
from flask import jsonify
from localPackages.common.context import context
from localPackages.common.logger import logger
from localPackages.common import gemini_tts
from localPackages.common import gcs_storage
from localPackages.common.response_formatter import ResponseFormatter


def handle():
    """
    /health エンドポイント処理

    returns: Flask Response - ヘルスチェック結果JSONレスポンス
    """
    logger.start_operation("ヘルスチェック")

    try:
        # サービス情報取得
        service_info = context.get_service_info()

        # Chirp 3 HD (Cloud TTS) API接続確認
        try:
            gemini_tts.initialize_client()
            gemini_status = "connected"
        except Exception as e:
            gemini_status = f"error: {str(e)}"

        # GCS接続確認
        try:
            gcs_status = "assumed_connected"  # 実際のバケットチェックは省略
        except Exception as e:
            gcs_status = f"error: {str(e)}"

        health_info = {
            "status": "healthy" if gemini_status == "connected" else "degraded",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "service_info": service_info,
            "environment": {
                "python_version": sys.version.split()[0],
                "debug_mode": context.debug_mode,
                "auth_method": context.get_auth_method()
            },
            "configuration": {
                "default_voice_name": context.default_voice_name,
                "default_language_code": context.default_language_code,
                "default_audio_encoding": context.default_audio_encoding,
                "max_text_length": context.max_text_length,
                "available_voices": context.available_voices
            },
            "api_status": {
                "gemini_tts": gemini_status,
                "storage": gcs_status
            }
        }

        # アクティブなリクエスト数を追加
        health_info["active_requests"] = len(context.request_contexts)

        logger.data_analysis("ヘルスチェック結果", health_info)
        logger.success("ヘルスチェック完了")

        status_code = 200 if health_info["status"] == "healthy" else 503

        # ✅ MUST: ResponseFormatter統一レスポンス
        return ResponseFormatter.success(
            request_id=None,
            output=health_info,
            status_code=status_code
        )

    except Exception as e:
        logger.error("ヘルスチェックエラー", error=e)
        return ResponseFormatter.error(
            request_id=None,
            error_type="InternalError",
            message="Health check failed",
            details={
                "exception": type(e).__name__,
                "message": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            },
            status_code=500
        )
