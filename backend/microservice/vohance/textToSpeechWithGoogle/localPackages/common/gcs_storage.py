"""
Google Cloud Storage 操作モジュール

このモジュールは、音声ファイルなどのバイナリデータをGoogle Cloud Storage
に保存・取得する機能を提供します。環境変数からプロジェクトIDを読み込み、
認証情報は自動的に取得されます。

主な機能:
- Storage クライアントの初期化
- ファイルの保存・取得
- GCSパスの解析・検証
"""

import time
from typing import Dict, Any, Optional, Tuple
from google.cloud import storage
from .logger import logger
from .context import context, RequestContext


# グローバルストレージクライアント（初期化後に設定される）
_storage_client: Optional[storage.Client] = None


def initialize_storage_client() -> storage.Client:
    """
    Google Cloud Storageクライアントを初期化
    
    環境変数からプロジェクトIDを読み込んでクライアントを初期化します。
    
    Returns:
        初期化されたStorageクライアント
        
    Raises:
        ValueError: プロジェクトIDが設定されていない場合
    """
    global _storage_client
    
    if not context.google_cloud_project:
        raise ValueError("GOOGLE_CLOUD_PROJECT が設定されていません")
    
    logger.info("Google Cloud Storageクライアントを初期化中...")
    logger.info(f"プロジェクトID: {context.google_cloud_project}")
    
    # クライアントの初期化
    _storage_client = storage.Client(
        project=context.google_cloud_project
    )
    
    logger.success("Google Cloud Storageクライアントの初期化完了")
    return _storage_client


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


def validate_gcs_path(gcs_path: str) -> bool:
    """
    GCSパスの妥当性を検証
    
    Args:
        gcs_path: 検証するGCSパス
        
    Returns:
        妥当な場合True、そうでない場合False
    """
    try:
        parse_gcs_path(gcs_path)
        return True
    except ValueError:
        return False


def get_audio_content_type(format: str) -> str:
    """
    音声フォーマットに対応するContent-Typeを取得
    
    Args:
        format: 音声フォーマット（MP3, WAV, etc）
        
    Returns:
        対応するMIMEタイプ
    """
    content_type_map = {
        'MP3': 'audio/mpeg',
        'LINEAR16': 'audio/l16',
        'WAV': 'audio/wav',
        'OGG_OPUS': 'audio/ogg',
        'MULAW': 'audio/basic',
        'ALAW': 'audio/basic',
        'FLAC': 'audio/flac',
        'WEBM': 'audio/webm'
    }
    
    # デフォルトはWAV（Gemini TTSはPCMを返すためWAVに変換）
    return content_type_map.get(format.upper(), 'audio/wav')


def save_audio_to_gcs(ctx: RequestContext, audio_content: bytes, 
                     audio_format: str = None) -> Dict[str, Any]:
    """
    音声データをGCSに保存
    
    コンテキストからGCSパスを取得し、音声データを保存します。
    
    Args:
        ctx: リクエストコンテキスト（output_gcs_path が必要）
        audio_content: 保存する音声データ
        audio_format: 音声フォーマット（省略時はコンテキストから推定）
        
    Returns:
        アップロード結果の辞書
        
    Raises:
        ValueError: GCSパスが無効な場合
        Exception: アップロードエラー
    """
    operation_start_time = time.time()
    
    if not ctx.output_gcs_path:
        raise ValueError("output_gcs_path が設定されていません")
    
    logger.start_operation(f"GCS音声ファイル保存 [request_id: {ctx.request_id}]")
    logger.file_operation("保存開始", ctx.output_gcs_path)
    
    try:
        # GCSパスを解析
        bucket_name, object_name = parse_gcs_path(ctx.output_gcs_path)
        
        # コンテキストに保存
        ctx.gcs_bucket_name = bucket_name
        ctx.gcs_object_name = object_name
        
        path_info = {
            "bucket_name": bucket_name,
            "object_name": object_name,
            "full_path": ctx.output_gcs_path
        }
        logger.data_analysis("GCSパス解析結果", path_info)
        
        # ストレージクライアントを取得
        client = get_client()
        
        # バケットとブロブの取得
        logger.debug(f"GCSバケット接続中: {bucket_name}")
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_name)
        
        # コンテンツタイプの決定
        if not audio_format:
            # コンテキストから推定（Gemini TTSはPCMを返すためWAV形式）
            audio_format = ctx.metadata.get('audio_format', 'WAV')
        
        content_type = get_audio_content_type(audio_format)
        ctx.gcs_content_type = content_type
        
        logger.debug(f"Content-Type: {content_type}")
        
        # ファイルアップロード
        logger.debug(f"音声データアップロード中: {len(audio_content)} bytes")
        blob.upload_from_string(audio_content, content_type=content_type)
        
        # アップロード結果
        upload_result = {
            "size_bytes": len(audio_content),
            "content_type": content_type,
            "gcs_path": ctx.output_gcs_path,
            "bucket": bucket_name,
            "object": object_name
        }
        
        # メタデータ更新
        ctx.metadata["gcs_upload_completed"] = True
        ctx.metadata["gcs_upload_size"] = len(audio_content)
        
        operation_time = time.time() - operation_start_time
        logger.data_analysis("GCSアップロード結果", upload_result)
        logger.performance_metric("GCS保存時間", operation_time, "秒")
        logger.complete_operation(f"GCS音声ファイル保存 [request_id: {ctx.request_id}]", operation_time)
        
        return upload_result
        
    except Exception as e:
        operation_time = time.time() - operation_start_time
        logger.error(f"GCS保存エラー [request_id: {ctx.request_id}]", 
                    error=e, gcs_path=ctx.output_gcs_path, operation_time=operation_time)
        ctx.metadata["gcs_upload_error"] = str(e)
        raise


def download_from_gcs(gcs_path: str) -> bytes:
    """
    GCSからファイルをダウンロード
    
    Args:
        gcs_path: ダウンロードするファイルのGCSパス
        
    Returns:
        ダウンロードしたファイルの内容（バイト）
        
    Raises:
        ValueError: GCSパスが無効な場合
        Exception: ダウンロードエラー
    """
    logger.start_operation(f"GCSファイルダウンロード: {gcs_path}")
    
    try:
        # GCSパスを解析
        bucket_name, object_name = parse_gcs_path(gcs_path)
        
        # ストレージクライアントを取得
        client = get_client()
        
        # バケットとブロブの取得
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_name)
        
        # ファイルダウンロード
        logger.debug("ファイルダウンロード中...")
        content = blob.download_as_bytes()
        
        logger.success(f"ダウンロード完了: {len(content)} bytes")
        logger.complete_operation("GCSファイルダウンロード")
        
        return content
        
    except Exception as e:
        logger.error("GCSダウンロードエラー", error=e, gcs_path=gcs_path)
        raise


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


def list_audio_files(bucket_name: str, prefix: str = "", 
                    audio_extensions: list[str] = None) -> list[str]:
    """
    バケット内の音声ファイルをリスト
    
    Args:
        bucket_name: バケット名
        prefix: オブジェクト名のプレフィックス
        audio_extensions: 音声ファイルの拡張子リスト（デフォルト: mp3, wav, ogg）
        
    Returns:
        音声ファイルのGCSパスリスト
    """
    if audio_extensions is None:
        audio_extensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a']
    
    try:
        client = get_client()
        bucket = client.bucket(bucket_name)
        
        audio_files = []
        for blob in bucket.list_blobs(prefix=prefix):
            if any(blob.name.lower().endswith(ext) for ext in audio_extensions):
                audio_files.append(f"gs://{bucket_name}/{blob.name}")
        
        return audio_files
        
    except Exception as e:
        logger.error("ファイルリスト取得エラー", error=e, bucket=bucket_name)
        raise