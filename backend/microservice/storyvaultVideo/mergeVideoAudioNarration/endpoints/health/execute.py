"""
/health エンドポイント実装

サービスの稼働状態とAPIクライアントの接続状態を確認します。
"""

import sys
from datetime import datetime
from flask import jsonify
from localPackages.common.context import context
from localPackages.common.logger import logger
from localPackages.common import gcs_storage
from localPackages.common import firestore_client


def handle():
    """
    /health エンドポイント処理

    returns: Flask Response - JSONレスポンス
    """
    logger.start_operation("ヘルスチェック")

    try:
        service_info = context.get_service_info()

        # GCS接続確認
        try:
            gcs_status = "connected" if gcs_storage.test_connection() else "error"
        except Exception as e:
            gcs_status = f"error: {str(e)}"

        # Firestore接続確認
        try:
            firestore_status = "connected" if firestore_client.test_connection() else "error"
        except Exception as e:
            firestore_status = f"error: {str(e)}"

        # MoviePy確認
        try:
            import moviepy
            moviepy_version = moviepy.__version__
            moviepy_status = "available"
        except Exception as e:
            moviepy_version = "unknown"
            moviepy_status = f"error: {str(e)}"

        dependency_status = (
            "healthy" if gcs_status == "connected" and firestore_status == "connected" else "degraded"
        )

        health_info = {
            "status": "healthy",
            "dependencyStatus": dependency_status,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "service": "mergeVideoAudioNarration",
            "service_info": service_info,
            "environment": {
                "python_version": sys.version.split()[0],
                "debug_mode": context.debug_mode,
                "moviepy_version": moviepy_version
            },
            "api_status": {
                "storage": gcs_status,
                "firestore": firestore_status,
                "moviepy": moviepy_status
            }
        }

        logger.data_analysis("ヘルスチェック結果", health_info)
        logger.success("ヘルスチェック完了")

        return jsonify(health_info), 200

    except Exception as e:
        logger.error("ヘルスチェックエラー", error=e)
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }), 500
