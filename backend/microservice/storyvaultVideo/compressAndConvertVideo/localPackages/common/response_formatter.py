"""
ResponseFormatter モジュール - 全マイクロサービス共通実装

レスポンスフォーマット統一ヘルパー。
全Cloud Runマイクロサービスで共通利用する標準実装。
手動でレスポンスを構築せず、必ずこのヘルパーを使用すること。
"""

from typing import Dict, Any, Optional, List
from flask import jsonify
import re


class ResponseFormatter:
    """
    レスポンスフォーマット統一ヘルパー

    全Cloud Runマイクロサービスで共通利用する標準実装。
    手動でレスポンスを構築せず、必ずこのヘルパーを使用すること。
    """

    @staticmethod
    def _snake_to_camel(snake_str: str) -> str:
        """
        snake_caseをcamelCaseに変換
        
        params: {
            snake_str: str - snake_case文字列
        }
        
        returns: str - camelCase文字列
        """
        components = snake_str.split('_')
        return components[0] + ''.join(word.capitalize() for word in components[1:])

    @staticmethod
    def _convert_dict_keys_to_camel(data: Any) -> Any:
        """
        辞書のキーをsnake_caseからcamelCaseに再帰的に変換
        
        params: {
            data: Any - 変換対象のデータ（辞書、リスト、その他）
        }
        
        returns: Any - 変換後のデータ
        """
        if isinstance(data, dict):
            return {ResponseFormatter._snake_to_camel(k): ResponseFormatter._convert_dict_keys_to_camel(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [ResponseFormatter._convert_dict_keys_to_camel(item) for item in data]
        else:
            return data

    @staticmethod
    def success(
        request_id: str, 
        output: Dict[str, Any],
        processing_time: Optional[float] = None,
        status_code: int = 200
    ):
        """
        成功レスポンスを生成

        params: {
            request_id: str - リクエストID,
            output: Dict[str, Any] - 出力データ（規約準拠）,
            processing_time: Optional[float] - 処理時間,
            status_code: int - HTTPステータスコード（デフォルト: 200）
        }

        returns: Flask jsonify レスポンス
        """
        # ✅ MUST: outputのキーをsnake_caseからcamelCaseに変換
        converted_output = ResponseFormatter._convert_dict_keys_to_camel(output)
        
        response = {
            "status": "success",
            "request_id": request_id,
            "output": converted_output
        }

        if processing_time is not None:
            response["processing_time"] = processing_time

        return jsonify(response), status_code

    @staticmethod
    def error(
        request_id: Optional[str],
        error_type: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = 500
    ):
        """
        エラーレスポンスを生成

        params: {
            request_id: Optional[str] - リクエストID（バリデーション前エラーの場合はNone可）,
            error_type: str - エラータイプ（ValidationError, ProcessingError, StorageError, InternalError）,
            message: str - 人間可読なエラーメッセージ,
            details: Optional[Dict[str, Any]] - エラー詳細情報（オプション）,
            status_code: int - HTTPステータスコード（デフォルト: 500）
        }

        returns: Flask jsonify レスポンス
        """
        error_response = {
            "status": "error",
            "request_id": request_id,
            "error": {
                "type": error_type,
                "message": message
            }
        }

        if details:
            error_response["error"]["details"] = details

        return jsonify(error_response), status_code

    @staticmethod
    def validation_error(
        request_id: Optional[str],
        endpoint: str,
        validation_errors: list
    ):
        """
        バリデーションエラーレスポンスを生成

        params: {
            request_id: Optional[str] - リクエストID,
            endpoint: str - エンドポイントパス,
            validation_errors: list - Pydantic検証エラー配列
        }

        returns: Flask jsonify レスポンス（400 Bad Request）
        """
        return ResponseFormatter.error(
            request_id=request_id,
            error_type="ValidationError",
            message="Request validation failed",
            details={
                "endpoint": endpoint,
                "validation_errors": validation_errors
            },
            status_code=400
        )

    @staticmethod
    def processing_error(
        request_id: str,
        step: str,
        reason: str,
        additional_details: Optional[Dict[str, Any]] = None
    ):
        """
        処理エラーレスポンスを生成

        params: {
            request_id: str - リクエストID,
            step: str - 失敗したステップ名,
            reason: str - 失敗理由,
            additional_details: Optional[Dict[str, Any]] - 追加の詳細情報
        }

        returns: Flask jsonify レスポンス（422 Unprocessable Entity）
        """
        details = {
            "step": step,
            "reason": reason
        }

        if additional_details:
            details.update(additional_details)

        return ResponseFormatter.error(
            request_id=request_id,
            error_type="ProcessingError",
            message=f"Processing failed at {step}",
            details=details,
            status_code=422
        )

    @staticmethod
    def storage_error(
        request_id: str,
        resource: str,
        operation: str,
        reason: str,
        additional_details: Optional[Dict[str, Any]] = None
    ):
        """
        ストレージエラーレスポンスを生成

        params: {
            request_id: str - リクエストID,
            resource: str - リソース種別（GCS, Firestore）,
            operation: str - 操作種別（download, upload, read, write）,
            reason: str - 失敗理由,
            additional_details: Optional[Dict[str, Any]] - 追加の詳細情報
        }

        returns: Flask jsonify レスポンス（500 Internal Server Error）
        """
        details = {
            "resource": resource,
            "operation": operation,
            "reason": reason
        }

        if additional_details:
            details.update(additional_details)

        return ResponseFormatter.error(
            request_id=request_id,
            error_type="StorageError",
            message=f"{resource} {operation} operation failed",
            details=details,
            status_code=500
        )


# ✅ MUST: グローバルインスタンス作成（全マイクロサービス共通）
response_formatter = ResponseFormatter()
