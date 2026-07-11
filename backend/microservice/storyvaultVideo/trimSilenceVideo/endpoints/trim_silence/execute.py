from __future__ import annotations

import os
import shutil
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import jsonify
from google.cloud import firestore, storage
from pydantic import ValidationError

from .request_schema import (
    ProcessRequest,
    TrimSilenceOutput,
    TrimSilenceStatistics,
    TrimmedAssetOutput,
    TrimmedSegmentOutput,
)
from steps.trim_silence import (
    output_split_points,
    render_video_segments,
    trim_silence_video,
)


def _response_success(request_id: str, output: dict[str, Any]):
    return jsonify({"status": "success", "request_id": request_id, "output": output})


def _response_error(
    *,
    request_id: str,
    message: str,
    status_code: int = 500,
    error_type: str = "ProcessingError",
):
    return (
        jsonify(
            {
                "status": "error",
                "request_id": request_id,
                "error": {"message": message, "type": error_type},
            }
        ),
        status_code,
    )


def _log_progress(
    *,
    system_metadata: Any,
    message: str,
    log_type: str = "info",
    current_step: str | None = None,
    **extra: Any,
) -> None:
    collection_id = getattr(system_metadata, "loggingCollectionId", None)
    document_id = getattr(system_metadata, "loggingDocumentId", None)
    if not collection_id or not document_id:
        print(message)
        return
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": message,
        "type": log_type,
        **({"currentStep": current_step} if current_step else {}),
        **extra,
    }
    try:
        firestore.Client().collection(collection_id).document(document_id).update(
            {"logs": firestore.ArrayUnion([payload])}
        )
    except Exception as exc:
        print(f"Failed to append progress log: {exc}; message={message}")


def _download_blob(bucket_name: str, file_path: str, local_path: str) -> None:
    bucket = storage.Client().bucket(bucket_name)
    blob = bucket.blob(file_path)
    if not blob.exists():
        raise FileNotFoundError(f"gs://{bucket_name}/{file_path} does not exist")
    blob.download_to_filename(local_path)


def _upload_blob(bucket_name: str, file_path: str, local_path: str) -> dict[str, Any]:
    bucket = storage.Client().bucket(bucket_name)
    blob = bucket.blob(file_path)
    blob.upload_from_filename(local_path)
    blob.reload()
    return {
        "bucket_name": bucket_name,
        "file_path": file_path,
        "file_size": int(blob.size or Path(local_path).stat().st_size),
    }


def handle(flask_request):
    started_at = time.time()
    temp_dir = tempfile.mkdtemp(prefix="trim_silence_")
    request_id = "unknown"
    system_metadata = None
    try:
        request_data = flask_request.get_json(silent=True)
        if not request_data:
            return _response_error(
                request_id=request_id,
                message="Request body is required",
                status_code=400,
                error_type="ValidationError",
            )
        try:
            process_request = ProcessRequest(**request_data)
        except ValidationError as exc:
            return _response_error(
                request_id=str(request_data.get("request_id", "unknown")),
                message=f"Validation error: {exc}",
                status_code=400,
                error_type="ValidationError",
            )

        request_id = process_request.request_id
        system_metadata = process_request.systemMetadata
        input_data = process_request.input
        local_input = os.path.join(temp_dir, "input.mp4")
        local_output = os.path.join(temp_dir, "trimmed.mp4")
        local_manifest = os.path.join(temp_dir, "manifest.json")

        _log_progress(
            system_metadata=system_metadata,
            message="Downloading source video for silence trimming",
            current_step="download",
        )
        _download_blob(input_data.videoBucketName, input_data.videoFilePath, local_input)

        if input_data.settings.noiseReductionEnabled:
            _log_progress(
                system_metadata=system_metadata,
                message=(
                    "Reducing steady background noise before transcription "
                    f"(strength={input_data.settings.noiseReductionStrengthDb}dB)"
                ),
                current_step="reduce_noise",
            )

        _log_progress(
            system_metadata=system_metadata,
            message=(
                "Detecting silence ranges "
                f"(threshold={input_data.settings.thresholdDb}dB, "
                f"minSilence={input_data.settings.minSilenceMs}ms)"
            ),
            current_step="detect_silence",
        )
        if input_data.settings.cutRangesSeconds is not None:
            _log_progress(
                system_metadata=system_metadata,
                message=(
                    "Normalizing video timeline and rendering selected cut ranges "
                    f"(ranges={len(input_data.settings.cutRangesSeconds)})"
                ),
                current_step="render",
            )
        trim_result = trim_silence_video(
            {
                "input_path": local_input,
                "output_path": local_output,
                "manifest_path": local_manifest,
                "settings": input_data.settings.model_dump(),
            }
        )
        manifest = trim_result["manifest"]

        segment_uploads: list[dict[str, Any]] = []
        if input_data.segmentOutputFilePaths:
            mapped_split_points = output_split_points(
                input_data.splitPointsSeconds,
                manifest["timelineMap"],
                manifest["trimmedDurationSeconds"],
            )
            if len(mapped_split_points) + 1 != len(input_data.segmentOutputFilePaths):
                raise RuntimeError(
                    "One or more split points collapsed into a removed silence range. "
                    "Move the split marker outside the silence range and retry."
                )
            if mapped_split_points:
                local_segment_paths = [
                    os.path.join(temp_dir, f"segment-{index + 1:03d}.mp4")
                    for index in range(len(input_data.segmentOutputFilePaths))
                ]
                rendered_segments = render_video_segments(
                    input_path=local_output,
                    output_paths=local_segment_paths,
                    split_points=mapped_split_points,
                    duration_seconds=manifest["trimmedDurationSeconds"],
                )
            else:
                rendered_segments = [{
                    "path": local_output,
                    "startTimeSeconds": 0.0,
                    "endTimeSeconds": manifest["trimmedDurationSeconds"],
                    "durationSeconds": manifest["trimmedDurationSeconds"],
                }]
            for index, rendered in enumerate(rendered_segments):
                upload = _upload_blob(
                    input_data.outputBucketName,
                    input_data.segmentOutputFilePaths[index],
                    str(rendered["path"]),
                )
                segment_uploads.append({**upload, **rendered})

        _log_progress(
            system_metadata=system_metadata,
            message=(
                "Silence trim rendered "
                f"(cuts={manifest['cutCount']}, "
                f"{manifest['originalDurationSeconds']:.2f}s -> "
                f"{manifest['trimmedDurationSeconds']:.2f}s)"
            ),
            current_step="render",
            manifestSummary={
                "cutCount": manifest["cutCount"],
                "originalDurationSeconds": manifest["originalDurationSeconds"],
                "trimmedDurationSeconds": manifest["trimmedDurationSeconds"],
            },
        )

        _log_progress(
            system_metadata=system_metadata,
            message="Uploading trimmed video and manifest",
            current_step="upload",
        )

        video_upload = _upload_blob(
            input_data.outputBucketName,
            input_data.outputFilePath,
            local_output,
        )
        manifest_upload = _upload_blob(
            input_data.outputBucketName,
            input_data.manifestOutputFilePath,
            local_manifest,
        )

        processing_time = time.time() - started_at
        statistics = TrimSilenceStatistics(
            originalDurationSeconds=manifest["originalDurationSeconds"],
            trimmedDurationSeconds=manifest["trimmedDurationSeconds"],
            removedDurationSeconds=manifest["removedDurationSeconds"],
            cutCount=manifest["cutCount"],
            noAudioStream=manifest["noAudioStream"],
            noiseReductionApplied=manifest["noiseReductionApplied"],
        )
        output = TrimSilenceOutput(
            resultBucketName=video_upload["bucket_name"],
            resultFilePath=video_upload["file_path"],
            trimmedVideo=TrimmedAssetOutput(
                resultBucketName=video_upload["bucket_name"],
                resultFilePath=video_upload["file_path"],
                fileSizeBytes=video_upload["file_size"],
            ),
            manifest=TrimmedAssetOutput(
                resultBucketName=manifest_upload["bucket_name"],
                resultFilePath=manifest_upload["file_path"],
                fileSizeBytes=manifest_upload["file_size"],
            ),
            segments=[
                TrimmedSegmentOutput(
                    segmentNumber=index + 1,
                    resultBucketName=item["bucket_name"],
                    resultFilePath=item["file_path"],
                    fileSizeBytes=item["file_size"],
                    startTimeSeconds=item["startTimeSeconds"],
                    endTimeSeconds=item["endTimeSeconds"],
                    durationSeconds=item["durationSeconds"],
                )
                for index, item in enumerate(segment_uploads)
            ],
            processingTime=processing_time,
            statistics=statistics,
        )
        output_data = output.model_dump()
        _log_progress(
            system_metadata=system_metadata,
            message=f"Silence trim completed ({processing_time:.2f}s)",
            current_step="completed",
            results=output_data,
        )
        return _response_success(request_id, output_data)
    except FileNotFoundError as exc:
        _log_progress(
            system_metadata=system_metadata,
            message=str(exc),
            log_type="error",
            current_step="error",
        )
        return _response_error(
            request_id=request_id,
            message=str(exc),
            status_code=404,
            error_type="FileNotFoundError",
        )
    except Exception as exc:
        _log_progress(
            system_metadata=system_metadata,
            message=f"Silence trim failed: {exc}",
            log_type="error",
            current_step="error",
        )
        return _response_error(request_id=request_id, message=f"Silence trim failed: {exc}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
