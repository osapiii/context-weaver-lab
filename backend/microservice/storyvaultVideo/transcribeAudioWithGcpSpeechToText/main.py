"""
Aqua Voice文字起こしサービス（Orchestratorパターン）

このサービスは、Aqua Voice Avalon APIを使用してGCSの音声/動画ファイルから
文字起こしを実行し、結果をGoogle Cloud Storageに保存するWeb APIを提供します。

main.pyはOrchestrator（ルーティングのみ）として機能し、
全てのビジネスロジックはendpoints/モジュールに委譲します。
"""

import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# 早期に.envファイルを読み込み
load_dotenv()

from datadog_llmobs import init_datadog_llmobs

init_datadog_llmobs()

# ローカルパッケージのインポート
try:
    from localPackages.common import context, logger
    from localPackages.common import gcs_storage
    from endpoints import transcribe, health
    logger.logger.info("🚀 アプリケーション初期化開始")
except Exception as e:
    print(f"❌ ローカルパッケージ初期化エラー: {str(e)}")
    sys.exit(1)

# Flaskアプリケーション作成
app = Flask(__name__)

# CORS設定
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# サービス情報の取得
service_info = context.get_service_info()
logger.logger.info(f"📋 サービス情報: {service_info}")

# クライアントの初期化
try:
    logger.logger.info("🔧 クライアント初期化開始")

    # Storage クライアント初期化
    gcs_storage.initialize_storage_client()

    logger.logger.info("✅ 全クライアント初期化完了")
    logger.logger.info(f"🎙️  Aqua Voice Avalon: model={context.config.aqua_voice_model}, key_configured={bool(context.config.aqua_voice_api_key)}")
    logger.logger.info("🗄️  Google Cloud Storage: ADC認証使用")
    logger.logger.info("🔥 Cloud Firestore: ADC認証使用")

except Exception as e:
    logger.logger.error(f"❌ クライアント初期化失敗: {str(e)}")
    sys.exit(1)


@app.before_request
def before_request():
    """リクエスト前処理"""
    # OPTIONSリクエスト（CORSプリフライト）はスキップ
    if request.method == 'OPTIONS':
        return

    # Flaskリクエストオブジェクトを設定
    context.set_request(request)

    request_data = request.get_json(silent=True) or {}
    request_id = request_data.get("request_id", "unknown")

    logger.logger.info(f"📝 リクエスト開始: {request_id} [{request.method} {request.path}]")


@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """
    GCS上の音声/動画ファイルをAqua Voiceで文字起こしし、結果をGCSに保存する
    
    RequestDoc準拠の入力形式:
    {
        "request_id": "req_20241005_120000_abc",
        "input": {
            "mode": "videoFile" | "audioFile",  # "youtube"モードは非対応
            "sourceFileBucketName": "bucket-name",
            "sourceFilePath": "path/to/file.mp4",
            "outputBucketName": "bucket-name",
            "outputFilePath": "path/to/output.json",
            "enableParagraphFormatting": true,
            "videoId": "video_123",
            "projectId": "project_456"
        },
        "systemMetadata": {
            "organizationId": "org_abc123",
            "spaceId": "space_xyz789",
            "loggingCollectionId": "col_789",
            "loggingDocumentId": "doc_012",
            "requestedBy": {"email": "user@example.com", "role": 2},
            "isCommand": false,
            "isOouiCrud": true,
            "isLlmCall": false,
            "isAdminCrud": false
        }
    }
    
    ResponseFormatter統一形式の出力（TypeScript RequestDoc準拠）:
    {
        "status": "success",
        "request_id": "req_20241005_120000_abc",
        "output": {
            "transcriptionPath": "gs://bucket-name/path/to/output.json",  # ✅ camelCase
            "transcriptionBucketName": "bucket-name",  # ✅ camelCase
            "transcriptionFilePath": "path/to/output.json",  # ✅ camelCase
            "transcriptionId": "aqua_voice_operation_id",  # ✅ camelCase
            "processingTime": 15.3,  # ✅ camelCase
            "statistics": {
                "characterCount": 1234,  # ✅ camelCase
                "language": "ja",
                "languageConfidence": 0.98,  # ✅ camelCase
                "durationSeconds": 120.5  # ✅ camelCase
            },
            "paragraphCount": 5  # ✅ camelCase
        },
        "timestamp": "2024-10-05T12:00:00.000Z"
    }
    """
    request_data = request.get_json() or {}
    # payloadNotSet対策: 空ボディ・不正形式時のデバッグログ
    if not request_data:
        logger.logger.warning("⚠️ Empty request body received - expected JSON with request_id, input, systemMetadata")
    elif not isinstance(request_data, dict):
        logger.logger.warning(f"⚠️ Request body is not a dict: type={type(request_data)}")
    else:
        logger.logger.info(f"📥 Request keys: {list(request_data.keys())}, has_input={('input' in request_data)}, has_systemMetadata={('systemMetadata' in request_data)}")

    # endpoints/transcribe/execute.pyに委譲
    response_body, status_code = transcribe.execute.execute(request_data)

    return jsonify(response_body), status_code


@app.route('/health', methods=['GET'])
def health_check():
    """ヘルスチェックエンドポイント"""
    # endpoints/health/execute.pyに委譲
    response_body, status_code = health.execute.execute()

    return jsonify(response_body), status_code


@app.errorhandler(404)
def not_found(error):
    """404エラーハンドラー"""
    return jsonify({
        "error": "Endpoint not found",
        "path": request.path,
        "method": request.method
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """500エラーハンドラー"""
    logger.logger.error(f"内部サーバーエラー: {error}")
    return jsonify({
        "error": "Internal server error",
        "message": str(error)
    }), 500


if __name__ == "__main__":
    try:
        port = context.config.port
        service_name = context.config.service_name

        logger.logger.info(f"🎉 {service_name} サービスを開始します")
        logger.logger.info(f"🌐 アクセス URL: http://localhost:{port}")
        logger.logger.info(f"❤️  ヘルスチェック: http://localhost:{port}/health")
        logger.logger.info(f"📝 文字起こし: http://localhost:{port}/transcribe")

        # Flaskアプリケーション開始
        app.run(host="0.0.0.0", port=port, debug=context.config.debug_mode)

    except Exception as e:
        logger.logger.error(f"サービス開始エラー: {e}")
        sys.exit(1)
