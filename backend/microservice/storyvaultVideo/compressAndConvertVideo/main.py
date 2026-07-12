"""
動画圧縮・変換マイクロサービス

GCSから動画をダウンロードし、FFmpegで圧縮（WebM/MKV→H.264 MP4）して
file/compressed/ にアップロード。Firestoreのvideoドキュメントを更新。
"""

import sys
from datetime import datetime
from flask import Flask, request, g
from flask_cors import CORS
from dotenv import load_dotenv

try:
    load_dotenv()
except Exception as e:
    print(f"⚠️ dotenv読み込み失敗: {str(e)}")

try:
    from localPackages.common.context import context
    from localPackages.common.logger import logger
    from localPackages.common.response_formatter import ResponseFormatter
    from localPackages.common import gcs_storage, firestore_client
    from endpoints.compress import execute as compress_execute
    from endpoints.health import execute as health_execute
    logger.start_operation("アプリケーション初期化")
except Exception as e:
    print(f"❌ ローカルパッケージ初期化エラー: {str(e)}")
    sys.exit(1)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})
app_context = context

try:
    PROJECT_ID = app_context.google_cloud_project
    if not PROJECT_ID:
        raise ValueError("GOOGLE_CLOUD_PROJECT環境変数が設定されていません")
    gcs_storage.initialize_storage_client()
    firestore_client.initialize_firestore_client()
    logger.success("API クライアント初期化完了")
except Exception as e:
    logger.error("API クライアント初期化失敗", error=e)
    sys.exit(1)


@app.before_request
def before_request():
    if request.method == "OPTIONS":
        return
    ctx = app_context.create_request_context(request=request)
    g.request_context = ctx
    g.request_id = ctx.request_id
    logger.info(f"📝 リクエスト開始: {ctx.request_id} [{request.method} {request.path}]")


@app.after_request
def after_request(response):
    if hasattr(g, "request_id") and hasattr(g, "request_context"):
        ctx = g.request_context
        ctx.processing_time = (datetime.utcnow() - ctx.timestamp).total_seconds()
        logger.info(f"✅ リクエスト完了: {g.request_id} [{response.status_code}]")
        app_context.remove_request_context(g.request_id)
    return response


@app.route("/compress", methods=["POST"])
def compress():
    """動画圧縮エンドポイント"""
    return compress_execute.handle(g.request_context)


@app.route("/health", methods=["GET"])
def health():
    """ヘルスチェックエンドポイント"""
    return health_execute.handle()


@app.errorhandler(404)
def not_found(error):
    return ResponseFormatter.error(
        request_id=g.request_id if hasattr(g, "request_id") else None,
        error_type="NotFoundError",
        message=f"Endpoint not found: {request.method} {request.path}",
        details={"path": request.path, "method": request.method},
        status_code=404
    )


@app.errorhandler(500)
def internal_error(error):
    logger.error("内部サーバーエラー", error=error)
    return ResponseFormatter.error(
        request_id=g.request_id if hasattr(g, "request_id") else None,
        error_type="InternalError",
        message="Internal server error",
        details={"exception": type(error).__name__, "message": str(error)},
        status_code=500
    )


if __name__ == "__main__":
    port = app_context.port
    logger.success(f"🎉 {app_context.service_name} サービスを開始")
    logger.info(f"🌐 アクセス URL: http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=app_context.debug_mode)
