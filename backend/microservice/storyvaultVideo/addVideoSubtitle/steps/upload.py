"""
Upload step.

Uploads the processed video to GCS.
"""

import os
import time
import shutil
from localPackages.common.logger import logger
from localPackages.common import gcs_storage


def upload_to_gcs(params: dict) -> dict:
    """
    Upload video to GCS.

    params:
        local_path: str
        bucket_name: str
        file_path: str

    returns:
        dict - upload result
            bucket_name: str
            file_path: str
            file_size: int
    """
    local_path = params["local_path"]
    bucket_name = params["bucket_name"]
    file_path = params["file_path"]
    cleanup = params.get("cleanup", True)

    logger.info(f"📤 Upload start: {local_path} → gs://{bucket_name}/{file_path}")

    try:
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Local file not found: {local_path}")

        file_size = os.path.getsize(local_path)
        logger.info(f"File size: {file_size / (1024 * 1024):.2f} MB")

        success = _upload_with_retry({
            "local_path": local_path,
            "bucket_name": bucket_name,
            "destination_blob_name": file_path,
            "max_retries": 3
        })

        if not success:
            raise Exception(f"Upload failed after retries: gs://{bucket_name}/{file_path}")

        logger.success(f"✅ Upload completed: gs://{bucket_name}/{file_path}")

        if cleanup:
            _cleanup_local_files(local_path)

        return {
            "bucket_name": bucket_name,
            "file_path": file_path,
            "file_size": file_size
        }

    except Exception as exc:
        logger.error(f"❌ Upload error: {str(exc)}", error=exc)
        try:
            if cleanup:
                _cleanup_local_files(local_path)
        except Exception:
            pass
        raise


def _upload_with_retry(params: dict) -> bool:
    """Upload with exponential backoff retries."""
    local_path = params["local_path"]
    bucket_name = params["bucket_name"]
    destination_blob_name = params["destination_blob_name"]
    max_retries = params.get("max_retries", 3)

    retry_delays = [1, 2, 4]

    for attempt in range(max_retries):
        try:
            if not os.path.exists(local_path):
                logger.error(f"❌ Local file missing: {local_path}")
                return False

            gcs_storage.get_client().bucket(bucket_name).blob(destination_blob_name).upload_from_filename(local_path)
            return True
        except Exception as exc:
            if attempt < max_retries - 1:
                delay = retry_delays[attempt]
                logger.warning(
                    f"⚠️ Upload failed (attempt {attempt + 1}/{max_retries}): {str(exc)}. Retry in {delay}s..."
                )
                time.sleep(delay)
            else:
                logger.error(f"❌ Upload failed after {max_retries} attempts: {str(exc)}")
                return False

    return False


def _cleanup_local_files(local_path: str):
    """Cleanup local temp files."""
    try:
        temp_dir = os.path.dirname(local_path)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            logger.info(f"🗑️ Temp files cleaned: {temp_dir}")
    except Exception as exc:
        logger.warning(f"⚠️ Cleanup error (ignored): {str(exc)}")
