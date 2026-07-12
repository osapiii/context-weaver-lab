"""
Request Validator モジュール - 全マイクロサービス共通実装

Pydanticを使用したリクエストボディの型検証を提供。
各エンドポイントのrequest_schema.pyで定義されたスキーマを使用して検証します。
"""

from typing import Dict, Any, Optional, Type
from pydantic import BaseModel, ValidationError
from .logger import logger


class RequestValidationError(Exception):
    """
    リクエスト検証エラー

    Pydanticのバリデーションエラーをラップし、
    詳細なエラー情報をCloud Logging上で確認可能にします。
    """

    def __init__(self, validation_error: ValidationError, endpoint: str):
        """
        リクエスト検証エラーを初期化

        params: {
            validation_error: ValidationError - Pydanticバリデーションエラー,
            endpoint: str - エンドポイント名
        }
        """
        self.validation_error = validation_error
        self.endpoint = endpoint
        self.errors = validation_error.errors()
        super().__init__(self._format_error_message())

    def _format_error_message(self) -> str:
        """
        エラーメッセージをフォーマット

        returns: str - フォーマット済みエラーメッセージ
        """
        error_details = []
        for error in self.errors:
            field = " -> ".join(str(loc) for loc in error["loc"])
            message = error["msg"]
            error_type = error["type"]
            error_details.append(f"  - {field}: {message} (type: {error_type})")

        return f"Request validation failed for endpoint '{self.endpoint}':\n" + "\n".join(error_details)

    def to_dict(self) -> Dict[str, Any]:
        """
        エラー情報を辞書形式に変換

        returns: Dict[str, Any] - エラー情報の辞書
        """
        return {
            "endpoint": self.endpoint,
            "validation_errors": [
                {
                    "field": " -> ".join(str(loc) for loc in error["loc"]),
                    "message": error["msg"],
                    "type": error["type"],
                    "input": error.get("input")
                }
                for error in self.errors
            ]
        }


class RequestValidator:
    """リクエストバリデータークラス"""

    def validate_request(
        self,
        request_data: Dict[str, Any],
        schema_class: Type[BaseModel],
        endpoint: str
    ) -> BaseModel:
        """
        リクエストデータをPydanticスキーマで検証

        params: {
            request_data: Dict[str, Any] - リクエストボディ,
            schema_class: Type[BaseModel] - Pydanticスキーマクラス,
            endpoint: str - エンドポイント名（ログ出力用）
        }

        returns: BaseModel - 検証済みのPydanticモデルインスタンス

        raises:
            RequestValidationError - 検証失敗時
        """
        try:
            logger.start_operation(f"Request validation: {endpoint}")

            # スキーマ情報をCloud Loggingに出力（デバッグ容易性向上）
            schema_info = {
                "endpoint": endpoint,
                "expected_schema": schema_class.model_json_schema(),
                "received_data": request_data
            }
            logger.info(f"📋 Request schema validation start: {schema_info}")

            # Pydanticによる検証
            validated_model = schema_class(**request_data)

            logger.complete_operation(f"Request validation: {endpoint}")
            logger.info(f"✅ Request validation passed: {endpoint}")

            return validated_model

        except ValidationError as e:
            # バリデーションエラーを詳細にログ出力
            validation_error = RequestValidationError(e, endpoint)
            error_dict = validation_error.to_dict()

            logger.error(
                f"❌ Request validation failed: {endpoint}",
                error=validation_error
            )
            logger.error(f"📋 Validation error details: {error_dict}")

            raise validation_error

    def validate_and_log(
        self,
        request_data: Dict[str, Any],
        schema_class: Type[BaseModel],
        endpoint: str
    ) -> tuple[bool, Optional[BaseModel], Optional[Dict[str, Any]]]:
        """
        リクエストデータを検証し、結果をタプルで返す（エラーハンドリング付き）

        params: {
            request_data: Dict[str, Any] - リクエストボディ,
            schema_class: Type[BaseModel] - Pydanticスキーマクラス,
            endpoint: str - エンドポイント名
        }

        returns: tuple[bool, Optional[BaseModel], Optional[Dict[str, Any]]] -
            (検証成功フラグ, 検証済みモデル, エラー情報)
        """
        try:
            validated_model = self.validate_request(request_data, schema_class, endpoint)
            return True, validated_model, None
        except RequestValidationError as e:
            return False, None, e.to_dict()


# グローバルインスタンス（全マイクロサービスで共通利用）
request_validator = RequestValidator()
