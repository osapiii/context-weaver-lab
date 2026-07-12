"""
Context管理モジュール（規約準拠版）

グローバル設定とリクエストコンテキストを一元管理します。
"""

import os
import uuid
from typing import Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, field
from flask import Request


def generate_request_id() -> str:
    """リクエストIDを生成"""
    return f"req_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8]}"


@dataclass
class RequestContext:
    """
    リクエスト単位のコンテキスト情報

    文字起こしリクエストの全ライフサイクルで必要な情報を保持します。
    """
    # リクエスト基本情報
    request_id: str = field(default_factory=generate_request_id)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    # 入力パラメータ
    mode: Optional[str] = None
    source: Optional[str] = None
    source_file_bucket_name: Optional[str] = None
    source_file_path: Optional[str] = None
    output_bucket_name: Optional[str] = None
    output_file_path: Optional[str] = None

    # メタデータ
    organization_id: Optional[str] = None
    video_id: Optional[str] = None
    project_id: Optional[str] = None
    logging_collection_id: Optional[str] = None
    logging_document_id: Optional[str] = None

    # 文字起こし関連
    transcription_id: Optional[str] = None
    transcription_status: Optional[str] = None

    # 処理結果
    transcription_text: Optional[str] = None
    processing_time: Optional[float] = None

    # LLM処理結果（段落分割）
    llm_output: Optional[Dict[str, Any]] = None

    # 統計情報
    statistics: Dict[str, Any] = field(default_factory=dict)

    # その他メタデータ
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GlobalConfig:
    """
    グローバル設定情報

    環境変数から読み込まれる設定値を管理します。
    """
    # サービス基本情報
    service_name: str = "transcribe-audio-with-gcp-speech-to-text"
    service_version: str = "1.0.0"
    port: int = 8080
    debug_mode: bool = False

    # Google Cloud設定
    google_cloud_project: Optional[str] = None
    google_application_credentials: Optional[str] = None

    # Aqua Voice API設定
    aqua_voice_api_key: Optional[str] = None
    aqua_voice_base_url: str = "https://api.aquavoice.com/api/v1"
    aqua_voice_model: str = "avalon-v1.5"
    aqua_voice_timeout: int = 600

    # 旧GCP Speech-to-Text設定（一部デプロイ環境との互換用）
    speech_to_text_timeout: int = 600
    speech_to_text_language_code: str = "ja-JP"
    speech_to_text_alternative_languages: list = field(default_factory=lambda: ["en-US"])

    # 処理設定
    signed_url_expiration_minutes: int = 30
    enable_paragraph_formatting: bool = True


class Context:
    """
    コンテキスト管理クラス（規約準拠版）

    グローバル設定とFlaskリクエストオブジェクトを管理します。
    """

    def __init__(self):
        """
        コンテキストマネージャーを初期化
        """
        self.config = self._load_global_config()
        self._current_request: Optional[Request] = None

    def _load_global_config(self) -> GlobalConfig:
        """
        環境変数からグローバル設定を読み込み

        returns: GlobalConfig - 読み込まれた設定
        """
        config = GlobalConfig()

        # サービス基本情報
        config.service_name = os.environ.get('SERVICE_NAME', config.service_name)
        config.service_version = os.environ.get('SERVICE_VERSION', config.service_version)
        config.port = int(os.environ.get('PORT', str(config.port)))

        # デバッグモード
        debug_value = os.environ.get('DEBUG', 'false').lower()
        config.debug_mode = debug_value in ['true', '1', 'yes', 'on']

        # Google Cloud設定
        config.google_cloud_project = os.environ.get('GOOGLE_CLOUD_PROJECT')
        config.google_application_credentials = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')

        # Base64エンコードされたサービスアカウントキー（Secret Managerから）
        credentials_json_b64 = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS_JSON')
        if credentials_json_b64:
            import base64
            import tempfile
            try:
                # Base64デコード
                credentials_json = base64.b64decode(credentials_json_b64).decode('utf-8')

                # 一時ファイルに書き込み
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                    f.write(credentials_json)
                    config.google_application_credentials = f.name
                    print(f"✅ サービスアカウントキーを環境変数から読み込みました: {f.name}")
            except Exception as e:
                print(f"⚠️ サービスアカウントキーのデコードに失敗: {str(e)}")

        # Aqua Voice API設定
        config.aqua_voice_api_key = os.environ.get('AQUA_VOICE_API_KEY')
        config.aqua_voice_base_url = os.environ.get('AQUA_VOICE_BASE_URL', config.aqua_voice_base_url)
        config.aqua_voice_model = os.environ.get('AQUA_VOICE_MODEL', config.aqua_voice_model)
        config.aqua_voice_timeout = int(os.environ.get(
            'AQUA_VOICE_TIMEOUT',
            os.environ.get('SPEECH_TO_TEXT_TIMEOUT', str(config.aqua_voice_timeout))
        ))

        # 旧GCP Speech-to-Text API設定（一部デプロイ環境との互換用）
        config.speech_to_text_timeout = int(os.environ.get('SPEECH_TO_TEXT_TIMEOUT', str(config.speech_to_text_timeout)))
        config.speech_to_text_language_code = os.environ.get('SPEECH_TO_TEXT_LANGUAGE_CODE', config.speech_to_text_language_code)

        # 処理設定
        try:
            config.signed_url_expiration_minutes = int(os.environ.get('SIGNED_URL_EXPIRATION_MINUTES', str(config.signed_url_expiration_minutes)))
        except ValueError:
            pass  # デフォルト値を使用

        # 段落整形オプション
        config.enable_paragraph_formatting = os.environ.get('ENABLE_PARAGRAPH_FORMATTING', 'true').lower() == 'true'

        return config

    def set_request(self, request: Request):
        """
        現在のFlaskリクエストオブジェクトを設定

        params: {
            request: Request - Flaskリクエストオブジェクト
        }
        """
        self._current_request = request

    def get_request(self) -> Optional[Request]:
        """
        現在のFlaskリクエストオブジェクトを取得

        returns: Optional[Request] - Flaskリクエストオブジェクト
        """
        return self._current_request

    def get_service_info(self) -> Dict[str, Any]:
        """
        サービス情報を取得

        returns: Dict[str, Any] - サービス情報
        """
        return {
            "name": self.config.service_name,
            "version": self.config.service_version,
            "environment": "production" if not self.config.debug_mode else "development",
            "started_at": datetime.utcnow().isoformat() + "Z"
        }


# グローバルコンテキストインスタンス
context = Context()
