"""
Aqua Voice Avalon API transcription client.

Avalon exposes an OpenAI-compatible audio transcription endpoint. This wrapper
keeps the rest of the microservice independent from the vendor response shape.
"""

import mimetypes
import os
import time
from typing import Any, Dict, Optional

import requests

from localPackages.common.context import context
from localPackages.common.logger import logger


class AquaVoiceTranscription:
    """Small HTTP client for Aqua Voice Avalon transcription."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        self.api_key = api_key or context.config.aqua_voice_api_key
        self.base_url = (base_url or context.config.aqua_voice_base_url).rstrip("/")
        self.model = model or context.config.aqua_voice_model
        self.timeout = timeout or context.config.aqua_voice_timeout

        if not self.api_key:
            raise RuntimeError("AQUA_VOICE_API_KEY is not configured")

    def transcribe_file(self, file_path: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe a local audio file through Aqua Voice Avalon.

        Args:
            file_path: Local audio file path.
            filename: Optional filename sent in the multipart payload.

        Returns:
            Normalized transcription result.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        endpoint = f"{self.base_url}/audio/transcriptions"
        upload_name = filename or os.path.basename(file_path)
        content_type = mimetypes.guess_type(upload_name)[0] or "application/octet-stream"

        logger.info(f"🎙️ Aqua Voice Avalonへ文字起こしリクエスト送信: model={self.model}, file={upload_name}")
        started_at = time.time()

        with open(file_path, "rb") as audio_file:
            response = requests.post(
                endpoint,
                headers={"Authorization": f"Bearer {self.api_key}"},
                data={"model": self.model},
                files={"file": (upload_name, audio_file, content_type)},
                timeout=self.timeout,
            )

        elapsed = time.time() - started_at

        try:
            response_payload = response.json()
        except ValueError:
            response_payload = {"text": response.text}

        if not response.ok:
            message = _extract_error_message(response_payload) or response.text
            raise RuntimeError(f"Aqua Voice API request failed ({response.status_code}): {message}")

        transcript = response_payload.get("text")
        if transcript is None:
            transcript = response_payload.get("transcript", "")

        logger.info(f"✅ Aqua Voice Avalon文字起こし完了: {elapsed:.1f}秒")

        return {
            "transcript": transcript,
            "operation_id": response_payload.get("id") or f"{int(time.time())}",
            "language": response_payload.get("language", ""),
            "confidence": response_payload.get("confidence", 0.0),
            "duration_seconds": response_payload.get("duration") or response_payload.get("duration_seconds", 0.0),
            "raw_response": response_payload,
        }


def _extract_error_message(payload: Any) -> Optional[str]:
    if not isinstance(payload, dict):
        return None

    error = payload.get("error")
    if isinstance(error, dict):
        return error.get("message") or error.get("detail")
    if isinstance(error, str):
        return error

    message = payload.get("message")
    return message if isinstance(message, str) else None
