"""
Initializer - マイクロサービス統一初期化ファクトリ

各マイクロサービスのエンドポイント実行時の初期化処理を統一化します。

責務:
- Pydantic リクエスト検証
- ExecutionContext 作成
- 外部クライアント初期化（BigQuery, GCS, Firestore）
- グローバルロガー設定
- エラーハンドラー設定

使用パターン:

    from common.initializer import initialize

    @app.post("/profile")
    async def profile(request: Request):
        try:
            request_data = await request.json()
            validated_request = ProfileRequest(**request_data)

            # 初期化（自動）
            context = initialize(validated_request)

            # execute.py に委譲
            return await profile_execute.handle(context)

        except ValidationError as e:
            return ResponseFormatter.validation_error(...)
        except InitializationError as e:
            return ResponseFormatter.error(...)
"""

from typing import TypeVar, Type, Optional, Dict, Any
from pydantic import BaseModel, ValidationError as PydanticValidationError
import logging
import os

from .context import ExecutionContext
from .errors import InitializationError, ValidationError
from .logger import Logger
from .bigquery import get_bigquery_client
from .firestore import FirestoreClientManager
from .request_validation import log_pydantic_validation_error

logger = logging.getLogger(__name__)

# Pydantic モデルの型変数
RequestModel = TypeVar('RequestModel', bound=BaseModel)


# ========== 初期化関数 ==========

def initialize(request_data: RequestModel) -> ExecutionContext:
    """
    マイクロサービス実行を初期化し、ExecutionContext を返す

    この関数は以下を一括実行:
    1. request_data の型チェック
    2. ExecutionContext 作成
    3. 外部クライアント初期化（project_id自動抽出）
    4. グローバルロガー設定（metadata自動抽出）
    5. エラーハンドラー登録

    Args:
        request_data: RequestDoc準拠のPydanticモデル
            - request_id (str): リクエスト識別子
            - input (BaseModel): 処理パラメータ
            - operation_metadata (BaseModel): メタデータ

    Returns:
        初期化完了した ExecutionContext

    Raises:
        ValidationError: リクエストデータが無効な場合
        InitializationError: クライアント初期化失敗時

    使用例:

        # 通常のリクエスト処理
        try:
            context = initialize(validated_request)
            # context を使って処理実行
        except InitializationError as e:
            return ResponseFormatter.error(
                request_id='unknown',
                error_type='InitializationError',
                message=str(e)
            )
    """
    # ========== Step 1: 入力値検証 ==========
    # NOTE: Pydantic schema validation occurs at endpoint level (main.py)
    # before initialize() is called. This function assumes valid RequestDoc structure.
    # If request_data is not a BaseModel or missing required fields, it indicates
    # a programming error in the endpoint layer (schema validation was bypassed).

    if not isinstance(request_data, BaseModel):
        raise ValidationError(
            "Request must be a Pydantic model",
            validation_errors={'type': f"Expected BaseModel, got {type(request_data).__name__}"}
        )

    request_id = request_data.request_id
    logger.info(f"🚀 Initializing microservice (request_id={request_id})")

    # ========== Step 2: ExecutionContext 作成 ==========
    try:
        context = ExecutionContext(request_data)
        logger.debug(f"✅ ExecutionContext created (request_id={request_id})")
    except Exception as e:
        logger.error(f"❌ Failed to create ExecutionContext: {e}", exc_info=True)
        raise InitializationError('context', f"Failed to create ExecutionContext: {e}")

    # ========== Step 3: 外部クライアント初期化 ==========
    _initialize_clients(context)

    # ========== Step 4: グローバルロガー設定 ==========
    _initialize_logger(context)

    logger.info(f"✅ Microservice initialization complete (request_id={request_id})")
    return context


# ========== プライベート初期化関数 ==========

def _initialize_clients(context: ExecutionContext) -> None:
    """
    外部クライアント（BigQuery, GCS, Firestore）を初期化

    project_id は input データから自動抽出（存在する場合）
    """
    request_id = context.request_id

    # === BigQuery クライアント初期化 ===
    try:
        # project_id の抽出（input.project_id が存在する場合）
        # NOTE: project_id がなくても初期化を続行
        # BigQueryClientManager が実行時の認証情報から project_id を自動抽出
        project_id = _extract_project_id(context)

        # BigQuery クライアントを常に初期化（project_id 不要）
        bq_client = get_bigquery_client()
        context.set_client('bigquery', bq_client)
        logger.debug(
            f"✅ BigQuery client initialized",
            extra={
                "event_type": "bigquery_client_initialized",
                "request_id": request_id,
                "client_project_id": getattr(bq_client, 'project', 'unknown'),
                "input_project_id": project_id
            }
        )

    except Exception as e:
        logger.error(
            f"❌ BigQuery client initialization failed",
            extra={
                "event_type": "bigquery_client_init_error",
                "request_id": request_id,
                "error_type": type(e).__name__,
                "error_message": str(e),
                "project_id": project_id if 'project_id' in locals() else None
            },
            exc_info=True
        )

    # === Firestore クライアント初期化 ===
    try:
        firestore_manager = FirestoreClientManager()
        context.set_client('firestore', firestore_manager)
        logger.debug(
            "✅ Firestore client manager initialized",
            extra={
                "event_type": "firestore_client_initialized",
                "request_id": request_id
            }
        )

    except Exception as e:
        logger.error(
            f"❌ Firestore client initialization failed",
            extra={
                "event_type": "firestore_client_init_error",
                "request_id": request_id,
                "error_type": type(e).__name__,
                "error_message": str(e)
            },
            exc_info=True
        )

    # === GCS (Google Cloud Storage) クライアント初期化 ===
    try:
        from common.gcs_storage import get_storage_client
        gcs_client = get_storage_client()
        context.set_client('gcs', gcs_client)
        logger.debug(
            "✅ GCS client initialized",
            extra={
                "event_type": "gcs_client_initialized",
                "request_id": request_id
            }
        )

    except Exception as e:
        logger.error(
            f"❌ GCS client initialization failed",
            extra={
                "event_type": "gcs_client_init_error",
                "request_id": request_id,
                "error_type": type(e).__name__,
                "error_message": str(e)
            },
            exc_info=True
        )


def _initialize_logger(context: ExecutionContext) -> None:
    """
    グローバルロガー設定

    metadata の organization_id, space_id を使用して
    Firestore ロギングを自動セットアップ
    """
    request_id = context.request_id

    try:
        # operation_metadata から Firestore ロギング設定を抽出
        operation_metadata_obj = context.operation_metadata
        if not operation_metadata_obj:
            logger.debug("⚠️ operation_metadata not found, using standard logger")
            return

        operation_metadata = {}

        # 組織ID
        if hasattr(operation_metadata_obj, 'organization_id'):
            operation_metadata['organizationId'] = operation_metadata_obj.organization_id

        # スペースID
        if hasattr(operation_metadata_obj, 'space_id'):
            operation_metadata['spaceId'] = operation_metadata_obj.space_id

        # Firestore ロギング設定（存在する場合）
        if hasattr(operation_metadata_obj, 'logging_collection_id'):
            operation_metadata['loggingCollectionId'] = operation_metadata_obj.logging_collection_id
        if hasattr(operation_metadata_obj, 'logging_document_id'):
            operation_metadata['loggingDocumentId'] = operation_metadata_obj.logging_document_id

        # Logger インスタンス作成（Firestore 統合）
        logger_instance = Logger(
            service_name=_extract_service_name(context),
            operation_metadata=operation_metadata if operation_metadata else None
        )

        # Logger インスタンスを context に保存
        context.set('logger', logger_instance)

        logger.debug(f"✅ Logger configured with Firestore integration")

    except Exception as e:
        logger.warning(f"⚠️ Logger configuration failed: {e}")
        # ロガー設定失敗は処理中断の対象外


def _extract_project_id(context: ExecutionContext) -> Optional[str]:
    """input データから project_id を抽出"""
    input_data = context.input_data

    if not input_data:
        return None

    if hasattr(input_data, 'project_id'):
        return input_data.project_id

    return None


def _extract_service_name(context: ExecutionContext) -> str:
    """サービス名を抽出（環境変数から）

    Returns:
        サービス名（デフォルト: 'microservice'）
    """
    return os.environ.get('SERVICE_NAME', 'microservice')


# ========== 例外処理ラッパー ==========

def initialize_with_error_handling(
    request_data: RequestModel,
    default_request_id: str = 'unknown'
) -> Optional[ExecutionContext]:
    """
    エラーハンドリング付きの初期化

    初期化失敗時は None を返すため、呼び出し側で対応可能。

    Args:
        request_data: リクエストデータ
        default_request_id: エラー時のデフォルトrequest_id

    Returns:
        ExecutionContext（失敗時は None）
    """
    try:
        return initialize(request_data)
    except ValidationError as e:
        logger.error(f"❌ Request validation failed: {e}")
        return None
    except InitializationError as e:
        logger.error(f"❌ Initialization failed: {e}")
        return None
    except Exception as e:
        logger.error(f"❌ Unexpected error during initialization: {e}", exc_info=True)
        return None


# ========== Pydantic バリデーションラッパー ==========

def validate_request(request_dict: Dict[str, Any], request_class: Type[RequestModel]) -> RequestModel:
    """
    Pydantic モデルによるリクエスト検証

    Args:
        request_dict: リクエスト辞書
        request_class: Pydantic リクエストモデルクラス

    Returns:
        検証済みのPydanticオブジェクト

    Raises:
        ValidationError: バリデーション失敗時
    """
    try:
        return request_class(**request_dict)
    except PydanticValidationError as e:
        # 詳細なデバッグログを出力（request_validation.pyで処理）
        request_id = request_dict.get('request_id', 'unknown')
        endpoint = request_dict.get('endpoint', 'unknown')

        log_pydantic_validation_error(
            request_id=request_id,
            endpoint=endpoint,
            validation_error=e,
            request_dict=request_dict
        )

        # レスポンス用にバリデーションエラーをマッピング
        validation_errors = {
            f".".join(str(loc) for loc in err['loc']): {
                'message': err['msg'],
                'type': err['type']
            }
            for err in e.errors()
        }
        raise ValidationError(
            "Request validation failed",
            validation_errors=validation_errors
        )


# ========== デバッグ用ユーティリティ ==========

def create_test_context(request_model: RequestModel) -> ExecutionContext:
    """
    テスト用 ExecutionContext を作成（クライアント初期化なし）

    テストコードで使用。実際のクライアント初期化をスキップします。

    Args:
        request_model: テスト用リクエストモデル

    Returns:
        テスト用 ExecutionContext
    """
    return ExecutionContext(request_model)
