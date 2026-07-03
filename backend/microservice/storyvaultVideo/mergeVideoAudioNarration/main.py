"""
動画・音声ナレーション合成マイクロサービス

このサービスは、動画ファイルと音声ナレーションをタイムスタンプベースで合成し、
Google Cloud Storage に保存する Web API を提供します。

主な機能:
- GCS から動画と音声ファイルをダウンロード
- タイムスタンプに基づいて音声を動画に合成
- 合成された動画を GCS にアップロード
- Firestore への進捗ログ記録

RequestDoc黄金テンプレート準拠
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

# ローカルパッケージのインポート
try:
    from localPackages.common.context import context
    from localPackages.common.logger import logger
    from localPackages.common.response_formatter import ResponseFormatter
    from localPackages.common import gcs_storage
    from localPackages.common import firestore_client
    from endpoints.merge import execute as merge_execute
    from endpoints.health import execute as health_execute
    logger.start_operation("アプリケーション初期化")
except Exception as e:
    print(f"❌ ローカルパッケージ初期化エラー: {str(e)}")
    sys.exit(1)

# Flaskアプリケーション作成
app = Flask(__name__)

# CORS設定（SwaggerとFirebase Background関数からのAPIアクセスを許可）
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

    # GETリクエスト（/health）はスキップ
    if request.method == 'GET':
        return

    # ✅ RequestDoc黄金テンプレート準拠の事前検証
    if request.path == '/merge' and request.method == 'POST':
        # 🆕 デバッグ用: リクエストボディの詳細ログ
        logger.info(f"🔍 Request body debug:")
        logger.info(f"  - Content-Type: {request.headers.get('Content-Type', 'Not set')}")
        logger.info(f"  - Content-Length: {request.headers.get('Content-Length', 'Not set')}")
        logger.info(f"  - Request data type: {type(request.get_data())}")
        logger.info(f"  - Request data length: {len(request.get_data())}")
        logger.info(f"  - Request data (first 500 chars): {request.get_data(as_text=True)[:500]}")
        
        request_data = request.get_json() or {}
        
        # 🆕 デバッグ用: パース後のリクエストデータ
        logger.info(f"🔍 Parsed request_data:")
        logger.info(f"  - Type: {type(request_data)}")
        logger.info(f"  - Keys: {list(request_data.keys()) if isinstance(request_data, dict) else 'Not a dict'}")
        logger.info(f"  - Has request_id: {'request_id' in request_data if isinstance(request_data, dict) else False}")
        logger.info(f"  - Has input: {'input' in request_data if isinstance(request_data, dict) else False}")
        logger.info(f"  - Has systemMetadata: {'systemMetadata' in request_data if isinstance(request_data, dict) else False}")

        # 必須フィールドの検証
        if 'request_id' not in request_data:
            logger.error("❌ request_id が欠落しています")
            return ResponseFormatter.error(
                message="request_id is required",
                status_code=400,
                error_type="ValidationError"
            )

        if 'input' not in request_data:
            logger.error("❌ input オブジェクトが欠落しています")
            return ResponseFormatter.error(
                message="input object is required",
                status_code=400,
                request_id=request_data.get('request_id'),
                error_type="ValidationError"
            )

        if 'systemMetadata' not in request_data:
            logger.error("❌ systemMetadata オブジェクトが欠落しています")
            return ResponseFormatter.error(
                message="systemMetadata object is required",
                status_code=400,
                request_id=request_data.get('request_id'),
                error_type="ValidationError"
            )

    # ✅ MUST: Flaskリクエストオブジェクトをcontextに格納（必須処理）
    ctx = app_context.create_request_context(request=request)

    g.request_context = ctx
    g.request_id = ctx.request_id

    logger.info(f"📝 リクエスト開始: {ctx.request_id} [{request.method} {request.path}]")

    if app_context.debug_mode:
        logger.debug(f"リクエストボディ: {request.get_json()}")


@app.route('/merge', methods=['POST'])
def merge():
    """
    POST /merge - 動画と音声ナレーションを合成

    RequestDoc黄金テンプレート準拠のエンドポイント
    """
    try:
        return merge_execute(request)
    except Exception as e:
        logger.error(f"❌ /merge エラー: {str(e)}", error=e)
        return ResponseFormatter.error(
            message=f"Merge processing failed: {str(e)}",
            status_code=500,
            request_id=g.get('request_id', 'unknown')
        )


@app.route('/health', methods=['GET'])
def health():
    """
    GET /health - ヘルスチェック
    """
    try:
        return health_execute()
    except Exception as e:
        logger.error(f"❌ /health エラー: {str(e)}", error=e)
        return ResponseFormatter.error(
            message=f"Health check failed: {str(e)}",
            status_code=500
        )


if __name__ == '__main__':
    # Cloud Runはポート8080を使用
    port = int(app_context.port) if hasattr(app_context, 'port') else 8080
    logger.info(f"🚀 サービス起動: ポート {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
