"""
/health エンドポイント実装

ヘルスチェック用のエンドポイントです。
"""

from datetime import datetime
from flask import jsonify
from localPackages.common.logger import logger
from localPackages.common.response_formatter import response_formatter


def handle():
    """
    /health エンドポイント処理

    returns: Flask Response - JSONレスポンス
    """
    try:
        logger.info("ヘルスチェックリクエスト受信")
        
        health_data = {
            "status": "healthy",
            "service": "ai-video-sectioning",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        return jsonify(health_data), 200
        
    except Exception as e:
        logger.error("ヘルスチェックエラー", error=e)
        return response_formatter.error(
            request_id=None,
            error_type="InternalError",
            message="Health check failed",
            details={
                "exception": type(e).__name__,
                "message": str(e)
            },
            status_code=500
        )
