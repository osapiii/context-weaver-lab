"""
Google Cloud Storage 操作モジュール

このモジュールは、文字起こしサービスに必要なGCS操作を提供します。
署名付きURL生成、ファイルの保存など、Cloud Storage関連の機能を
一元管理します。

主な機能:
- Storage クライアントの初期化
- 署名付きURL生成（一時的なアクセス許可）
- 文字起こし結果の保存
- GCSパスの解析・検証
"""

from typing import Tuple, Optional
from datetime import datetime, timedelta
from google.cloud import storage
from .logger import logger
from .context import context, RequestContext


# グローバルストレージクライアント（初期化後に設定される）
_storage_client: Optional[storage.Client] = None


def initialize_storage_client() -> storage.Client:
    """
    Google Cloud Storageクライアントを初期化
    
    Returns:
        初期化されたStorageクライアント
        
    Raises:
        RuntimeError: 初期化エラー
    """
    global _storage_client
    
    logger.info("🔧 Google Cloud Storageクライアントを初期化中...")
    
    try:
        # クライアントの初期化
        _storage_client = storage.Client(
            project=context.config.google_cloud_project
        )
        
        logger.success("✅ Google Cloud Storageクライアントの初期化完了")
        return _storage_client
        
    except Exception as e:
        logger.error(f"❌ GCSクライアント初期化エラー: {str(e)}")
        raise RuntimeError(f"GCSクライアント初期化失敗: {str(e)}")


def get_client() -> storage.Client:
    """
    Storage クライアントを取得
    
    Returns:
        初期化済みのStorageクライアント
        
    Raises:
        RuntimeError: クライアントが初期化されていない場合
    """
    if _storage_client is None:
        raise RuntimeError("Storage クライアントが初期化されていません。initialize_storage_client() を先に呼び出してください")
    
    return _storage_client


def parse_gcs_path(gcs_path: str) -> Tuple[str, str]:
    """
    GCSパスをバケット名とオブジェクト名に分解
    
    Args:
        gcs_path: gs://bucket/path/to/object 形式のパス
        
    Returns:
        (バケット名, オブジェクト名) のタプル
        
    Raises:
        ValueError: 無効なGCSパスの場合
    """
    if not gcs_path.startswith('gs://'):
        raise ValueError(f"GCSパスは 'gs://' で始まる必要があります: {gcs_path}")
    
    # 'gs://' を除去してパスを分割
    path_without_prefix = gcs_path[5:]
    if not path_without_prefix:
        raise ValueError(f"無効なGCSパス: {gcs_path}")
    
    parts = path_without_prefix.split('/', 1)
    bucket_name = parts[0]
    object_name = parts[1] if len(parts) > 1 else ''
    
    if not bucket_name:
        raise ValueError(f"バケット名が空です: {gcs_path}")
    
    if not object_name:
        raise ValueError(f"オブジェクト名が空です: {gcs_path}")
    
    return bucket_name, object_name


def generate_signed_url(ctx: RequestContext) -> str:
    """
    GCSファイルから一時的な署名付きURLを生成
    
    コンテキストのsourceがGCSパスの場合、署名付きURLを生成します。
    
    Args:
        ctx: リクエストコンテキスト（sourceにGCSパスが必要）
    
    Returns:
        署名付きURL（指定期間のみ有効）
        
    Raises:
        ValueError: 無効なGCSパス
        RuntimeError: URL生成エラー
    """
    if not ctx.source or not ctx.source.startswith('gs://'):
        raise ValueError(f"無効なGCSパス: {ctx.source}")
    
    try:
        # パスを解析
        bucket_name, blob_name = parse_gcs_path(ctx.source)
        
        logger.info(f"🪣 バケット: {bucket_name}")
        logger.info(f"📄 ファイル: {blob_name}")
        logger.info(f"⏰ 有効期限: {context.config.signed_url_expiration_minutes}分")
        
        # GCSクライアントを取得
        client = get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        
        # 署名付きURLを生成（GET用）
        expiration = datetime.utcnow() + timedelta(
            minutes=context.config.signed_url_expiration_minutes
        )
        
        try:
            # サービスアカウントキーを使用した署名付きURL生成（Secret Managerから取得）
            service_account_key_path = context.config.google_application_credentials

            if not service_account_key_path:
                raise RuntimeError(
                    "サービスアカウントキーが設定されていません。\n"
                    "setup-service-account.sh を実行してSecret Managerにキーを設定してください。"
                )

            logger.info(f"🔑 サービスアカウントキーを使用: {service_account_key_path}")

            # サービスアカウントキーから認証情報を作成
            from google.oauth2 import service_account

            signing_credentials = service_account.Credentials.from_service_account_file(
                service_account_key_path
            )

            # 署名付きURL生成
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=expiration,
                method="GET",
                credentials=signing_credentials
            )

            logger.info(f"✅ 署名付きURL生成完了（有効期限: {expiration.strftime('%Y-%m-%d %H:%M:%S UTC')}）")

            # URLに署名パラメータが含まれているか確認
            if "X-Goog-Signature" in signed_url:
                logger.info("✅ 署名パラメータ確認OK")
            else:
                logger.warning("⚠️ 署名パラメータが見つかりません")

            # コンテキストに情報を保存
            ctx.metadata["signed_url_generated"] = True
            ctx.metadata["signed_url_expiration"] = expiration.isoformat() + "Z"

            return signed_url

        except Exception as sign_error:
            logger.error(f"❌ 署名付きURL生成失敗: {str(sign_error)}")
            logger.error(f"📍 エラー型: {type(sign_error).__name__}")
            logger.error("💡 解決策: ./setup-service-account.sh を実行してSecret Managerにサービスアカウントキーを設定してください")

            ctx.metadata["signed_url_generated"] = False
            ctx.metadata["signed_url_error"] = str(sign_error)

            raise RuntimeError(f"署名付きURL生成失敗: {str(sign_error)}") from sign_error
            
    except Exception as e:
        logger.error(f"❌ URL生成エラー: {str(e)}")
        logger.error(f"📍 エラー型: {type(e).__name__}")
        raise RuntimeError(f"URL生成失敗: {str(e)}") from e


def save_transcription_to_gcs(ctx: RequestContext, content: str) -> None:
    """
    文字起こし結果をGCSに保存
    
    コンテキストのoutput_bucket_nameとoutput_file_pathに文字起こし結果を保存します。
    
    Args:
        ctx: リクエストコンテキスト（output_bucket_nameとoutput_file_pathが必要）
        content: 保存する文字起こし結果（JSON文字列）
        
    Raises:
        ValueError: 必須パラメータが無効な場合
        RuntimeError: 保存エラー
    """
    if not ctx.output_bucket_name:
        raise ValueError("output_bucket_name が設定されていません")
    
    if not ctx.output_file_path:
        raise ValueError("output_file_path が設定されていません")
    
    try:
        bucket_name = ctx.output_bucket_name
        object_name = ctx.output_file_path
        
        logger.info(f"🪣 バケット: {bucket_name}")
        logger.info(f"📄 ファイル名: {object_name}")
        logger.info(f"📊 コンテンツサイズ: {len(content.encode('utf-8'))} bytes")
        
        # コンテキストに保存
        ctx.gcs_bucket_name = bucket_name
        ctx.gcs_object_name = object_name
        
        # GCSクライアントを取得
        client = get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_name)
        
        # コンテンツをアップロード
        blob.upload_from_string(
            content, 
            content_type='application/json; charset=utf-8'
        )
        
        # メタデータを更新
        ctx.metadata["gcs_upload_completed"] = True
        ctx.metadata["gcs_upload_size_bytes"] = len(content.encode('utf-8'))
        ctx.metadata["gcs_content_type"] = 'application/json; charset=utf-8'
        
        logger.info(f"✅ GCSへの保存が完了しました: gs://{bucket_name}/{object_name}")
        
    except Exception as e:
        logger.error(f"❌ GCS保存エラー: {str(e)}")
        logger.error(f"📍 エラー型: {type(e).__name__}")
        ctx.metadata["gcs_upload_error"] = str(e)
        raise RuntimeError(f"GCS保存失敗: {str(e)}") from e


def check_bucket_exists(bucket_name: str) -> bool:
    """
    バケットが存在するか確認
    
    Args:
        bucket_name: 確認するバケット名
        
    Returns:
        存在する場合True、しない場合False
    """
    try:
        client = get_client()
        bucket = client.bucket(bucket_name)
        bucket.reload()  # バケット情報を取得してみる
        return True
    except Exception:
        return False


def validate_gcs_access() -> bool:
    """
    GCSアクセス権限を検証

    Health check should not require project-wide bucket listing permission.
    Runtime read/write permissions are validated against the request bucket
    when download_file_from_gcs/upload_json_to_gcs/upload_file_to_gcs run.

    Returns:
        アクセス可能な場合True
    """
    try:
        get_client()
        logger.success("✅ GCSクライアント初期化確認OK")
        return True
    except Exception as e:
        logger.error(f"❌ GCSクライアント確認エラー: {str(e)}")
        return False


def upload_json_to_gcs(bucket_name: str, object_name: str, json_content: str) -> bool:
    """
    JSON文字列をGCSにアップロード
    
    Args:
        bucket_name: バケット名
        object_name: オブジェクトパス
        json_content: JSON文字列
        
    Returns:
        成功した場合True
    """
    try:
        client = get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_name)
        
        blob.upload_from_string(
            json_content,
            content_type='application/json; charset=utf-8'
        )
        
        logger.info(f"✅ JSON保存: gs://{bucket_name}/{object_name}")
        return True
        
    except Exception as e:
        logger.error(f"❌ JSON保存エラー: {str(e)}")
        return False


def download_file_from_gcs(bucket_name: str, object_name: str, destination_path: str) -> bool:
    """
    GCSからローカルにファイルをダウンロード

    Args:
        bucket_name: バケット名
        object_name: オブジェクトパス
        destination_path: ダウンロード先のローカルパス

    Returns:
        成功した場合True
    """
    try:
        client = get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_name)

        blob.download_to_filename(destination_path)

        logger.info(f"✅ ファイルダウンロード: gs://{bucket_name}/{object_name} → {destination_path}")
        return True

    except Exception as e:
        logger.error(f"❌ ファイルダウンロードエラー: {str(e)}")
        return False


def upload_file_to_gcs(bucket_name: str, object_name: str, file_path: str) -> bool:
    """
    ローカルファイルをGCSにアップロード

    params: {
        bucket_name: str - バケット名,
        object_name: str - オブジェクトパス,
        file_path: str - ローカルファイルパス
    }

    returns: bool - 成功した場合True
    """
    try:
        client = get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_name)

        # ファイルタイプに応じてcontent_typeを設定
        content_type = 'application/octet-stream'
        if file_path.endswith('.mp4'):
            content_type = 'video/mp4'
        elif file_path.endswith('.webm'):
            content_type = 'video/webm'
        elif file_path.endswith('.mp3'):
            content_type = 'audio/mpeg'
        elif file_path.endswith('.json'):
            content_type = 'application/json'
        elif file_path.endswith('.flac'):
            content_type = 'audio/flac'

        blob.upload_from_filename(file_path, content_type=content_type)

        logger.info(f"✅ ファイル保存: gs://{bucket_name}/{object_name}")
        return True

    except Exception as e:
        logger.error(f"❌ ファイル保存エラー: {str(e)}")
        return False


def file_exists(bucket_name: str, object_name: str) -> bool:
    """
    GCSファイルの存在確認

    params: {
        bucket_name: str - バケット名,
        object_name: str - オブジェクトパス
    }

    returns: bool - 存在する場合True
    """
    try:
        client = get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_name)

        return blob.exists()

    except Exception as e:
        logger.error(f"❌ ファイル存在確認エラー: {str(e)}")
        return False
