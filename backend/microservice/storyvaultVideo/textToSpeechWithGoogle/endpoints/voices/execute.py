"""
/voices エンドポイント実装

利用可能な音声モデルのリストを取得します。
"""

from flask import request
from localPackages.common.logger import logger
from localPackages.common import gemini_tts
from localPackages.common.response_formatter import ResponseFormatter


def handle():
    """
    /voices エンドポイント処理

    returns: Flask Response - 音声リストJSONレスポンス
    """
    try:
        logger.start_operation("音声リスト取得")

        # クエリパラメータ取得（将来の拡張用）
        language_code = request.args.get('language_code')
        if language_code:
            logger.info(f"言語フィルタ: {language_code}")

        # Chirp 3 HD の音声リストを取得（Perse → Leda マッピングを含む）
        voice_data = gemini_tts.get_available_voices()

        logger.data_analysis("音声リスト取得結果", {
            "total_voices": voice_data["total_count"],
            "requested_language": language_code or "all"
        })

        logger.complete_operation("音声リスト取得")

        # ✅ MUST: ResponseFormatter統一レスポンス形式に準拠
        # status と request_id を含む構造に統一（/voices はリクエストIDなしのため None 設定）
        return ResponseFormatter.success(
            request_id=None,
            output={
                "voices": voice_data.get("voices", []),
                "total_voices": voice_data.get("total_count", 0)
            }
        )

    except Exception as e:
        logger.error("音声リスト取得エラー", error=e)
        return ResponseFormatter.error(
            request_id=None,
            error_type="InternalError",
            message="Failed to list voices",
            details={
                "exception": type(e).__name__,
                "message": str(e)
            },
            status_code=500
        )
