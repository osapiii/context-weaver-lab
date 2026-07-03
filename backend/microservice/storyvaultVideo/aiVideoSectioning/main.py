"""
AI動画セクション化マイクロサービス

このサービスは、Gemini structuredOutputを使用して動画を自動的に分析し、
適切なセクションに分割して、動画と音声をカットしてGCSに保存するWeb APIを提供します。

主な機能:
- GCSから動画をダウンロード
- Gemini structuredOutputで動画を分析してセクション配列を取得
- 各セクションごとに動画カット・音声分離/カット
- 分割された動画と音声をGCSにアップロード
- Firestore への進捗ログ記録
"""

import sys
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv

# .envファイルを読み込み
try:
    load_dotenv()
    print("✅ dotenv読み込み成功")
except Exception as e:
    print(f"⚠️ dotenv読み込み失敗: {str(e)}")

from datadog_llmobs import init_datadog_llmobs

init_datadog_llmobs()

# ローカルパッケージのインポート
try:
    from localPackages.common.context import context
    from localPackages.common.logger import logger
    from localPackages.common.response_formatter import ResponseFormatter
    from localPackages.common import gcs_storage
    from localPackages.common import firestore_client
    from endpoints.auto_section import execute as auto_section_execute
    from endpoints.health import execute as health_execute
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

# グローバルコンテキスト（context.pyからインスタンスを取得）
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
    
    # Storage クライアント初期化
    gcs_storage.initialize_storage_client()
    
    # Firestore クライアント初期化
    firestore_client.initialize_firestore_client()
    
    logger.success("API クライアント初期化完了")
    logger.complete_operation("API クライアント初期化")
    
except Exception as e:
    logger.error("API クライアント初期化失敗", error=e)
    sys.exit(1)


@app.before_request
def before_request():
    """リクエスト前処理"""
    # OPTIONSリクエスト（CORSプリフライト）はスキップ
    if request.method == 'OPTIONS':
        return

    # ✅ MUST: Flaskリクエストオブジェクトをcontextに格納（必須処理）
    ctx = app_context.create_request_context(request=request)

    g.request_context = ctx
    g.request_id = ctx.request_id

    logger.info(f"📝 リクエスト開始: {ctx.request_id} [{request.method} {request.path}]")

    if app_context.debug_mode:
        logger.debug("リクエストコンテキスト:")
        logger.debug(ctx.to_dict())


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
            
            app_context.remove_request_context(g.request_id)
    
    return response


@app.route('/auto-section', methods=['POST'])
def auto_section():
    """AI動画セクション化エンドポイント - endpoints/auto_section/execute.pyに委譲"""
    return auto_section_execute.handle(g.request_context)


@app.route('/health', methods=['GET'])
def health():
    """ヘルスチェックエンドポイント - endpoints/health/execute.pyに委譲"""
    return health_execute.handle()


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
            "environment": "development" if app_context.debug_mode else "production"
        }
        logger.configuration_loaded("サービス起動設定", startup_info)

        logger.success(f"🎉 {service_name} サービスを開始します")
        logger.info(f"🌐 アクセス URL: http://localhost:{port}")
        logger.info(f"❤️  ヘルスチェック: http://localhost:{port}/health")
        logger.info(f"🤖 AI動画セクション化: http://localhost:{port}/auto-section")

        logger.complete_operation("サービス開始準備")

        app.run(host="0.0.0.0", port=port, debug=app_context.debug_mode)

    except Exception as e:
        logger.error("サービス開始エラー", error=e)
        sys.exit(1)
