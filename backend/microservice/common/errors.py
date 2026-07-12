"""
Unified Error Handling - マイクロサービス統一エラーハンドリング

マイクロサービスアーキテクチャ全体で一貫したエラー分類と処理を実現します。

エラー分類:
- Fatal: ステップ失敗 → 処理中断 → エラーレスポンス
- Recoverable: ステップ失敗 → ログ記録 → 処理継続

使用例:

    # 致命的エラーの場合
    if not df.empty:
        raise FatalStepError("DataFrame is empty")

    # 回復可能なエラーの場合
    try:
        descriptions = generate_ai_descriptions(columns)
    except AIServiceTimeout:
        raise RecoverableStepError("AI service timeout, skipping descriptions")
"""

from typing import Optional, Any, Dict
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


# ========== ベースエラークラス ==========

class MicroserviceError(Exception):
    """マイクロサービス全体の基底エラークラス

    すべてのマイクロサービス固有例外の親クラス。
    CloudLoggingとFirestoreに自動記録されます。
    """

    severity: str = 'unknown'  # 'fatal', 'warning', 'info'

    def __init__(self, message: str, error_code: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        """
        Args:
            message: エラーメッセージ
            error_code: エラーコード（e.g., 'VALIDATION_ERROR', 'TIMEOUT'）
            context: エラーコンテキスト（デバッグ情報）
        """
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.context = context or {}
        self.timestamp = datetime.utcnow()

    def __str__(self) -> str:
        """エラーの文字列表現"""
        parts = [f"[{self.severity.upper()}]"]

        if self.error_code:
            parts.append(f"({self.error_code})")

        parts.append(self.message)

        return " ".join(parts)

    def to_dict(self) -> Dict[str, Any]:
        """エラーを辞書形式で取得（レスポンス生成用）"""
        return {
            'type': self.__class__.__name__,
            'message': self.message,
            'code': self.error_code,
            'severity': self.severity,
            'timestamp': self.timestamp.isoformat(),
            'context': self.context
        }


# ========== ステップ実行エラー ==========

class StepExecutionError(MicroserviceError):
    """ステップ実行時のエラーの基底クラス"""

    def __init__(self, step_name: str, message: str, error_code: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        """
        Args:
            step_name: ステップ名（'step1_fetch_data'等）
            message: エラーメッセージ
            error_code: エラーコード
            context: エラーコンテキスト
        """
        self.step_name = step_name
        super().__init__(message, error_code, context)

    def __str__(self) -> str:
        return f"[{self.severity.upper()}] {self.step_name}: {self.message}"


class FatalStepError(StepExecutionError):
    """致命的なステップエラー

    処理を即座に中断し、エラーレスポンスを返します。
    """

    severity = 'fatal'

    def __init__(self, step_name: str, message: str, error_code: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        """
        Args:
            step_name: 失敗したステップ名
            message: エラーメッセージ
            error_code: エラーコード
            context: コンテキスト情報
        """
        super().__init__(step_name, message, error_code, context)


class RecoverableStepError(StepExecutionError):
    """回復可能なステップエラー

    エラーをログに記録しつつ、処理は継続します。
    AI description生成タイムアウト、スキーマ更新の警告レベルエラーなど。
    """

    severity = 'warning'

    def __init__(self, step_name: str, message: str, error_code: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        """
        Args:
            step_name: ステップ名
            message: 警告メッセージ
            error_code: エラーコード
            context: コンテキスト情報
        """
        super().__init__(step_name, message, error_code, context)


# ========== データ検証エラー ==========

class ValidationError(MicroserviceError):
    """リクエスト検証エラー

    Pydantic バリデーション失敗時に発生します。
    """

    severity = 'fatal'

    def __init__(self, message: str, validation_errors: Optional[Dict[str, Any]] = None):
        """
        Args:
            message: エラーメッセージ
            validation_errors: Pydantic ValidationError.errors() の結果
        """
        context = {'validation_errors': validation_errors} if validation_errors else {}
        super().__init__(message, error_code='VALIDATION_ERROR', context=context)


# ========== 初期化エラー ==========

class InitializationError(MicroserviceError):
    """マイクロサービス初期化エラー

    クライアント初期化、設定読み込み、認証失敗時に発生します。
    """

    severity = 'fatal'

    def __init__(self, component: str, message: str):
        """
        Args:
            component: 初期化に失敗した コンポーネント名
            message: エラーメッセージ
        """
        error_code = f'INIT_{component.upper()}'
        super().__init__(message, error_code=error_code, context={'component': component})


# ========== リソースアクセスエラー ==========

class ResourceAccessError(MicroserviceError):
    """リソースアクセスエラーの基底クラス

    BigQuery、GCS、Firestoreなど外部リソースへのアクセス失敗。
    """

    severity = 'fatal'


class BigQueryError(ResourceAccessError):
    """BigQuery アクセスエラー"""

    def __init__(self, message: str, table_uri: Optional[str] = None):
        super().__init__(
            message,
            error_code='BIGQUERY_ERROR',
            context={'table_uri': table_uri} if table_uri else {}
        )


class GCSError(ResourceAccessError):
    """GCS アクセスエラー"""

    def __init__(self, message: str, bucket_name: Optional[str] = None, path: Optional[str] = None):
        super().__init__(
            message,
            error_code='GCS_ERROR',
            context={
                'bucket_name': bucket_name,
                'path': path
            }
        )


class FirestoreError(ResourceAccessError):
    """Firestore アクセスエラー"""

    def __init__(self, message: str, collection: Optional[str] = None, doc_id: Optional[str] = None):
        super().__init__(
            message,
            error_code='FIRESTORE_ERROR',
            context={
                'collection': collection,
                'doc_id': doc_id
            }
        )


# ========== タイムアウト・再試行エラー ==========

class TimeoutError(MicroserviceError):
    """リクエストタイムアウトエラー"""

    severity = 'fatal'

    def __init__(self, operation: str, timeout_seconds: float):
        super().__init__(
            f"Operation '{operation}' timed out after {timeout_seconds}s",
            error_code='TIMEOUT',
            context={'operation': operation, 'timeout_seconds': timeout_seconds}
        )


class RetryExhaustedError(MicroserviceError):
    """リトライ回数上限到達"""

    severity = 'fatal'

    def __init__(self, operation: str, max_retries: int, last_error: Optional[Exception] = None):
        super().__init__(
            f"Operation '{operation}' failed after {max_retries} retries",
            error_code='RETRY_EXHAUSTED',
            context={
                'operation': operation,
                'max_retries': max_retries,
                'last_error': str(last_error) if last_error else None
            }
        )


# ========== 外部サービスエラー ==========

class ExternalServiceError(MicroserviceError):
    """外部サービス呼び出し失敗

    LLM Proxy、メール送信サービスなど外部マイクロサービス呼び出し失敗。
    """

    severity = 'warning'  # 通常は回復可能

    def __init__(self, service_name: str, message: str, status_code: Optional[int] = None):
        super().__init__(
            message,
            error_code=f'{service_name.upper()}_ERROR',
            context={
                'service_name': service_name,
                'status_code': status_code
            }
        )


class LLMProxyError(ExternalServiceError):
    """LLM Proxy サービスエラー"""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__('llm_proxy', message, status_code)


class EmailServiceError(ExternalServiceError):
    """メール送信サービスエラー"""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__('email_service', message, status_code)


# ========== エラーハンドリングユーティリティ ==========

def classify_error(error: Exception) -> str:
    """例外をエラー分類に分類

    Args:
        error: キャッチした例外オブジェクト

    Returns:
        エラー分類 ('fatal', 'warning', 'unknown')
    """
    if isinstance(error, FatalStepError):
        return 'fatal'
    elif isinstance(error, RecoverableStepError):
        return 'warning'
    elif isinstance(error, MicroserviceError):
        return error.severity
    else:
        return 'unknown'


def should_retry(error: Exception) -> bool:
    """エラーから自動リトライ対象か判定

    Args:
        error: 例外オブジェクト

    Returns:
        自動リトライ対象の場合 True
    """
    # タイムアウト、一時的なネットワークエラー → リトライ対象
    retry_codes = {'TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'}

    if isinstance(error, MicroserviceError):
        return error.error_code in retry_codes

    # 標準的な一時的エラー
    return isinstance(error, (ConnectionError, TimeoutError))


def log_error_with_context(error: Exception, context_dict: Optional[Dict[str, Any]] = None) -> None:
    """コンテキスト情報付きでエラーをログ

    Args:
        error: 例外オブジェクト
        context_dict: コンテキスト情報
    """
    if isinstance(error, MicroserviceError):
        logger.error(
            str(error),
            extra={
                'error_code': error.error_code,
                'severity': error.severity,
                'context': {**error.context, **(context_dict or {})}
            },
            exc_info=True
        )
    else:
        logger.error(
            f"Unexpected error: {str(error)}",
            extra={'context': context_dict},
            exc_info=True
        )
