"""
Download step.

Downloads a video file from GCS.
"""

import os
import tempfile
import time
from localPackages.common.logger import logger
from localPackages.common import gcs_storage


def download_video(params: dict) -> dict:
    """
    Download a video file from GCS.

    params:
        video_bucket_name: str - GCS bucket name
        video_file_path: str - GCS file path

    returns:
        dict - download result
            video_local_path: str
            output_local_path: str
            temp_dir: str
    """
    video_bucket_name = params["video_bucket_name"]
    video_file_path = params["video_file_path"]

    logger.info(f"📥 Download start: gs://{video_bucket_name}/{video_file_path}")

    temp_dir = tempfile.mkdtemp(prefix="subtitle_")
    logger.debug(f"Temp dir created: {temp_dir}")

    try:
        video_local_path = os.path.join(temp_dir, "input_video.mp4")

        actual_video_path = _find_actual_file_path(video_bucket_name, video_file_path)
        if actual_video_path != video_file_path:
            logger.info(f"🔄 Path adjusted: {video_file_path} → {actual_video_path}")

        success = _download_with_retry({
            "bucket_name": video_bucket_name,
            "file_path": actual_video_path,
            "local_path": video_local_path,
            "max_retries": 3
        })

        if not success:
            raise FileNotFoundError(f"Video file not found: gs://{video_bucket_name}/{actual_video_path}")

        logger.success(f"✅ Video downloaded: {video_local_path}")

        output_local_path = os.path.join(temp_dir, "output_subtitled.mp4")

        return {
            "video_local_path": video_local_path,
            "output_local_path": output_local_path,
            "temp_dir": temp_dir
        }

    except Exception as exc:
        logger.error(f"❌ Download error: {str(exc)}", error=exc)
        raise


def _download_with_retry(params: dict) -> bool:
    """Download with exponential backoff retries."""
    bucket_name = params["bucket_name"]
    file_path = params["file_path"]
    local_path = params["local_path"]
    max_retries = params.get("max_retries", 3)

    logger.info(f"🔍 Download attempt: gs://{bucket_name}/{file_path}")

    retry_delays = [1, 2, 4]

    for attempt in range(max_retries):
        try:
            gcs_storage.get_client().bucket(bucket_name).blob(file_path).download_to_filename(local_path)
            logger.success(f"✅ Downloaded: gs://{bucket_name}/{file_path}")
            return True
        except Exception as exc:
            if attempt < max_retries - 1:
                delay = retry_delays[attempt]
                logger.warning(
                    f"⚠️ Download failed (attempt {attempt + 1}/{max_retries}): {str(exc)}. Retry in {delay}s..."
                )
                time.sleep(delay)
            else:
                logger.error(f"❌ Download failed after {max_retries} attempts: {str(exc)}")
                return False

    return False


def _find_actual_file_path(bucket_name: str, file_path: str) -> str:
    """Find actual file path by checking existence and listing."""
    try:
        blob = gcs_storage.get_client().bucket(bucket_name).blob(file_path)
        if blob.exists():
            return file_path

        filename = os.path.basename(file_path)
        directory = os.path.dirname(file_path)

        logger.info(f"🔍 Searching file: {filename} in {directory}")
        bucket = gcs_storage.get_client().bucket(bucket_name)
        blobs = list(bucket.list_blobs(prefix=directory if directory else ""))
        for candidate in blobs:
            if os.path.basename(candidate.name) == filename:
                logger.info(f"✅ Found similar file: {candidate.name}")
                return candidate.name
    except Exception as exc:
        logger.warning(f"⚠️ File search error: {str(exc)}")

    return file_path
