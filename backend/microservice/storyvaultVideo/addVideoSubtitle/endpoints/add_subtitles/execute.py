"""
/add-subtitles endpoint implementation.

Generates SRT/ASS subtitle files and a subtitled MP4 from final video output.
"""

import json
import os
import shutil
import time
from typing import Optional

from flask import g
from localPackages.common import firestore_client
from localPackages.common.logger import logger
from localPackages.common.response_formatter import ResponseFormatter
from pydantic import ValidationError

from .request_schema import (
    AddSubtitleOutput,
    ProcessRequest,
    ProcessResponse,
    SubtitleAssetOutput,
    SubtitleStatistics,
)
from steps.add_subtitles import generate_ass_file, generate_srt_file, render_subtitled_video
from steps.download import download_video
from steps.upload import upload_to_gcs


def _progress(ctx, message: str, *, current_step: Optional[str] = None, log_type: str = "info", **kwargs):
    if not ctx:
        return
    params = {
        "ctx": ctx,
        "message": message,
        "log_type": log_type,
        **kwargs,
    }
    if current_step is not None:
        params["current_step"] = current_step
    firestore_client.log_processing_progress(
        **params,
    )


def handle(flask_request):
    """POST /add-subtitles handler."""
    request_start_time = time.time()
    request_id = g.get("request_id", "unknown")
    ctx = g.get("request_context")
    temp_dir = None

    logger.start_operation(f"Generate subtitled video (request_id: {request_id})")

    try:
        request_data = flask_request.get_json()
        if not request_data:
            return ResponseFormatter.error(
                message="Request body is required",
                status_code=400,
                request_id=request_id,
            )

        try:
            process_request = ProcessRequest(**request_data)
            if ctx and process_request.systemMetadata:
                ctx.collection_name = process_request.systemMetadata.loggingCollectionId
                ctx.document_id = process_request.systemMetadata.loggingDocumentId
            logger.info(f"Validation success: {process_request.request_id}")
            _progress(ctx, "Subtitle request validated", current_step="validation")
        except ValidationError as exc:
            error_msg = f"Validation error: {str(exc)}"
            logger.error(error_msg)
            if ctx and request_data.get("systemMetadata"):
                try:
                    ctx.collection_name = request_data["systemMetadata"].get("loggingCollectionId")
                    ctx.document_id = request_data["systemMetadata"].get("loggingDocumentId")
                    if ctx.collection_name and ctx.document_id:
                        _progress(ctx, error_msg, log_type="error", error=str(exc))
                except Exception as log_exc:
                    logger.error(f"Failed to write validation error to Firestore: {str(log_exc)}")
            return ResponseFormatter.error(
                message=error_msg,
                status_code=400,
                request_id=request_id,
            )

        input_data = process_request.input
        srt_output_path = input_data.subtitleSrtOutputFilePath or input_data.outputFilePath.replace(
            ".mp4", ".srt"
        )
        ass_output_path = input_data.subtitleAssOutputFilePath or input_data.outputFilePath.replace(
            ".mp4", ".ass"
        )

        _progress(ctx, "Downloading final video", current_step="download")
        download_result = download_video(
            {
                "video_bucket_name": input_data.videoBucketName,
                "video_file_path": input_data.videoFilePath,
            }
        )
        temp_dir = download_result["temp_dir"]
        video_local_path = download_result["video_local_path"]
        subtitled_local_path = download_result["output_local_path"]
        srt_local_path = os.path.join(temp_dir, "captions.srt")
        ass_local_path = os.path.join(temp_dir, "captions.ass")

        caption_segments = [segment.model_dump() for segment in input_data.captionSegments]
        caption_style = input_data.captionStyle.model_dump()

        _progress(
            ctx,
            f"Generating subtitle files ({len(caption_segments)} segments)",
            current_step="subtitle_files",
        )
        srt_result = generate_srt_file(
            {
                "caption_segments": caption_segments,
                "output_path": srt_local_path,
            }
        )
        ass_result = generate_ass_file(
            {
                "caption_segments": caption_segments,
                "output_path": ass_local_path,
                "caption_style": caption_style,
            }
        )

        _progress(ctx, "Burning ASS subtitles into video", current_step="burning")
        video_result = render_subtitled_video(
            {
                "video_path": video_local_path,
                "ass_path": ass_local_path,
                "output_path": subtitled_local_path,
            }
        )

        _progress(ctx, "Uploading subtitle assets", current_step="uploading")
        video_upload = upload_to_gcs(
            {
                "local_path": video_result["output_path"],
                "bucket_name": input_data.outputBucketName,
                "file_path": input_data.outputFilePath,
                "cleanup": False,
            }
        )
        srt_upload = upload_to_gcs(
            {
                "local_path": srt_result["output_path"],
                "bucket_name": input_data.outputBucketName,
                "file_path": srt_output_path,
                "cleanup": False,
            }
        )
        ass_upload = upload_to_gcs(
            {
                "local_path": ass_result["output_path"],
                "bucket_name": input_data.outputBucketName,
                "file_path": ass_output_path,
                "cleanup": False,
            }
        )

        processing_time = time.time() - request_start_time
        statistics = SubtitleStatistics(
            totalSubtitleSegments=srt_result["subtitle_count"],
            totalDurationSeconds=max(segment.endMs for segment in input_data.captionSegments) / 1000,
            subtitledVideoSizeBytes=video_upload.get("file_size"),
            srtSizeBytes=srt_upload.get("file_size"),
            assSizeBytes=ass_upload.get("file_size"),
            preset=input_data.captionStyle.preset,
        )
        output = AddSubtitleOutput(
            resultBucketName=video_upload["bucket_name"],
            resultFilePath=video_upload["file_path"],
            subtitledVideo=SubtitleAssetOutput(
                resultBucketName=video_upload["bucket_name"],
                resultFilePath=video_upload["file_path"],
                fileSizeBytes=video_upload.get("file_size"),
            ),
            srt=SubtitleAssetOutput(
                resultBucketName=srt_upload["bucket_name"],
                resultFilePath=srt_upload["file_path"],
                fileSizeBytes=srt_upload.get("file_size"),
            ),
            ass=SubtitleAssetOutput(
                resultBucketName=ass_upload["bucket_name"],
                resultFilePath=ass_upload["file_path"],
                fileSizeBytes=ass_upload.get("file_size"),
            ),
            processingTime=processing_time,
            statistics=statistics,
        )
        response = ProcessResponse(output=output, processing_time=processing_time)
        output_data = response.output.model_dump()

        _progress(
            ctx,
            f"Subtitle generation completed ({processing_time:.2f}s)",
            results=output_data,
        )
        logger.complete_operation(f"Subtitled video generated ({processing_time:.2f}s)")
        logger.info(f"Final Response: {json.dumps(output_data, ensure_ascii=False, indent=2)}")
        return ResponseFormatter.success(request_id=request_id, output=output_data)

    except FileNotFoundError as exc:
        error_msg = f"File not found: {str(exc)}"
        logger.error(error_msg, error=exc)
        _progress(ctx, error_msg, log_type="error", error=str(exc))
        return ResponseFormatter.error(
            message=error_msg,
            status_code=404,
            request_id=request_id,
            error_type="FileNotFoundError",
        )

    except Exception as exc:
        error_msg = f"Subtitle processing error: {str(exc)}"
        logger.error(error_msg, error=exc)
        _progress(ctx, error_msg, log_type="error", error=str(exc))
        return ResponseFormatter.error(
            message=f"Subtitle generation failed: {str(exc)}",
            status_code=500,
            request_id=request_id,
            error_type="ProcessingError",
        )
    finally:
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                logger.info(f"Temp directory cleaned: {temp_dir}")
            except Exception as cleanup_exc:
                logger.warning(f"Cleanup error ignored: {str(cleanup_exc)}")
