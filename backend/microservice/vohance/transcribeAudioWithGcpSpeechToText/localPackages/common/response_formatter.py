"""
ResponseFormatter - 統一レスポンス形式モジュール

RequestDoc黄金テンプレートに準拠したレスポンス構造を提供します。
全てのエンドポイントで一貫したレスポンス形式を保証します。

⚠️ CRITICAL: CloudRunはPython内部でsnake_caseで実装するが、
           ResponseFormatter.success()でcamelCaseに自動変換します。
"""

from typing import Dict, Any, Optional
from datetime import datetime
from .case_converter import convert_keys_to_camel_case


class ResponseFormatter:
    """
    統一レスポンス形式を提供するクラス

    全てのAPIレスポンスは以下の構造に従います：
    - 成功: {"status": "success", "request_id": "...", "output": {...}} (規約準拠)
    - エラー: {"status": "error", "request_id": "...", "error": {...}}
    """

    @staticmethod
    def success(
        request_id: str,
        output: Dict[str, Any],
        processing_time: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> tuple[Dict[str, Any], int]:
        """
        成功レスポンスを生成

        params: {
            request_id: str - リクエスト一意識別子,
            output: Dict[str, Any] - 出力データ（Python内部ではsnake_case、自動でcamelCaseに変換）,
            processing_time: Optional[float] - 処理時間,
            metadata: Optional[Dict[str, Any]] - 追加メタデータ
        }

        returns: tuple[Dict[str, Any], int] - (レスポンスボディ, HTTPステータスコード)

        notes:
            - outputをsnake_caseからcamelCaseに自動変換します
            - Python内部処理ではsnake_caseで実装し、このメソッドでcamelCaseに変換
            - Nuxt3側（TypeScript）のcamelCase規約に統一
        """
        # ✅ CRITICAL: snake_caseからcamelCaseへの自動変換
        camel_case_output = convert_keys_to_camel_case(output)

        response = {
            "status": "success",
            "request_id": request_id,
            "output": camel_case_output,  # ✅ camelCaseに変換済み
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        if processing_time is not None:
            response["processing_time"] = processing_time

        if metadata:
            response["metadata"] = metadata

        return response, 200

    @staticmethod
    def error(
        request_id: str,
        error_type: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = 500
    ) -> tuple[Dict[str, Any], int]:
        """
        エラーレスポンスを生成

        params: {
            request_id: str - リクエスト一意識別子,
            error_type: str - エラータイプ,
            message: str - エラーメッセージ,
            details: Optional[Dict[str, Any]] - 詳細エラー情報,
            status_code: int - HTTPステータスコード
        }

        returns: tuple[Dict[str, Any], int] - (レスポンスボディ, HTTPステータスコード)
        """
        response = {
            "status": "error",
            "request_id": request_id,
            "error": {
                "type": error_type,
                "message": message,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        }

        if details:
            response["error"]["details"] = details

        return response, status_code

    @staticmethod
    def validation_error(
        request_id: str,
        message: str,
        field_errors: Optional[Dict[str, Any]] = None
    ) -> tuple[Dict[str, Any], int]:
        """
        バリデーションエラーレスポンスを生成

        params: {
            request_id: str - リクエスト一意識別子,
            message: str - エラーメッセージ,
            field_errors: Optional[Dict[str, Any]] - フィールドエラー詳細
        }

        returns: tuple[Dict[str, Any], int] - (レスポンスボディ, 400)
        """
        details = {"field_errors": field_errors} if field_errors else None
        return ResponseFormatter.error(
            request_id=request_id,
            error_type="ValidationError",
            message=message,
            details=details,
            status_code=400
        )

    @staticmethod
    def processing_error(
        request_id: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ) -> tuple[Dict[str, Any], int]:
        """
        処理エラーレスポンスを生成（422 Unprocessable Entity）

        params: {
            request_id: str - リクエスト一意識別子,
            message: str - エラーメッセージ,
            details: Optional[Dict[str, Any]] - 詳細エラー情報
        }

        returns: tuple[Dict[str, Any], int] - (レスポンスボディ, 422)
        """
        return ResponseFormatter.error(
            request_id=request_id,
            error_type="ProcessingError",
            message=message,
            details=details,
            status_code=422
        )

    @staticmethod
    def storage_error(
        request_id: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ) -> tuple[Dict[str, Any], int]:
        """
        ストレージエラーレスポンスを生成

        params: {
            request_id: str - リクエスト一意識別子,
            message: str - エラーメッセージ,
            details: Optional[Dict[str, Any]] - 詳細エラー情報
        }

        returns: tuple[Dict[str, Any], int] - (レスポンスボディ, 500)
        """
        return ResponseFormatter.error(
            request_id=request_id,
            error_type="StorageError",
            message=message,
            details=details,
            status_code=500
        )


    @staticmethod
    def internal_error(
        request_id: str,
        message: str,
        exception_type: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> tuple[Dict[str, Any], int]:
        """
        内部エラーレスポンスを生成

        params: {
            request_id: str - リクエスト一意識別子,
            message: str - エラーメッセージ,
            exception_type: Optional[str] - 例外クラス名,
            details: Optional[Dict[str, Any]] - 詳細エラー情報
        }

        returns: tuple[Dict[str, Any], int] - (レスポンスボディ, 500)
        """
        error_details = details or {}
        if exception_type:
            error_details["exception_type"] = exception_type

        return ResponseFormatter.error(
            request_id=request_id,
            error_type="InternalError",
            message=message,
            details=error_details if error_details else None,
            status_code=500
        )

# ✅ MUST: グローバルインスタンス作成（全マイクロサービス共通）
response_formatter = ResponseFormatter()
