"""
Step 3: アップロード処理

圧縮動画（③）を file/compressed/ に、MP4変換版（②）を file/converted/ にアップロード。
元がMP4の場合は②はアップロードせず、①と同一パスをFirestoreに記録。
"""

import os
from typing import Tuple
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import gcs_storage, firestore_client


def execute(
    ctx: RequestContext,
    compressed_local_path: str,
    converted_local_path: str,
    original_gcs_path: str,
    upload_converted: bool,
) -> Tuple[str, str]:
    """
    Step 3: 圧縮動画・MP4変換版をGCSにアップロード

    params:
        ctx: RequestContext
        compressed_local_path: ローカルの圧縮動画パス（③）
        converted_local_path: ローカルのMP4変換版パス（②、upload_converted時のみ使用）
        original_gcs_path: オリジナルのGCSパス（①）。MP4の場合はconvertedStoragePathに同じ値を設定
        upload_converted: ②をアップロードするか（WebM/MKV等の場合はTrue）

    returns: Tuple[str, str] - (compressed_gcs_path, converted_gcs_path)
    """
    logger.start_operation("Step 3: 動画アップロード")

    bucket_name = ctx.output_bucket_name
    compressed_output_path = ctx.get_compressed_output_path()

    # ③ 圧縮版をアップロード
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx, status="processing",
            message=f"圧縮動画をアップロード中: gs://{bucket_name}/{compressed_output_path}",
            current_step="uploading"
        )

    client = gcs_storage.get_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(compressed_output_path)
    blob.upload_from_filename(compressed_local_path)

    size_mb = os.path.getsize(compressed_local_path) / (1024 * 1024)
    logger.success(f"圧縮動画アップロード完了: gs://{bucket_name}/{compressed_output_path} ({size_mb:.2f} MB)")

    # ② MP4変換版をアップロード（WebM/MKV等の場合のみ）
    if upload_converted:
        converted_output_path = ctx.get_converted_output_path()
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx, status="processing",
                message=f"MP4変換版をアップロード中: gs://{bucket_name}/{converted_output_path}",
                current_step="uploading"
            )
        blob_converted = bucket.blob(converted_output_path)
        blob_converted.upload_from_filename(converted_local_path)
        conv_size_mb = os.path.getsize(converted_local_path) / (1024 * 1024)
        logger.success(f"MP4変換版アップロード完了: gs://{bucket_name}/{converted_output_path} ({conv_size_mb:.2f} MB)")
        converted_gcs_path = converted_output_path
    else:
        converted_gcs_path = original_gcs_path  # MP4の場合は①と同一

    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx, status="processing",
            message="アップロード完了",
            current_step="uploading"
        )

    logger.complete_operation("Step 3: 動画アップロード")
    return compressed_output_path, converted_gcs_path
