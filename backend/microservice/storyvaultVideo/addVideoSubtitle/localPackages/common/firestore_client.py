"""
Firestore Client モジュール - 全マイクロサービス共通実装

Firestoreへの読み書きと進捗ログ記録機能を提供。
"""

import time
from datetime import datetime
from typing import Dict, Any, Optional
from google.cloud import firestore
from .logger import logger
from .context import context, RequestContext


# グローバルFirestoreクライアント
_firestore_client: Optional[firestore.Client] = None


def initialize_firestore_client() -> firestore.Client:
    """
    Firestoreクライアントを初期化

    returns: firestore.Client - 初期化されたFirestoreクライアント

    raises:
        ValueError - プロジェクトIDが設定されていない場合
    """
    global _firestore_client

    if not context.google_cloud_project:
        raise ValueError("GOOGLE_CLOUD_PROJECT が設定されていません")

    logger.info("Firestoreクライアントを初期化中...")
    logger.info(f"プロジェクトID: {context.google_cloud_project}")

    # クライアントの初期化
    _firestore_client = firestore.Client(
        project=context.google_cloud_project
    )

    logger.success("Firestoreクライアントの初期化完了")
    return _firestore_client


def get_client() -> firestore.Client:
    """
    Firestore クライアントを取得

    returns: firestore.Client - 初期化済みのFirestoreクライアント

    raises:
        RuntimeError - クライアントが初期化されていない場合
    """
    if _firestore_client is None:
        raise RuntimeError("Firestore クライアントが初期化されていません。initialize_firestore_client() を先に呼び出してください")

    return _firestore_client


def test_connection() -> bool:
    """
    Firestore接続をテスト

    returns: bool - 接続成功の場合True
    """
    try:
        client = get_client()
        return bool(client.project)
    except Exception:
        return False


# ============================================
# 進捗ログ記録機能（RequestDocアーキテクチャ準拠）
# ============================================

def log_processing_progress(
    ctx: RequestContext,
    message: str,
    log_type: str = "info",
    current_step: Optional[str] = None,
    progress: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    results: Optional[Dict[str, Any]] = None
) -> bool:
    """
    処理進捗をFirestore logsフィールドに記録

    ⚠️ 重要: RequestDocアーキテクチャ準拠
    - statusフィールド更新は Firebase Background関数の唯一の責務
    - Cloud Run側はlogsフィールドへの追記のみ許可

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        message: str - ログメッセージ,
        log_type: str - ログタイプ（info, warning, error）,
        current_step: Optional[str] - 現在の処理ステップ,
        progress: Optional[Dict[str, Any]] - 進捗情報,
        error: Optional[str] - エラーメッセージ,
        results: Optional[Dict[str, Any]] - 処理結果
    }

    returns: bool - 記録成功の場合True
    """
    try:
        # コレクション名とドキュメントIDの確認
        if not ctx.collection_name or not ctx.document_id:
            logger.debug("Firestoreログがスキップされました（コレクション名またはドキュメントIDが未設定）")
            return False

        client = get_client()

        # ドキュメントリファレンス取得
        # ctx.collection_nameは完全なコレクションパス（例: organizations/{orgId}/spaces/{spaceId}/requests/mergeVideoAudioNarrationRequests/logs）
        # ctx.document_idはドキュメントID
        # Firestore Python SDKでは、完全なパスをdocument()に直接渡す必要がある
        full_path = f"{ctx.collection_name}/{ctx.document_id}"
        logger.debug(f"Firestoreログ記録: full_path={full_path}")
        doc_ref = client.document(full_path)

        # ログエントリの構築（RequestDoc logsスキーマ準拠: timestamp, message, typeのみ）
        # datetimeオブジェクトはFirestoreが自動的にTimestamp型に変換する
        log_entry = {
            "timestamp": datetime.utcnow(),  # Firestoreが自動的にTimestamp型に変換
            "message": message,
            "type": log_type
        }

        # 注意: service_name, service_version, step, progress, error, resultsは
        # RequestDoc logsスキーマに含まれないため追加しない
        # これらの情報が必要な場合は別のコレクションやメタデータフィールドに記録すること

        # logsフィールドに配列要素を追記（arrayUnion）
        doc_ref.update({
            "logs": firestore.ArrayUnion([log_entry])
        })

        logger.debug(f"Firestoreログ記録成功: {ctx.collection_name}/{ctx.document_id}")
        return True

    except Exception as e:
        # 詳細なエラー情報をログ出力
        logger.error(
            f"Firestoreログ記録エラー: collection_name={ctx.collection_name}, document_id={ctx.document_id}, error={str(e)}",
            error=e
        )
        # ログ記録のエラーは処理を止めない
        return False


def log_segment_progress(
    ctx: RequestContext,
    segment_number: int,
    action: str,
    details: Optional[Dict[str, Any]] = None
) -> bool:
    """
    セグメント処理の進捗を記録

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        segment_number: int - セグメント番号,
        action: str - アクション（splitting, uploading, completed）,
        details: Optional[Dict[str, Any]] - 詳細情報
    }

    returns: bool - 記録成功の場合True
    """
    try:
        if not ctx.collection_name or not ctx.document_id:
            return False

        client = get_client()

        # サブコレクションにセグメント情報を記録
        segment_ref = (client
                      .collection(ctx.collection_name)
                      .document(ctx.document_id)
                      .collection("segments")
                      .document(f"segment_{segment_number:03d}"))

        segment_data = {
            "segment_number": segment_number,
            "action": action,
            "timestamp": datetime.utcnow()
        }

        if details:
            segment_data.update(details)

        segment_ref.set(segment_data, merge=True)

        return True

    except Exception as e:
        logger.error("セグメント進捗記録エラー", error=e, segment=segment_number)
        return False


def create_processing_log(
    collection_name: str,
    document_id: Optional[str] = None
) -> str:
    """
    新しい処理ログドキュメントを作成

    params: {
        collection_name: str - コレクション名,
        document_id: Optional[str] - ドキュメントID（省略時は自動生成）
    }

    returns: str - 作成されたドキュメントID
    """
    try:
        client = get_client()
        collection_ref = client.collection(collection_name)

        initial_data = {
            "status": "initialized",
            "created_at": datetime.utcnow(),
            "service_name": context.service_name,
            "service_version": context.service_version
        }

        if document_id:
            # 指定されたIDでドキュメント作成
            doc_ref = collection_ref.document(document_id)
            doc_ref.set(initial_data)
            return document_id
        else:
            # 自動生成IDでドキュメント作成
            doc_ref = collection_ref.add(initial_data)[1]
            return doc_ref.id

    except Exception as e:
        logger.error("処理ログ作成エラー", error=e)
        raise


def get_processing_status(
    collection_name: str,
    document_id: str
) -> Optional[Dict[str, Any]]:
    """
    処理ステータスを取得

    params: {
        collection_name: str - コレクション名,
        document_id: str - ドキュメントID
    }

    returns: Optional[Dict[str, Any]] - ステータス情報の辞書、存在しない場合None
    """
    try:
        client = get_client()
        doc_ref = client.collection(collection_name).document(document_id)
        doc = doc_ref.get()

        if not doc.exists:
            return None

        return doc.to_dict()
    except Exception as e:
        logger.error("処理ステータス取得エラー", error=e)
        return None
