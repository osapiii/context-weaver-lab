"""
Google Cloud Storage 操作モジュール

動画ファイルのダウンロード・アップロード機能を提供します。
大容量ファイルの処理にも対応しています。
"""

import os
import time
from typing import Dict, Any, Optional, Tuple, List
from google.cloud import storage
from .logger import logger
from .context import context, RequestContext, VideoSegment


# グローバルストレージクライアント
_storage_client: Optional[storage.Client] = None


def initialize_storage_client() -> storage.Client:
    """
    Google Cloud Storageクライアントを初期化
    
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
    logger.info(f"認証方法: {context.get_auth_method()}")

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
        # gs://プレフィックスがない場合は、バケット名とパスの組み合わせと仮定
        parts = gcs_path.split('/', 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        raise ValueError(f"無効なGCSパス: {gcs_path}")
    
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


def download_video_from_gcs(ctx: RequestContext) -> bytes:
    """
    GCSから動画ファイルをダウンロード
    
    Args:
        ctx: リクエストコンテキスト
        
    Returns:
        ダウンロードした動画データ
        
    Raises:
        Exception: ダウンロードエラー
    """
    operation_start_time = time.time()
    
    logger.start_operation(f"GCS動画ダウンロード [request_id: {ctx.request_id}]")
    
    try:
        # GCSパスの構築
        gcs_path = ctx.get_source_gcs_path()
        logger.file_operation("ダウンロード開始", gcs_path)

        # バケットとオブジェクトの取得
        client = get_client()
        bucket = client.bucket(ctx.source_bucket_name)
        blob = bucket.blob(ctx.source_gcs_file_path)

        # ファイルの存在確認
        if not blob.exists():
            raise ValueError(f"動画ファイルが見つかりません: {gcs_path}")

        # ファイルサイズの確認
        blob.reload()
        file_size_mb = blob.size / (1024 * 1024) if blob.size else 0
        logger.info(f"動画ファイルサイズ: {file_size_mb:.2f} MB")
        
        # Firestoreにファイルサイズ情報を記録
        if ctx.collection_name and ctx.document_id:
            from localPackages.common import firestore_client
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"動画ファイルサイズ確認: {file_size_mb:.2f} MB",
                current_step="downloading"
            )

        # サイズ制限チェック
        if file_size_mb > context.max_video_size_mb:
            raise ValueError(f"動画ファイルが大きすぎます: {file_size_mb:.2f} MB > {context.max_video_size_mb} MB")

        # 一時ファイルにダウンロード
        temp_file_path = os.path.join(ctx.temp_dir, "input_video" + os.path.splitext(ctx.source_gcs_file_path)[1])
        logger.debug(f"一時ファイルパス: {temp_file_path}")

        # ダウンロード実行
        blob.download_to_filename(temp_file_path)
        ctx.downloaded_video_path = temp_file_path

        # ファイルサイズの記録
        actual_size = os.path.getsize(temp_file_path)
        ctx.metadata["input_video_size"] = actual_size

        operation_time = time.time() - operation_start_time
        logger.performance_metric("ダウンロード時間", operation_time, "秒")
        logger.complete_operation(f"GCS動画ダウンロード [request_id: {ctx.request_id}]", operation_time)

        # バイトデータとして返す（MoviePyで処理するため）
        with open(temp_file_path, 'rb') as f:
            return f.read()

    except Exception as e:
        operation_time = time.time() - operation_start_time
        logger.error(f"GCSダウンロードエラー [request_id: {ctx.request_id}]",
                    error=e, gcs_path=ctx.get_source_gcs_path(),
                    operation_time=operation_time)
        raise


def upload_video_to_gcs(ctx: RequestContext, segment: VideoSegment) -> Dict[str, Any]:
    """
    分割された動画セグメントをGCSにアップロード
    
    Args:
        ctx: リクエストコンテキスト
        segment: 動画セグメント情報
        
    Returns:
        アップロード結果の辞書
        
    Raises:
        Exception: アップロードエラー
    """
    operation_start_time = time.time()
    
    logger.start_operation(f"GCSセグメントアップロード [segment: {segment.segment_number}]")
    
    try:
        # GCSパスの構築
        output_path = ctx.get_segment_output_path(segment.segment_number)
        gcs_path = f"gs://{ctx.output_bucket_name}/{output_path}"

        logger.file_operation("アップロード開始", gcs_path)
        logger.info(f"🔍 アップロード先パス詳細:")
        logger.info(f"  - output_path: {output_path}")
        logger.info(f"  - bucket_name: {ctx.output_bucket_name}")
        logger.info(f"  - full_gcs_path: {gcs_path}")

        # ストレージクライアントを取得
        client = get_client()
        bucket = client.bucket(ctx.output_bucket_name)
        blob = bucket.blob(output_path)
        
        # ファイルアップロード
        if segment.temp_path and os.path.exists(segment.temp_path):
            blob.upload_from_filename(segment.temp_path)
            
            # ファイルサイズを記録
            segment.size_bytes = os.path.getsize(segment.temp_path)
        else:
            raise ValueError(f"セグメントファイルが見つかりません: {segment.temp_path}")
        
        # アップロード結果
        # ✅ Cloud Runマイクロサービスアーキテクチャガイドライン準拠: Zod型との合致
        # 規約: request.outputのzod型 = firestoreBGのresponseのoutput = cloudRunのOutputの合致原則
        # 注意: ResponseFormatter.success()がsnake_case → camelCase変換を実行するため、ここではsnake_caseで出力
        upload_result = {
            "segment_number": segment.segment_number,
            "start_time": segment.start_time,
            "end_time": segment.end_time,
            "output_path": gcs_path,
            "duration": segment.duration,
            "size_bytes": segment.size_bytes,
            # ✅ Zod型との合致のため追加フィールド（snake_case形式）
            "bucket_name": ctx.output_bucket_name,
            "gcs_file_path": output_path,
            "gcs_path": gcs_path
        }
        
        operation_time = time.time() - operation_start_time
        logger.performance_metric(f"セグメント{segment.segment_number}アップロード時間", operation_time, "秒")
        logger.complete_operation(f"GCSセグメントアップロード [segment: {segment.segment_number}]", operation_time)
        
        # 一時ファイルのクリーンアップ（設定に応じて）
        if context.cleanup_temp_files and segment.temp_path:
            try:
                os.remove(segment.temp_path)
                logger.debug(f"一時ファイル削除: {segment.temp_path}")
            except Exception:
                pass  # クリーンアップエラーは無視
        
        return upload_result
        
    except Exception as e:
        operation_time = time.time() - operation_start_time
        logger.error(f"GCSアップロードエラー [segment: {segment.segment_number}]", 
                    error=e, operation_time=operation_time)
        raise


def test_connection() -> bool:
    """
    GCS接続をテスト
    
    Returns:
        接続成功の場合True
    """
    try:
        client = get_client()
        # バケット一覧を取得してみる（最初の1つだけ）
        for _ in client.list_buckets(max_results=1):
            break
        return True
    except Exception:
        return False


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


def list_video_files(bucket_name: str, prefix: str = "", 
                    video_extensions: List[str] = None) -> List[str]:
    """
    バケット内の動画ファイルをリスト
    
    Args:
        bucket_name: バケット名
        prefix: オブジェクト名のプレフィックス
        video_extensions: 動画ファイルの拡張子リスト
        
    Returns:
        動画ファイルのGCSパスリスト
    """
    if video_extensions is None:
        video_extensions = context.supported_video_formats
    
    try:
        client = get_client()
        bucket = client.bucket(bucket_name)
        
        video_files = []
        for blob in bucket.list_blobs(prefix=prefix):
            if any(blob.name.lower().endswith(ext) for ext in video_extensions):
                video_files.append(f"gs://{bucket_name}/{blob.name}")
        
        return video_files
        
    except Exception as e:
        logger.error("ファイルリスト取得エラー", error=e, bucket=bucket_name)
        raise