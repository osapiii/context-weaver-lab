"""
Gemini Text-to-Speech サービス

このサービスは、Gemini AI を使用してテキストから高品質な音声を生成し、
Google Cloud Storage に保存する Web API を提供します。

主な機能:
- テキストから音声への変換（Gemini TTS）
- 音声ファイルの GCS への保存
- 利用可能な音声のリスト表示
- ヘルスチェック
"""

import sys
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv

# 早期に.envファイルを読み込み
logger_debug_info = "🔧 dotenv読み込み試行中..."
try:
    load_dotenv()
    print(f"✅ {logger_debug_info} 成功")
except Exception as e:
    print(f"⚠️ {logger_debug_info} 失敗: {str(e)}")

# ローカルパッケージのインポート（環境変数が読み込まれた後）
try:
    from localPackages.common.context import context
    from localPackages.common.logger import logger
    from localPackages.common.response_formatter import ResponseFormatter
    from localPackages.common import gemini_tts
    from localPackages.common import gcs_storage
    from localPackages.common import firestore_client
    from endpoints.synthesize import execute as synthesize_execute
    from endpoints.voices import execute as voices_execute
    from endpoints.health import execute as health_execute
    from endpoints.test_synthesize import execute as test_synthesize_execute
    logger.start_operation("アプリケーション初期化")
except Exception as e:
    print(f"❌ ローカルパッケージ初期化エラー: {str(e)}")
    sys.exit(1)

# Flaskアプリケーション作成
app = Flask(__name__)

# CORS設定（SwaggerやフロントエンドからのAPIアクセスを許可）
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# グローバルコンテキスト（contextモジュールから取得）
app_context = context

# サービス情報の取得
service_info = app_context.get_service_info()
logger.configuration_loaded("サービス情報", service_info)

# APIクライアントの初期化
try:
    logger.start_operation("API クライアント初期化")

    # プロジェクトIDの確認
    PROJECT_ID = app_context.google_cloud_project
    if not PROJECT_ID:
        raise ValueError("GOOGLE_CLOUD_PROJECT環境変数が設定されていません")

    logger.info(f"🌐 プロジェクトID: {PROJECT_ID}")

    # Chirp 3 HD (Cloud TTS) クライアント初期化
    gemini_tts.initialize_client()

    # Storage クライアント初期化
    gcs_storage.initialize_storage_client()

    # Firestore クライアント初期化（RequestDoc logs追記用）
    firestore_client.initialize_firestore_client()

    logger.success("API クライアント初期化完了")
    logger.complete_operation("API クライアント初期化")

except Exception as e:
    logger.error("API クライアント初期化失敗", error=e)
    logger.error("🚨 認証情報またはプロジェクト設定を確認してください")
    sys.exit(1)

# 起動時バリデーション
try:
    logger.success("起動時バリデーション完了")
except Exception as e:
    logger.error("起動時バリデーション失敗", error=e)
    sys.exit(1)


@app.before_request
def before_request():
    """リクエスト前処理"""
    # OPTIONSリクエスト（CORSプリフライト）はスキップ
    if request.method == 'OPTIONS':
        return

    # リクエストボディからrequest_idを取得（べき等性チェック用）
    request_data = request.get_json() if request.is_json else {}
    incoming_request_id = request_data.get('request_id')

    # 既に処理中または処理済みのrequest_idの場合
    if incoming_request_id and app_context.get_request_context(incoming_request_id):
        existing_ctx = app_context.get_request_context(incoming_request_id)
        logger.warning(f"⚠️ 重複リクエスト検出: {incoming_request_id} - 既存のコンテキストを再利用します")
        g.request_context = existing_ctx
        g.request_id = existing_ctx.request_id
        g.is_duplicate = True
        return

    # ✅ MUST: Flaskリクエストオブジェクトをcontextに格納（必須処理）
    ctx = app_context.create_request_context(request=request)

    # Flask g オブジェクトに保存
    g.request_context = ctx
    g.request_id = ctx.request_id
    g.is_duplicate = False

    logger.info(
        f"📝 リクエスト開始: {ctx.request_id} [{request.method} {request.path}] "
        f"content-length={request.content_length or 0}"
    )

    # リクエストボディが空の場合の警告
    if not ctx.params:
        logger.warning(
            f"⚠️ Context params is empty: {request.method} {request.path} "
            f"content_type={request.content_type}"
        )

    # デバッグモードの場合、リクエスト内容を出力
    if app_context.debug_mode:
        logger.debug("リクエストコンテキスト:")
        logger.debug(ctx.to_dict())

    # ✅ MUST: RequestDoc 黄金テンプレート最低限チェック（/synthesize POST のみ）
    try:
        if request.path == '/synthesize' and request.method == 'POST':
            if not isinstance(ctx.params, dict):
                raise ValueError('Invalid request body')
            if 'request_id' not in ctx.params:
                from localPackages.common.response_formatter import response_formatter
                return response_formatter.error(
                    request_id=None,
                    error_type='ValidationError',
                    message='Invalid request format',
                    details={'field': 'request_id', 'message': 'request_id is required at root level', 'endpoint': '/synthesize'},
                    status_code=400
                )
            if 'input' not in ctx.params or not isinstance(ctx.params.get('input'), dict):
                from localPackages.common.response_formatter import response_formatter
                return response_formatter.error(
                    request_id=ctx.params.get('request_id'),
                    error_type='ValidationError',
                    message='Invalid request format',
                    details={'field': 'input', 'message': 'input object is required at root level', 'endpoint': '/synthesize'},
                    status_code=400
                )
            if 'systemMetadata' not in ctx.params or not isinstance(ctx.params.get('systemMetadata'), dict):
                from localPackages.common.response_formatter import response_formatter
                return response_formatter.error(
                    request_id=ctx.params.get('request_id'),
                    error_type='ValidationError',
                    message='Invalid request format',
                    details={'field': 'systemMetadata', 'message': 'systemMetadata object is required at root level', 'endpoint': '/synthesize'},
                    status_code=400
                )
    except Exception as e:
        from localPackages.common.response_formatter import response_formatter
        return response_formatter.error(
            request_id=None,
            error_type='InternalError',
            message='Failed to pre-validate request',
            details={'exception': type(e).__name__, 'message': str(e)},
            status_code=500
        )


@app.after_request
def after_request(response):
    """リクエスト後処理"""
    if hasattr(g, 'request_id'):
        if hasattr(g, 'request_context'):
            ctx = g.request_context
            processing_time = (datetime.utcnow() - ctx.timestamp).total_seconds()
            ctx.processing_time = processing_time

            logger.info(f"✅ リクエスト完了: {g.request_id} "
                       f"[{response.status_code}] [{processing_time:.2f}秒]")

            # コンテキストのクリーンアップ
            app_context.remove_request_context(g.request_id)

    return response


@app.route('/synthesize', methods=['POST'])
def synthesize():
    """音声合成エンドポイント - endpoints/synthesize/execute.pyに委譲"""
    return synthesize_execute.handle(g.request_context)


@app.route('/voices', methods=['GET'])
def voices():
    """音声リストエンドポイント - endpoints/voices/execute.pyに委譲"""
    return voices_execute.handle()


@app.route('/health', methods=['GET'])
def health():
    """ヘルスチェックエンドポイント - endpoints/health/execute.pyに委譲"""
    return health_execute.handle()


@app.route('/test-synthesize', methods=['POST'])
def test_synthesize():
    """テスト音声合成エンドポイント - endpoints/test_synthesize/execute.pyに委譲"""
    return test_synthesize_execute.handle(g.request_context)


@app.errorhandler(404)
def not_found(error):
    """404エラーハンドラー（ResponseFormatter使用）"""
    request_id = g.request_id if hasattr(g, 'request_id') else None
    return ResponseFormatter.error(
        request_id=request_id,
        error_type="NotFoundError",
        message=f"Endpoint not found: {request.method} {request.path}",
        details={
            "path": request.path,
            "method": request.method
        },
        status_code=404
    )


@app.errorhandler(500)
def internal_error(error):
    """500エラーハンドラー（ResponseFormatter使用）"""
    logger.error("内部サーバーエラー", error=error)
    request_id = g.request_id if hasattr(g, 'request_id') else None
    return ResponseFormatter.error(
        request_id=request_id,
        error_type="InternalError",
        message="Internal server error",
        details={
            "exception": type(error).__name__,
            "message": str(error)
        },
        status_code=500
    )


def cleanup_old_contexts():
    """古いリクエストコンテキストをクリーンアップ"""
    try:
        removed_count = app_context.cleanup_old_contexts(max_age_seconds=3600)
        if removed_count > 0:
            logger.info(f"🧹 古いコンテキストをクリーンアップ: {removed_count}件削除")
    except Exception as e:
        logger.error("コンテキストクリーンアップエラー", error=e)


if __name__ == "__main__":
    try:
        logger.start_operation("サービス開始準備")

        port = app_context.port
        service_name = app_context.service_name

        startup_info = {
            "service_name": service_name,
            "service_version": app_context.service_version,
            "port": port,
            "host": "0.0.0.0",
            "debug_mode": app_context.debug_mode,
            "environment": "development" if app_context.debug_mode else "production",
            "default_voice": app_context.default_voice_name,
            "api_type": "Gemini TTS"
        }
        logger.configuration_loaded("サービス起動設定", startup_info)

        logger.success(f"🎉 {service_name} サービスを開始します")
        logger.info(f"🌐 アクセス URL: http://localhost:{port}")
        logger.info(f"❤️  ヘルスチェック: http://localhost:{port}/health")
        logger.info(f"🎤 音声リスト: http://localhost:{port}/voices")
        logger.info(f"🔊 音声合成: http://localhost:{port}/synthesize")
        logger.info(f"🧪 テスト合成: http://localhost:{port}/test-synthesize")

        logger.complete_operation("サービス開始準備")

        app.run(host="0.0.0.0", port=port, debug=app_context.debug_mode)

    except Exception as e:
        logger.error("サービス開始エラー", error=e)
        sys.exit(1)
