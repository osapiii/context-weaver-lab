"""Aqua Voice transcription callable for VibeControl zapping audio."""
from __future__ import annotations

import base64
import os
from typing import Any

import requests
from firebase_functions import https_fn
from firebase_functions.params import SecretParam


AQUA_VOICE_API_KEY = SecretParam("AQUA_VOICE_API_KEY")
AQUA_TRANSCRIPTION_URL = os.getenv(
    "AQUA_VOICE_TRANSCRIPTION_URL",
    "https://api.aquavoice.com/api/v1/audio/transcriptions",
).strip()
AQUA_MODEL = os.getenv("AQUA_VOICE_MODEL", "avalon-v1.5").strip()
MAX_AUDIO_BYTES = int(os.getenv("AQUA_VOICE_MAX_AUDIO_BYTES", str(8 * 1024 * 1024)))


def _api_key() -> str:
    return AQUA_VOICE_API_KEY.value.strip()


def _require_auth(req: https_fn.CallableRequest) -> str:
    if not req.auth or not req.auth.uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="ログインが必要です",
        )
    return req.auth.uid


def _decode_base64_audio(data_url_or_base64: str) -> bytes:
    raw = (data_url_or_base64 or "").strip()
    if not raw:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="audioBase64 is required",
        )
    if "," in raw and raw.lower().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        audio_bytes = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="audioBase64 is invalid",
        ) from exc
    if not audio_bytes:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="audioBase64 is empty",
        )
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.OUT_OF_RANGE,
            message=(
                f"音声ファイルがAqua Voiceの同期文字起こし上限を超えています "
                f"({len(audio_bytes)} bytes > {MAX_AUDIO_BYTES} bytes)"
            ),
        )
    return audio_bytes


def _extract_text(payload: Any) -> str:
    if isinstance(payload, dict):
        for key in ("text", "transcript", "transcription"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        segments = payload.get("segments")
        if isinstance(segments, list):
            joined = "\n".join(
                str(item.get("text") or "").strip()
                for item in segments
                if isinstance(item, dict) and str(item.get("text") or "").strip()
            )
            if joined.strip():
                return joined.strip()
    if isinstance(payload, str):
        return payload.strip()
    return ""


@https_fn.on_call(
    region="asia-northeast1",
    memory=1024,
    timeout_sec=300,
    secrets=[AQUA_VOICE_API_KEY],
)
def transcribe_zapping_video_with_aqua(
    req: https_fn.CallableRequest,
) -> dict[str, Any]:
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    key = _api_key()
    if not key:
        return {
            "ok": False,
            "provider": "aqua-voice",
            "skipped": True,
            "error": "AQUA_VOICE_API_KEY is not configured",
        }

    audio_base64 = str(data.get("audioBase64") or data.get("videoBase64") or "")
    audio_bytes = _decode_base64_audio(audio_base64)
    content_type = str(data.get("contentType") or "audio/webm").strip() or "audio/webm"
    file_name = str(data.get("fileName") or "zapping-audio.webm").strip()
    if not file_name:
        file_name = "zapping-audio.webm"

    try:
        response = requests.post(
            AQUA_TRANSCRIPTION_URL,
            headers={"Authorization": f"Bearer {key}"},
            data={
                "model": AQUA_MODEL,
                "response_format": "json",
            },
            files={
                "file": (file_name, audio_bytes, content_type),
            },
            timeout=240,
        )
    except requests.RequestException as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAVAILABLE,
            message=f"Aqua Voice API request failed: {exc}",
        ) from exc

    if response.status_code >= 400:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Aqua Voice API returned HTTP {response.status_code}: {response.text[:500]}",
        )

    try:
        payload = response.json()
    except ValueError:
        payload = response.text
    text = _extract_text(payload)
    return {
        "ok": True,
        "provider": "aqua-voice",
        "model": AQUA_MODEL,
        "text": text,
        "raw": payload if isinstance(payload, dict) else None,
    }
