"""
Firestore Client モジュール - TTSマイクロサービス用

RequestDocのlogsフィールドへのログ追記機能を提供。
"""

from datetime import datetime, timezone
from typing import Optional
from google.cloud import firestore
from .logger import logger
from .context import context, RequestContext


# グローバルFirestoreクライアント
_firestore_client: Optional[firestore.Client] = None


def initialize_firestore_client() -> firestore.Client:
    """
    Firestoreクライアントを初期化

    returns: firestore.Client - 初期化されたFirestoreクライアント
    """
    global _firestore_client

    if not context.google_cloud_project:
        raise ValueError("GOOGLE_CLOUD_PROJECT が設定されていません")

    logger.info("Firestoreクライアントを初期化中...")
    _firestore_client = firestore.Client(project=context.google_cloud_project)
    logger.success("Firestoreクライアントの初期化完了")
    return _firestore_client


def get_client() -> firestore.Client:
    """Firestoreクライアントを取得"""
    if _firestore_client is None:
        raise RuntimeError(
            "Firestoreクライアントが初期化されていません。"
            "initialize_firestore_client() を先に呼び出してください"
        )
    return _firestore_client


def append_request_log(
    ctx: RequestContext,
    message: str,
    log_type: str = "info"
) -> bool:
    """
    RequestDocのlogsフィールドにログを追記

    RequestDocアーキテクチャ準拠: timestamp, message, type の形式で追記。
    systemMetadataのloggingCollectionId/loggingDocumentIdを使用。

    Args:
        ctx: リクエストコンテキスト（collection_name, document_id が必須）
        message: ログメッセージ
        log_type: "info" または "error"

    Returns:
        bool: 記録成功の場合True
    """
    try:
        if not ctx.collection_name or not ctx.document_id:
            logger.debug("Firestoreログがスキップされました（loggingCollectionId/loggingDocumentIdが未設定）")
            return False

        client = get_client()
        full_path = f"{ctx.collection_name}/{ctx.document_id}"
        doc_ref = client.document(full_path)

        log_entry = {
            "timestamp": datetime.now(timezone.utc),
            "message": message,
            "type": log_type
        }

        doc_ref.update({"logs": firestore.ArrayUnion([log_entry])})
        logger.debug(f"Firestoreログ記録成功: {full_path}")
        return True

    except Exception as e:
        logger.warning(
            f"Firestoreログ記録エラー（処理は継続）: "
            f"collection={ctx.collection_name}, doc={ctx.document_id}, error={str(e)}"
        )
        return False
