"""
/test-synthesize エンドポイント実装

テスト用の音声合成エンドポイント（Base64レスポンス）
GCSにアップロードせず、Base64エンコードした音声データを返します。
"""

import base64
from flask import request, jsonify, g
from localPackages.common.context import context, RequestContext
from localPackages.common.logger import logger
from localPackages.common import gemini_tts
from localPackages.common import audio_processor


def handle(ctx: RequestContext):
    """
    /test-synthesize エンドポイント処理

    params: {
        ctx: RequestContext - リクエストコンテキスト
    }

    returns: Flask Response - Base64音声データJSONレスポンス
    """
    try:
        data = request.get_json()
        if not data:
            data = {}

        # デフォルト値を設定
        if 'text' not in data:
            data['text'] = 'こんにちは、Gemini音声合成のテストです。'

        # リクエストコンテキストの作成（簡易版）
        ctx.text = data.get('text')
        ctx.voice_name = data.get('voice', {}).get('name') if 'voice' in data else None

        logger.start_operation(f"テスト音声合成 [{ctx.request_id}]")

        # 音声合成（ストリーミング）
        audio_chunks = []
        for chunk in gemini_tts.synthesize_speech_stream(ctx):
            audio_chunks.append(chunk)

        # 音声データの処理
        audio_data = audio_processor.process_gemini_audio_stream(ctx, audio_chunks)

        # Base64エンコード
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        response_data = {
            "success": True,
            "request_id": ctx.request_id,
            "audio_base64": audio_base64,
            "audio_size_bytes": len(audio_data),
            "text": ctx.text,
            "voice_config": {
                "voice_name": ctx.voice_name
            },
            "audio_format": ctx.metadata.get("audio_format", "MP3")
        }

        logger.success(f"テスト音声合成完了 [{ctx.request_id}]",
                      text_length=len(ctx.text),
                      audio_size=len(audio_data))

        # コンテキストのクリーンアップ
        context.remove_request_context(ctx.request_id)

        return jsonify(response_data), 200

    except Exception as e:
        logger.error("テスト音声合成エラー", error=e)
        if hasattr(g, 'request_id'):
            context.remove_request_context(g.request_id)
        return jsonify({
            "error": str(e),
            "request_id": g.request_id if hasattr(g, 'request_id') else None
        }), 500
