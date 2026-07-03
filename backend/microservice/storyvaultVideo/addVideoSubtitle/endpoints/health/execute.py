"""
/health endpoint implementation.

Checks service health and API client connectivity.
"""

import subprocess
import sys
import os
from datetime import datetime
from flask import jsonify
from localPackages.common.context import context
from localPackages.common.logger import logger
from localPackages.common import gcs_storage
from localPackages.common import firestore_client

FFMPEG_BINARY = os.getenv("FFMPEG_BINARY", "ffmpeg")


def handle():
    """Handle /health request."""
    logger.start_operation("Health check")

    try:
        service_info = context.get_service_info()

        try:
            gcs_status = "connected" if gcs_storage.test_connection() else "error"
        except Exception as exc:
            gcs_status = f"error: {str(exc)}"

        try:
            firestore_status = "connected" if firestore_client.test_connection() else "error"
        except Exception as exc:
            firestore_status = f"error: {str(exc)}"

        try:
            ffmpeg_result = subprocess.run(
                [FFMPEG_BINARY, "-version"],
                check=True,
                capture_output=True,
                text=True,
            )
            ffmpeg_version = ffmpeg_result.stdout.splitlines()[0]
            filters_result = subprocess.run(
                [FFMPEG_BINARY, "-filters"],
                check=True,
                capture_output=True,
                text=True,
            )
            ffmpeg_status = (
                "available"
                if " subtitles " in filters_result.stdout
                else "error: subtitles filter is unavailable"
            )
        except Exception as exc:
            ffmpeg_version = "unknown"
            ffmpeg_status = f"error: {str(exc)}"

        dependency_status = (
            "healthy" if gcs_status == "connected" and firestore_status == "connected" else "degraded"
        )

        health_info = {
            "status": "healthy",
            "dependencyStatus": dependency_status,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "service": "addVideoSubtitle",
            "service_info": service_info,
            "environment": {
                "python_version": sys.version.split()[0],
                "debug_mode": context.debug_mode,
                "ffmpeg_version": ffmpeg_version
            },
            "api_status": {
                "storage": gcs_status,
                "firestore": firestore_status,
                "ffmpeg": ffmpeg_status
            }
        }

        logger.data_analysis("Health check result", health_info)
        logger.success("Health check completed")

        return jsonify(health_info), 200

    except Exception as exc:
        logger.error("Health check error", error=exc)
        return jsonify({
            "status": "unhealthy",
            "error": str(exc),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }), 500
