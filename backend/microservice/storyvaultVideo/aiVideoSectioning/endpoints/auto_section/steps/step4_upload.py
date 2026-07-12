"""
Step 4: アップロード処理

カットされた動画と音声セグメントをGCSにアップロードします。
"""

import os
import time
from typing import List, Dict, Any
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import gcs_storage
from localPackages.common import firestore_client
from localPackages.core.video_audio_processor import SectionSegment


def get_section_output_paths(
    ctx: RequestContext,
    section_id: str,
    index: int
) -> tuple[str, str]:
    """
    セクションの出力パスを生成
    
    Args:
        ctx: リクエストコンテキスト
        section_id: セクションID
        index: セクションインデックス
        
    Returns:
        tuple[str, str]: (動画出力パス, 音声出力パス)
    """
    input_data = ctx.get_param('input', {})
    system_metadata = ctx.get_param('systemMetadata', {})
    video_id = input_data.get('videoId')
    project_id = input_data.get('projectId')
    organization_id = system_metadata.get('organizationId')
    space_id = system_metadata.get('spaceId')
    
    # 出力パスを生成（既存のパターンに合わせる）
    # 動画: organizations/{organizationId}/spaces/{spaceId}/videos/{videoId}/narrationProjects/{projectId}/sections/{sectionId}/section.mp4
    # 音声: organizations/{organizationId}/spaces/{spaceId}/videos/{videoId}/narrationProjects/{projectId}/sections/{sectionId}/recording.m4a
    video_output_path = f"organizations/{organization_id}/spaces/{space_id}/videos/{video_id}/narrationProjects/{project_id}/sections/{section_id}/section.mp4"
    audio_output_path = f"organizations/{organization_id}/spaces/{space_id}/videos/{video_id}/narrationProjects/{project_id}/sections/{section_id}/recording.m4a"
    
    return video_output_path, audio_output_path


def upload_section_to_gcs(
    ctx: RequestContext,
    segment: SectionSegment
) -> Dict[str, Any]:
    """
    セクションの動画と音声をGCSにアップロード
    
    Args:
        ctx: リクエストコンテキスト
        segment: セクションセグメント情報
        
    Returns:
        アップロード結果の辞書
    """
    operation_start_time = time.time()
    
    logger.start_operation(f"GCSセクションアップロード [section: {segment.section_id}]")
    
    try:
        input_data = ctx.get_param('input', {})
        output_bucket = input_data.get('outputBucketName')
        
        # 出力パスを生成
        video_output_path, audio_output_path = get_section_output_paths(
            ctx, segment.section_id, segment.index
        )
        
        # ストレージクライアントを取得
        client = gcs_storage.get_client()
        bucket = client.bucket(output_bucket)
        
        upload_results = {}
        
        # 動画をアップロード
        if segment.video_temp_path and os.path.exists(segment.video_temp_path):
            video_blob = bucket.blob(video_output_path)
            video_blob.upload_from_filename(segment.video_temp_path)
            
            video_gcs_path = f"gs://{output_bucket}/{video_output_path}"
            logger.success(f"動画アップロード完了: {video_gcs_path}")
            
            upload_results["videoSegment"] = {
                "bucketName": output_bucket,
                "gcsFilePath": video_output_path,
                "segmentNumber": segment.index,
                "startTime": segment.start_time,
                "endTime": segment.end_time,
                "duration": segment.end_time - segment.start_time,
                "sizeBytes": segment.video_size_bytes or 0
            }
        else:
            raise ValueError(f"動画ファイルが見つかりません: {segment.video_temp_path}")
        
        # 音声をアップロード
        if segment.audio_temp_path and os.path.exists(segment.audio_temp_path):
            audio_blob = bucket.blob(audio_output_path)
            audio_blob.upload_from_filename(segment.audio_temp_path)
            
            audio_gcs_path = f"gs://{output_bucket}/{audio_output_path}"
            logger.success(f"音声アップロード完了: {audio_gcs_path}")
            
            upload_results["audioSegment"] = {
                "bucketName": output_bucket,
                "gcsFilePath": audio_output_path,
                "segmentNumber": segment.index,
                "startTime": segment.start_time,
                "endTime": segment.end_time,
                "duration": segment.end_time - segment.start_time,
                "sizeBytes": segment.audio_size_bytes or 0
            }
        else:
            logger.warning(f"音声ファイルが見つかりません: {segment.audio_temp_path}")
            # 音声がない場合は空の情報を設定
            upload_results["audioSegment"] = {
                "bucketName": output_bucket,
                "gcsFilePath": "",
                "segmentNumber": segment.index,
                "startTime": segment.start_time,
                "endTime": segment.end_time,
                "duration": segment.end_time - segment.start_time,
                "sizeBytes": 0
            }
        
        operation_time = time.time() - operation_start_time
        logger.performance_metric(f"セクション{segment.index + 1}アップロード時間", operation_time, "秒")
        logger.complete_operation(f"GCSセクションアップロード [section: {segment.section_id}]", operation_time)
        
        return upload_results
        
    except Exception as e:
        operation_time = time.time() - operation_start_time
        logger.error(f"GCSアップロードエラー [section: {segment.section_id}]", 
                    error=e, operation_time=operation_time)
        raise


def execute(
    ctx: RequestContext,
    segments: List[SectionSegment]
) -> List[Dict[str, Any]]:
    """
    Step 4: カットされた動画と音声をGCSにアップロード

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        segments: List[SectionSegment] - カットされたセクションセグメント
    }

    returns: List[Dict[str, Any]] - アップロード結果のリスト
    """
    logger.start_operation("Step 4: 動画・音声アップロード")

    # Firestoreに進捗を記録
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message="カットされた動画と音声をアップロード中",
            current_step="uploading",
            progress={
                "uploaded": 0,
                "total": len(segments)
            }
        )

    upload_results = []

    for i, segment in enumerate(segments):
        # Firestoreにアップロード開始を記録
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"セクション{i + 1}/{len(segments)}をアップロード開始",
                current_step="uploading",
                progress={
                    "uploaded": i,
                    "total": len(segments)
                }
            )
        
        # 各セクションをアップロード
        result = upload_section_to_gcs(ctx, segment)
        
        # セクション情報を追加
        upload_result = {
            "sectionId": segment.section_id,
            "index": segment.index,
            "startTime": segment.start_time,
            "endTime": segment.end_time,
            "title": segment.title,
            **result
        }
        
        upload_results.append(upload_result)

        # Firestoreにアップロード完了を記録
        if ctx.collection_name and ctx.document_id:
            total_size_mb = (
                (result.get("videoSegment", {}).get("sizeBytes", 0) or 0) +
                (result.get("audioSegment", {}).get("sizeBytes", 0) or 0)
            ) / (1024 * 1024)
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"セクション{i + 1}/{len(segments)}をアップロード完了 ({total_size_mb:.2f} MB)",
                current_step="uploading",
                progress={
                    "uploaded": i + 1,
                    "total": len(segments)
                }
            )

    # コンテキストにアップロード結果を保存
    ctx.upload_results = upload_results

    # Firestoreに全アップロード完了を記録
    if ctx.collection_name and ctx.document_id:
        total_size_mb = sum(
            (r.get("videoSegment", {}).get("sizeBytes", 0) or 0) +
            (r.get("audioSegment", {}).get("sizeBytes", 0) or 0)
            for r in upload_results
        ) / (1024 * 1024)
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"全セクションのアップロード完了 ({len(segments)}個, 合計 {total_size_mb:.2f} MB)",
            current_step="uploading"
        )

    logger.complete_operation("Step 4: 動画・音声アップロード")

    return upload_results
