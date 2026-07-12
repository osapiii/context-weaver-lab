"""
Step 3: アップロード処理

連結した動画をGCSにアップロードします。
"""

import os
from typing import Dict, Any
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import gcs_storage
from localPackages.common import firestore_client


def execute(ctx: RequestContext, concatenated_video_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Step 3: 連結動画をGCSにアップロード

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        concatenated_video_info: Dict[str, Any] - 連結動画の情報
    }

    returns: Dict[str, Any] - アップロード結果
    """
    logger.start_operation("Step 3: 連結動画アップロード")

    # Firestoreに進捗を記録
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message="連結動画をアップロード中",
            current_step="uploading"
        )

    # inputから出力パス情報を取得
    input_data = ctx.get_param('input', {})
    output_bucket_name = input_data.get('outputBucketName')
    output_file_path = input_data.get('outputFilePath')

    if not output_bucket_name or not output_file_path:
        raise ValueError("outputBucketNameまたはoutputFilePathが設定されていません")

    output_path = concatenated_video_info.get('output_path')
    if not output_path:
        raise ValueError("連結動画のパスが設定されていません")

    gcs_path = f"gs://{output_bucket_name}/{output_file_path}"
    logger.file_operation("アップロード開始", gcs_path)

    # GCSにアップロード
    client = gcs_storage.get_client()
    bucket = client.bucket(output_bucket_name)
    blob = bucket.blob(output_file_path)

    # ファイルをアップロード
    blob.upload_from_filename(output_path)

    # ファイルサイズを確認
    blob.reload()
    uploaded_size_bytes = blob.size if blob.size else concatenated_video_info.get('size_bytes', 0)
    uploaded_size_mb = uploaded_size_bytes / (1024 * 1024)

    logger.success(f"連結動画アップロード完了: {uploaded_size_mb:.2f} MB")

    # Firestoreにアップロード完了を記録
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"連結動画アップロード完了 ({uploaded_size_mb:.2f} MB)",
            current_step="uploading"
        )

    logger.complete_operation("Step 3: 連結動画アップロード")

    return {
        "bucketName": output_bucket_name,
        "filePath": output_file_path,
        "gcsPath": gcs_path,
        "sizeBytes": uploaded_size_bytes,
        "duration": concatenated_video_info.get('duration', 0),
        "fps": concatenated_video_info.get('fps', 30),
        "width": concatenated_video_info.get('width', 1920),
        "height": concatenated_video_info.get('height', 1080),
        "hasAudio": concatenated_video_info.get('has_audio', False)
    }
