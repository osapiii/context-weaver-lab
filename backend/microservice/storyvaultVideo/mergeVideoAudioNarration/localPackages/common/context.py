"""
Context管理モジュール - 全マイクロサービス共通実装

このモジュールは、グローバル設定とリクエスト単位でのコンテキスト情報を一元管理します。
config.pyは不要です。すべてこのモジュールで管理します。
"""

import os
import uuid
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, field
from copy import deepcopy


def generate_request_id() -> str:
    """
    リクエストIDを生成

    returns: str - ユニークなリクエストID（req_YYYYMMDDHHmmss_xxxxxxxx形式）
    """
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    return f"req_{timestamp}_{unique_id}"


@dataclass
class RequestContext:
    """
    リクエスト単位のコンテキスト情報

    全マイクロサービスで共通利用できる汎用的なコンテキスト実装。
    リクエストパラメータ、処理状態、メタデータを一元管理。
    """
    # 基本情報（自動生成）
    request_id: str = field(default_factory=generate_request_id)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    # Flaskリクエストオブジェクト（必須：before_requestで設定）
    request: Any = None

    # リクエストパラメータ（動的に格納）
    params: Dict[str, Any] = field(default_factory=dict)

    # 処理状態（各stepsで更新）
    state: Dict[str, Any] = field(default_factory=dict)

    # メタデータ（ログ、デバッグ情報）
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Firestoreログ用（オプション）
    collection_name: Optional[str] = None
    document_id: Optional[str] = None

    # 一時ディレクトリパス
    temp_dir: Optional[str] = None

    def set_request(self, request) -> None:
        """
        Flaskリクエストオブジェクトを設定（必須処理）

        params: {
            request: Flask Request - Flaskリクエストオブジェクト
        }
        """
        self.request = request

        # リクエストからJSONボディを自動抽出してparamsに格納
        if request.is_json:
            request_data = request.get_json() or {}
            self.set_params(request_data)

    def get_request_method(self) -> Optional[str]:
        """
        HTTPメソッドを取得

        returns: Optional[str] - HTTPメソッド（GET, POST, etc.）
        """
        return self.request.method if self.request else None

    def get_request_path(self) -> Optional[str]:
        """
        リクエストパスを取得

        returns: Optional[str] - リクエストパス
        """
        return self.request.path if self.request else None

    def get_request_url(self) -> Optional[str]:
        """
        リクエストURLを取得

        returns: Optional[str] - リクエストURL
        """
        return self.request.url if self.request else None

    def get_request_headers(self) -> Optional[Dict[str, str]]:
        """
        リクエストヘッダーを取得

        returns: Optional[Dict[str, str]] - ヘッダー辞書
        """
        if self.request:
            return {key: value for key, value in self.request.headers.items()}
        return None

    def set_params(self, params: Dict[str, Any]) -> None:
        """
        リクエストパラメータを一括設定

        params: {
            params: Dict[str, Any] - リクエストパラメータの辞書
        }
        """
        self.params.update(params)

    def get_param(self, key: str, default: Any = None) -> Any:
        """
        リクエストパラメータを取得

        params: {
            key: str - パラメータのキー,
            default: Any - デフォルト値（キーが存在しない場合）
        }

        returns: Any - パラメータの値
        """
        return self.params.get(key, default)

    def set_state(self, key: str, value: Any) -> None:
        """
        処理状態を設定（各stepsで使用）

        params: {
            key: str - 状態のキー,
            value: Any - 設定する値
        }
        """
        self.state[key] = value

    def get_state(self, key: str, default: Any = None) -> Any:
        """
        処理状態を取得

        params: {
            key: str - 状態のキー,
            default: Any - デフォルト値
        }

        returns: Any - 状態の値
        """
        return self.state.get(key, default)

    def set_metadata(self, key: str, value: Any) -> None:
        """
        メタデータを設定

        params: {
            key: str - メタデータのキー,
            value: Any - 設定する値
        }
        """
        self.metadata[key] = value

    def get_metadata(self, key: str, default: Any = None) -> Any:
        """
        メタデータを取得

        params: {
            key: str - メタデータのキー,
            default: Any - デフォルト値
        }

        returns: Any - メタデータの値
        """
        return self.metadata.get(key, default)

    def to_dict(self) -> Dict[str, Any]:
        """
        辞書形式に変換（デバッグ用）

        returns: Dict[str, Any] - コンテキスト情報の辞書
        """
        data = {
            "request_id": self.request_id,
            "timestamp": self.timestamp.isoformat() + "Z",
            "params": deepcopy(self.params),
            "state": deepcopy(self.state),
            "metadata": deepcopy(self.metadata),
        }

        # リクエスト情報を含める
        if self.request:
            data["request_info"] = {
                "method": self.request.method,
                "path": self.request.path,
                "url": self.request.url,
                "is_json": self.request.is_json,
                "content_type": self.request.content_type,
            }

        if self.collection_name:
            data["collection_name"] = self.collection_name
        if self.document_id:
            data["document_id"] = self.document_id
        if self.temp_dir:
            data["temp_dir"] = self.temp_dir

        return data

    def to_json(self, indent: int = 2) -> str:
        """
        JSON形式に変換（デバッグ用）

        params: {
            indent: int - インデント幅
        }

        returns: str - JSON文字列
        """
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    def debug_print(self) -> None:
        """コンテキスト情報をデバッグ出力"""
        print("=" * 80)
        print(f"📋 RequestContext Debug: {self.request_id}")
        print("=" * 80)
        print(self.to_json())
        print("=" * 80)

    def validate(self, required_params: Optional[List[str]] = None) -> tuple[bool, Optional[str]]:
        """
        コンテキストの検証

        params: {
            required_params: Optional[List[str]] - 必須パラメータのリスト
        }

        returns: tuple[bool, Optional[str]] - (検証成功, エラーメッセージ)
        """
        # 必須パラメータの検証
        if required_params:
            for param in required_params:
                if param not in self.params:
                    return False, f"Required parameter '{param}' is missing"
                if self.params[param] is None:
                    return False, f"Required parameter '{param}' is None"

        # Firestoreログ用パラメータの整合性チェック
        if self.collection_name and not self.document_id:
            return False, "document_id is required when collection_name is provided"

        if self.document_id and not self.collection_name:
            return False, "collection_name is required when document_id is provided"

        return True, None


class Context:
    """
    グローバルコンテキストマネージャー

    全マイクロサービスで共通利用できる汎用的なコンテキスト管理。
    グローバル設定とリクエストコンテキストを一元管理します。
    """

    def __init__(
        self,
        service_name: str = "merge-video-audio-narration",
        service_version: str = "1.0.0",
        port: int = 8080,
        debug_mode: bool = False
    ):
        """
        コンテキストマネージャーを初期化

        params: {
            service_name: str - サービス名,
            service_version: str - サービスバージョン,
            port: int - ポート番号,
            debug_mode: bool - デバッグモード
        }
        """
        # グローバル設定（旧GlobalConfig相当）
        self.service_name = os.getenv('SERVICE_NAME', service_name)
        self.service_version = os.getenv('SERVICE_VERSION', service_version)
        self.port = int(os.getenv('PORT', str(port)))

        debug_value = os.getenv('DEBUG', 'false').lower()
        self.debug_mode = debug_value in ['true', '1', 'yes', 'on']

        self.google_cloud_project = os.getenv('GOOGLE_CLOUD_PROJECT')
        self.google_application_credentials = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

        # 一時ディレクトリ設定
        self.temp_dir = os.getenv('TEMP_DIR', '/tmp/video_processing')

        cleanup_value = os.getenv('CLEANUP_TEMP_FILES', 'true').lower()
        self.cleanup_temp_files = cleanup_value in ['true', '1', 'yes', 'on']

        # リクエストコンテキスト管理
        self.request_contexts: Dict[str, RequestContext] = {}

        # 起動時に設定を検証
        valid, errors = self.validate_config()
        if not valid:
            raise ValueError(f"Context configuration validation failed: {', '.join(errors)}")

        # 一時ディレクトリの作成
        os.makedirs(self.temp_dir, exist_ok=True)

    def validate_config(self) -> tuple[bool, List[str]]:
        """
        グローバル設定を検証

        returns: tuple[bool, List[str]] - (検証成功, エラーメッセージリスト)
        """
        errors = []

        if not self.google_cloud_project:
            errors.append("GOOGLE_CLOUD_PROJECT environment variable is required")

        if self.port < 1 or self.port > 65535:
            errors.append(f"Port must be between 1 and 65535, got {self.port}")

        return len(errors) == 0, errors

    def get_auth_method(self) -> str:
        """認証方法を取得"""
        if self.google_application_credentials:
            return "service_account_key"
        else:
            return "default_credentials"

    def create_request_context(
        self,
        request = None,
        request_data: Optional[Dict[str, Any]] = None,
        required_params: Optional[List[str]] = None
    ) -> RequestContext:
        """
        新しいリクエストコンテキストを作成

        params: {
            request: Optional[Flask Request] - Flaskリクエストオブジェクト（推奨）,
            request_data: Optional[Dict[str, Any]] - リクエストデータ（後方互換性用）,
            required_params: Optional[List[str]] - 必須パラメータのリスト
        }

        returns: RequestContext - 作成されたコンテキスト

        raises: ValueError - 必須パラメータが不足している場合、セグメント数超過の場合

        notes:
            - requestを渡すと、自動的にJSONボディがparamsに格納される
            - request_dataは後方互換性のために残されている
        """
        ctx = RequestContext()

        # Flaskリクエストオブジェクトを設定（必須処理）
        if request is not None:
            ctx.set_request(request)
        # 後方互換性: request_dataが渡された場合
        elif request_data is not None:
            ctx.set_params(request_data)
            # Firestoreログ用パラメータの設定
            ctx.collection_name = request_data.get('collectionName')
            ctx.document_id = request_data.get('documentId')

        # Firestoreログ用パラメータの設定（requestから取得した場合）
        if request is not None and request.is_json:
            ctx.collection_name = ctx.get_param('collectionName')
            ctx.document_id = ctx.get_param('documentId')

        # 一時ディレクトリの設定
        ctx.temp_dir = os.path.join(self.temp_dir, ctx.request_id)
        os.makedirs(ctx.temp_dir, exist_ok=True)

        # 検証
        if required_params:
            valid, error_message = ctx.validate(required_params)
            if not valid:
                raise ValueError(f"Context validation failed: {error_message}")

        # コンテキストを保存
        self.request_contexts[ctx.request_id] = ctx

        return ctx

    def get_request_context(self, request_id: str) -> Optional[RequestContext]:
        """
        リクエストコンテキストを取得

        params: {
            request_id: str - リクエストID
        }

        returns: Optional[RequestContext] - コンテキスト（存在しない場合None）
        """
        return self.request_contexts.get(request_id)

    def remove_request_context(self, request_id: str) -> None:
        """
        リクエストコンテキストを削除

        params: {
            request_id: str - リクエストID
        }
        """
        if request_id in self.request_contexts:
            ctx = self.request_contexts[request_id]

            # 一時ファイルのクリーンアップ
            if self.cleanup_temp_files and ctx.temp_dir and os.path.exists(ctx.temp_dir):
                import shutil
                try:
                    shutil.rmtree(ctx.temp_dir)
                except Exception:
                    pass  # クリーンアップエラーは無視

            del self.request_contexts[request_id]

    def cleanup_old_contexts(self, max_age_seconds: int = 3600) -> int:
        """
        古いリクエストコンテキストをクリーンアップ

        params: {
            max_age_seconds: int - 保持期間（秒）
        }

        returns: int - 削除されたコンテキスト数
        """
        current_time = datetime.utcnow()
        to_remove = []

        for request_id, ctx in self.request_contexts.items():
            age = (current_time - ctx.timestamp).total_seconds()
            if age > max_age_seconds:
                to_remove.append(request_id)

        for request_id in to_remove:
            self.remove_request_context(request_id)

        return len(to_remove)

    def get_service_info(self) -> Dict[str, Any]:
        """
        サービス情報を取得

        returns: Dict[str, Any] - サービス情報辞書
        """
        return {
            "name": self.service_name,
            "version": self.service_version,
            "environment": "production" if not self.debug_mode else "development",
            "started_at": datetime.utcnow().isoformat() + "Z"
        }

    def debug_dump(self, request_id: Optional[str] = None) -> Dict[str, Any]:
        """
        デバッグ用のコンテキストダンプ

        params: {
            request_id: Optional[str] - 特定のリクエストIDのみダンプする場合
        }

        returns: Dict[str, Any] - コンテキスト情報の辞書
        """
        dump = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "global_config": {
                "service_name": self.service_name,
                "service_version": self.service_version,
                "port": self.port,
                "debug_mode": self.debug_mode,
                "google_cloud_project": self.google_cloud_project,
                "temp_dir": self.temp_dir,
                "cleanup_temp_files": self.cleanup_temp_files,
            },
            "active_requests": len(self.request_contexts)
        }

        if request_id:
            ctx = self.get_request_context(request_id)
            if ctx:
                dump["request_context"] = ctx.to_dict()
            else:
                dump["request_context"] = None
        else:
            dump["request_contexts"] = {
                rid: ctx.to_dict() for rid, ctx in self.request_contexts.items()
            }

        return dump


# グローバルコンテキストインスタンス
context = Context()
