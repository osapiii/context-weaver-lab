"""
RequestValidator - Pydanticベースリクエスト検証モジュール

RequestDoc黄金テンプレートに準拠したリクエスト検証を提供します。
"""

from typing import Dict, Any, Optional, Tuple
from pydantic import ValidationError


class RequestValidator:
    """
    Pydanticスキーマを使用したリクエスト検証クラス
    """

    @staticmethod
    def validate(
        schema_class,
        request_data: Dict[str, Any]
    ) -> Tuple[bool, Optional[Any], Optional[Dict[str, Any]]]:
        """
        リクエストデータをPydanticスキーマで検証

        params: {
            schema_class: Pydanticモデルクラス,
            request_data: Dict[str, Any] - 検証対象データ
        }

        returns: Tuple[bool, Optional[Any], Optional[Dict[str, Any]]] -
                 (検証成功, 検証済みデータ, エラー詳細)
        """
        try:
            # Pydanticスキーマで検証
            validated_data = schema_class(**request_data)
            return True, validated_data, None

        except ValidationError as e:
            # バリデーションエラーの詳細を整形
            field_errors = {}
            for error in e.errors():
                field_path = ".".join(str(loc) for loc in error["loc"])
                field_errors[field_path] = {
                    "message": error["msg"],
                    "type": error["type"]
                }

            error_details = {
                "field_errors": field_errors,
                "error_count": len(e.errors())
            }

            return False, None, error_details

        except Exception as e:
            # 予期しないエラー
            error_details = {
                "message": str(e),
                "exception_type": type(e).__name__
            }
            return False, None, error_details

    @staticmethod
    def extract_request_id(request_data: Dict[str, Any]) -> str:
        """
        リクエストデータからrequest_idを抽出

        params: {
            request_data: Dict[str, Any] - リクエストデータ
        }

        returns: str - request_id（存在しない場合は"unknown"）
        """
        return request_data.get("request_id", "unknown")
