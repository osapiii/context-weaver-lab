"""
Step 1: ダウンロード処理

各セクション動画をGCSからダウンロードし、一時ディレクトリに保存します。
"""

from typing import List
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import gcs_storage
from localPackages.common import firestore_client


def execute(ctx: RequestContext) -> List[str]:
    """
    Step 1: 各セクション動画をGCSからダウンロード

    params: {
        ctx: RequestContext - リクエストコンテキスト
    }

    returns: List[str] - ダウンロードした動画ファイルのパスのリスト
    """
    logger.start_operation("Step 1: セクション動画ダウンロード")

    # Firestoreに進捗を記録（開始）
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message="セクション動画をダウンロード中",
            current_step="downloading"
        )

    # inputからセクション動画パス情報を取得
    input_data = ctx.get_param('input', {})
    section_video_paths = input_data.get('sectionVideoPaths', [])

    if not section_video_paths:
        raise ValueError("sectionVideoPathsが空です")

    logger.info(f"ダウンロード対象: {len(section_video_paths)}個のセクション動画")

    downloaded_paths = []

    for i, section_path in enumerate(section_video_paths):
        bucket_name = section_path.get('bucketName')
        file_path = section_path.get('filePath')

        if not bucket_name or not file_path:
            raise ValueError(f"セクション{i}のパス情報が不完全です: {section_path}")

        gcs_path = f"gs://{bucket_name}/{file_path}"
        logger.file_operation(f"セクション{i + 1}をダウンロード開始", gcs_path)

        # Firestoreに進捗を記録
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"セクション{i + 1}/{len(section_video_paths)}をダウンロード中: {file_path}",
                current_step="downloading",
                progress={
                    "downloaded": i,
                    "total": len(section_video_paths)
                }
            )

        # GCSから動画をダウンロード
        # 一時ファイルパスを生成
        import os
        temp_filename = f"section_{i:03d}.mp4"
        temp_path = os.path.join(ctx.temp_dir, temp_filename)

        # 一時ディレクトリが存在しない場合は作成
        os.makedirs(ctx.temp_dir, exist_ok=True)

        # GCSからダウンロード
        client = gcs_storage.get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(file_path)

        if not blob.exists():
            raise ValueError(f"セクション動画が見つかりません: {gcs_path}")

        # ファイルサイズ確認
        blob.reload()
        file_size_mb = blob.size / (1024 * 1024) if blob.size else 0
        logger.info(f"セクション{i + 1}ファイルサイズ: {file_size_mb:.2f} MB")

        # ダウンロード実行
        blob.download_to_filename(temp_path)
        downloaded_paths.append(temp_path)

        # Firestoreに進捗を記録
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"セクション{i + 1}/{len(section_video_paths)}をダウンロード完了 ({file_size_mb:.2f} MB)",
                current_step="downloading",
                progress={
                    "downloaded": i + 1,
                    "total": len(section_video_paths)
                }
            )

    # コンテキストにダウンロードパスを保存
    ctx.downloaded_video_paths = downloaded_paths

    # Firestoreに全ダウンロード完了を記録
    if ctx.collection_name and ctx.document_id:
        total_size_mb = sum(
            os.path.getsize(path) for path in downloaded_paths
        ) / (1024 * 1024)
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"全セクション動画のダウンロード完了 ({len(section_video_paths)}個, 合計 {total_size_mb:.2f} MB)",
            current_step="downloading"
        )

    logger.complete_operation("Step 1: セクション動画ダウンロード")

    return downloaded_paths
