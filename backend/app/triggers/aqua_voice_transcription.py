"""Gemini timestamped transcription callable for StoryVault zapping audio."""
from __future__ import annotations

import base64
import json
import os
import re
from typing import Any

from firebase_functions import https_fn
import google.auth
from google.auth.transport.requests import Request as GoogleAuthRequest
import requests


GEMINI_TRANSCRIPTION_MODEL = os.getenv(
    "GEMINI_TRANSCRIPTION_MODEL",
    "gemini-2.5-flash",
).strip()
GEMINI_TRANSCRIPTION_LOCATION = os.getenv(
    "GEMINI_TRANSCRIPTION_LOCATION",
    os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
).strip()
MAX_AUDIO_BYTES = int(os.getenv("GEMINI_TRANSCRIPTION_MAX_AUDIO_BYTES", str(18 * 1024 * 1024)))
SRT_TIME_RE = re.compile(
    r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*"
    r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})"
)
FILLER_ONLY_RE = re.compile(
    r"^\s*(?:[、。,.!?！？\s]*"
    r"(?:え+|えー+|えっと|えーっと|あ+|あー+|あの+|うーん|んー+)"
    r"[、。,.!?！？\s]*)+$"
)
INLINE_FILLER_RE = re.compile(
    r"(^|[\s、。,.!?！？])"
    r"(?:え+|えー+|えっと|えーっと|あ+|あー+|うーん|んー+)"
    r"(?=($|[\s、。,.!?！？]))"
)


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
                f"音声ファイルがGemini同期文字起こし上限を超えています "
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


def _milliseconds(value: Any, *, unit: str = "auto") -> int | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric < 0:
        numeric = 0
    if unit == "ms":
        return int(round(numeric))
    if unit == "seconds":
        return int(round(numeric * 1000))
    # OpenAI-compatible verbose_json uses seconds. Plain `start` / `end`
    # values are ambiguous, so keep the historical auto-detection there.
    return int(round(numeric if numeric > 1000 else numeric * 1000))


def _parse_srt_part(
    hour: str | None,
    minute: str,
    second: str,
    millis: str,
) -> int:
    hours = int(hour or 0)
    minutes = int(minute or 0)
    seconds = int(second or 0)
    ms = int((millis + "000")[:3])
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + ms


def _extract_srt(payload: Any) -> str:
    if isinstance(payload, str) and SRT_TIME_RE.search(payload):
        return payload.strip()
    if not isinstance(payload, dict):
        return ""
    for key in ("srt", "transcript_srt", "transcriptSrt"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _segments_from_srt(srt: str) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    for index, block in enumerate(re.split(r"\n\s*\n", srt.strip())):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        time_line_index = next(
            (line_index for line_index, line in enumerate(lines) if SRT_TIME_RE.search(line)),
            -1,
        )
        if time_line_index < 0:
            continue
        match = SRT_TIME_RE.search(lines[time_line_index])
        if not match:
            continue
        text = " ".join(lines[time_line_index + 1 :]).strip()
        if not text:
            continue
        segments.append(
            {
                "id": f"cue-{index + 1:04d}",
                "index": index + 1,
                "startMs": _parse_srt_part(match.group(1), match.group(2), match.group(3), match.group(4)),
                "endMs": _parse_srt_part(match.group(5), match.group(6), match.group(7), match.group(8)),
                "text": text,
            }
        )
    return segments


def _extract_segments(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        raw_segments = (
            payload.get("segments")
            or payload.get("cues")
            or payload.get("transcriptSegments")
            or payload.get("paragraphs")
            or []
        )
        segments: list[dict[str, Any]] = []
        if isinstance(raw_segments, list):
            for index, item in enumerate(raw_segments):
                if not isinstance(item, dict):
                    continue
                text = str(item.get("text") or item.get("transcript") or "").strip()
                if not text:
                    continue
                if item.get("startMs") is not None:
                    start_ms = _milliseconds(item.get("startMs"), unit="ms")
                elif item.get("start_ms") is not None:
                    start_ms = _milliseconds(item.get("start_ms"), unit="ms")
                elif item.get("startSeconds") is not None:
                    start_ms = _milliseconds(item.get("startSeconds"), unit="seconds")
                else:
                    start_ms = _milliseconds(item.get("start"))

                if item.get("endMs") is not None:
                    end_ms = _milliseconds(item.get("endMs"), unit="ms")
                elif item.get("end_ms") is not None:
                    end_ms = _milliseconds(item.get("end_ms"), unit="ms")
                elif item.get("endSeconds") is not None:
                    end_ms = _milliseconds(item.get("endSeconds"), unit="seconds")
                else:
                    end_ms = _milliseconds(item.get("end"))
                if start_ms is None:
                    continue
                if end_ms is None or end_ms < start_ms:
                    end_ms = start_ms
                cue = {
                    "id": str(item.get("id") or f"cue-{index + 1:04d}"),
                    "index": int(item.get("index") or index + 1),
                    "startMs": start_ms,
                    "endMs": end_ms,
                    "text": text,
                }
                confidence = item.get("confidence")
                if isinstance(confidence, (int, float)):
                    cue["confidence"] = max(0, min(1, float(confidence)))
                segments.append(cue)
        if segments:
            return segments
    return _segments_from_srt(_extract_srt(payload))


def _format_srt_time(ms: int) -> str:
    safe_ms = max(0, int(round(ms)))
    total_seconds = safe_ms // 1000
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    millis = safe_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def _segments_to_srt(segments: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for index, segment in enumerate(segments, start=1):
        start_ms = int(segment.get("startMs") or 0)
        end_ms = int(segment.get("endMs") or start_ms)
        text = str(segment.get("text") or "").strip()
        if not text:
            continue
        blocks.append(
            "\n".join(
                [
                    str(index),
                    f"{_format_srt_time(start_ms)} --> {_format_srt_time(end_ms)}",
                    text,
                ]
            )
        )
    return "\n\n".join(blocks)


def _clean_filler_text(text: str) -> str:
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if not normalized:
        return ""
    if FILLER_ONLY_RE.match(normalized):
        return ""
    previous = None
    cleaned = normalized
    while previous != cleaned:
        previous = cleaned
        cleaned = INLINE_FILLER_RE.sub(lambda match: match.group(1), cleaned)
        cleaned = re.sub(r"\s+([、。,.!?！？])", r"\1", cleaned)
        cleaned = re.sub(r"([、。,.!?！？])\s+", r"\1", cleaned)
        cleaned = re.sub(r"[、,]{2,}", "、", cleaned)
        cleaned = re.sub(r"[。.]([。.]*)", "。", cleaned)
        cleaned = cleaned.strip(" 、,.")
    return cleaned.strip()


def _clean_segments_fillers(
    segments: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    cleaned_segments: list[dict[str, Any]] = []
    for segment in segments:
        cleaned_text = _clean_filler_text(str(segment.get("text") or ""))
        if not cleaned_text:
            continue
        next_segment = dict(segment)
        next_segment["text"] = cleaned_text
        next_segment["index"] = len(cleaned_segments) + 1
        next_segment["id"] = str(next_segment.get("id") or f"cue-{len(cleaned_segments) + 1:04d}")
        cleaned_segments.append(next_segment)
    return cleaned_segments


def _project_id() -> str:
    return (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCLOUD_PROJECT")
        or os.getenv("GCP_PROJECT")
        or ""
    ).strip()


def _vertex_generate_content_url() -> str:
    project_id = _project_id()
    if not project_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GOOGLE_CLOUD_PROJECT is not configured for Gemini transcription",
        )
    location = GEMINI_TRANSCRIPTION_LOCATION or "us-central1"
    model = GEMINI_TRANSCRIPTION_MODEL or "gemini-2.5-flash"
    return (
        f"https://{location}-aiplatform.googleapis.com/v1/"
        f"projects/{project_id}/locations/{location}/publishers/google/models/{model}:generateContent"
    )


def _json_from_model_text(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Gemini transcription did not return valid JSON: {raw[:300]}",
        ) from exc
    if not isinstance(parsed, dict):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Gemini transcription returned a non-object JSON payload",
        )
    return parsed


def _request_gemini_transcription(
    *,
    audio_bytes: bytes | None = None,
    gcs_uri: str | None = None,
    content_type: str,
) -> dict[str, Any]:
    prompt = """
あなたは高精度な音声文字起こしエンジンです。
入力音声を日本語中心に文字起こしし、必ずタイムスタンプ付きJSONだけを返してください。

出力JSON:
{
  "text": "全文",
  "segments": [
    {"startMs": 0, "endMs": 2500, "text": "発話テキスト"}
  ]
}

厳守事項:
- Markdownや説明文を返さない。
- segments は音声の時系列順にする。
- startMs/endMs は音声先頭からのミリ秒。
- 1 segment は意味のまとまり、または長くても8秒程度に区切る。
- 「え」「あ」「えっと」「えーっと」「あの」「うーん」など、意味を持たないフィラーだけを除去する。
- フィラー以外の語順・語句・固有名詞は言い換えない。
- 音声が無音でない限り、segments を空にしない。
- 聞き取れない箇所は推測で補わず、分かる範囲だけを書く。
""".strip()
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    credentials.refresh(GoogleAuthRequest())
    media_part: dict[str, Any]
    if gcs_uri:
        media_part = {
            "fileData": {
                "mimeType": content_type or "video/webm",
                "fileUri": gcs_uri,
            }
        }
    elif audio_bytes:
        media_part = {
            "inlineData": {
                "mimeType": content_type or "audio/webm",
                "data": base64.b64encode(audio_bytes).decode("ascii"),
            }
        }
    else:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="audioBase64 or gcsUri is required",
        )
    response = requests.post(
        _vertex_generate_content_url(),
        headers={
            "Authorization": f"Bearer {credentials.token}",
            "Content-Type": "application/json",
        },
        json={
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        media_part,
                        {"text": prompt},
                    ],
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0,
            },
        },
        timeout=280,
    )
    if response.status_code >= 400:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAVAILABLE,
            message=(
                "Gemini transcription request failed: "
                f"HTTP {response.status_code} {response.text[:500]}"
            ),
        )
    payload = response.json()
    parts = (
        payload.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [])
    )
    text = "\n".join(
        part.get("text", "")
        for part in parts
        if isinstance(part, dict) and isinstance(part.get("text"), str)
    ).strip()
    return _json_from_model_text(text)


@https_fn.on_call(
    region="asia-northeast1",
    memory=1024,
    timeout_sec=300,
)
def transcribe_zapping_video_with_aqua(
    req: https_fn.CallableRequest,
) -> dict[str, Any]:
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}

    audio_base64 = str(data.get("audioBase64") or data.get("videoBase64") or "")
    gcs_uri = str(data.get("gcsUri") or "").strip()
    audio_bytes = _decode_base64_audio(audio_base64) if audio_base64.strip() else None
    if not audio_bytes and not gcs_uri:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="audioBase64 or gcsUri is required",
        )
    content_type = str(data.get("contentType") or "audio/webm").strip() or "audio/webm"
    file_name = str(data.get("fileName") or "zapping-audio.webm").strip()
    if not file_name:
        file_name = "zapping-audio.webm"

    try:
        payload = _request_gemini_transcription(
            audio_bytes=audio_bytes,
            gcs_uri=gcs_uri,
            content_type=content_type,
        )
    except https_fn.HttpsError:
        raise
    except Exception as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAVAILABLE,
            message=f"Gemini transcription request failed: {exc}",
        ) from exc

    segments = _clean_segments_fillers(_extract_segments(payload))
    text = "\n".join(segment["text"] for segment in segments) or _clean_filler_text(_extract_text(payload))
    srt = _segments_to_srt(segments)
    if not segments or not srt:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Gemini transcription did not return timestamped transcript segments",
        )
    return {
        "ok": True,
        "provider": "gemini-stt",
        "model": GEMINI_TRANSCRIPTION_MODEL,
        "text": text or "\n".join(segment["text"] for segment in segments),
        "segments": segments,
        "srt": srt,
        "timingStatus": "timestamped",
        "raw": payload,
    }
