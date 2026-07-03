"""Read-only tools for StoryVault Zapping Analysis Agent."""
from __future__ import annotations

import re
from typing import Any

from common.tool_state import read_tool_state  # type: ignore

SRT_TIME_RE = re.compile(
    r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*"
    r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})"
)


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _clean_text(value: Any, fallback: str = "") -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _task_bucket(tool_context: Any) -> dict[str, Any]:
    state = read_tool_state(tool_context)
    return _as_dict(state.get("storyvault_zapping_analysis"))


def _setup_from_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(bucket.get("setup"))


def _payload_from_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(bucket.get("payload"))


def _first_text(*values: Any) -> str | None:
    for value in values:
        cleaned = _clean_text(value)
        if cleaned:
            return cleaned
    return None


def _metadata_from_assets(source_assets: list[Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for asset in source_assets:
        if not isinstance(asset, dict):
            continue
        metadata = _as_dict(asset.get("metadata"))
        for key in (
            "transcriptText",
            "transcriptSegments",
            "transcriptSrt",
            "transcriptTimingStatus",
            "transcriptProvider",
            "transcriptSummary",
            "quickScan",
            "frameCaptures",
        ):
            if key not in merged and metadata.get(key) is not None:
                merged[key] = metadata.get(key)
    return merged


def _compact_frames(value: Any, *, clip_id: str = "") -> list[dict[str, Any]]:
    frames: list[dict[str, Any]] = []
    for raw in _as_list(value)[:60]:
        if not isinstance(raw, dict):
            continue
        frame_id = raw.get("id")
        frame = {
            "id": f"{clip_id}:{frame_id}" if clip_id and frame_id else frame_id,
            "clipId": clip_id or None,
            "timestampMs": raw.get("timestampMs"),
            "fileName": raw.get("fileName"),
            "storagePath": raw.get("storagePath"),
        }
        frames.append({k: v for k, v in frame.items() if v is not None})
    return frames


def _compact_transcript_segments(value: Any, *, clip_id: str = "") -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    for raw in _as_list(value)[:240]:
        if not isinstance(raw, dict):
            continue
        text = _clean_text(raw.get("text"))
        if not text:
            continue
        cue_id = _clean_text(raw.get("id"), f"cue-{len(segments) + 1:04d}")
        segment = {
            "id": f"{clip_id}:{cue_id}" if clip_id else cue_id,
            "clipId": clip_id or None,
            "index": raw.get("index"),
            "startMs": raw.get("startMs"),
            "endMs": raw.get("endMs"),
            "text": text,
            "confidence": raw.get("confidence"),
        }
        segments.append({k: v for k, v in segment.items() if v is not None})
    return segments


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


def _segments_from_srt(srt: Any) -> list[dict[str, Any]]:
    text = _clean_text(srt)
    if not text:
        return []
    segments: list[dict[str, Any]] = []
    for block in re.split(r"\n\s*\n", text):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        time_line_index = next(
            (index for index, line in enumerate(lines) if SRT_TIME_RE.search(line)),
            -1,
        )
        if time_line_index < 0:
            continue
        match = SRT_TIME_RE.search(lines[time_line_index])
        if not match:
            continue
        segment_text = " ".join(lines[time_line_index + 1 :]).strip()
        if not segment_text:
            continue
        segments.append(
            {
                "id": f"cue-{len(segments) + 1:04d}",
                "index": len(segments) + 1,
                "startMs": _parse_srt_part(match.group(1), match.group(2), match.group(3), match.group(4)),
                "endMs": _parse_srt_part(match.group(5), match.group(6), match.group(7), match.group(8)),
                "text": segment_text,
            }
        )
    return segments


def _operation_video_clips(operation_video: dict[str, Any]) -> list[dict[str, Any]]:
    clips = [clip for clip in _as_list(operation_video.get("clips")) if isinstance(clip, dict)]
    if clips:
        return clips
    return [
        {
            "id": "clip-001",
            "fileName": operation_video.get("fileName"),
            "bucketName": operation_video.get("bucketName"),
            "storagePath": operation_video.get("storagePath"),
            "contentType": operation_video.get("contentType"),
            "sizeBytes": operation_video.get("sizeBytes"),
            "durationMs": operation_video.get("durationMs"),
            "transcriptText": operation_video.get("transcriptText"),
            "transcriptSegments": operation_video.get("transcriptSegments"),
            "transcriptSrt": operation_video.get("transcriptSrt"),
            "transcriptTimingStatus": operation_video.get("transcriptTimingStatus"),
            "transcriptProvider": operation_video.get("transcriptProvider"),
            "transcriptSummary": operation_video.get("transcriptSummary"),
            "quickScan": operation_video.get("quickScan"),
            "frameCaptures": operation_video.get("frameCaptures"),
            "recordedAt": operation_video.get("recordedAt"),
        }
    ]


def _analysis_evidence(
    *,
    operation_video: dict[str, Any],
    source_assets: list[Any],
) -> dict[str, Any]:
    metadata = _metadata_from_assets(source_assets)
    clips = _operation_video_clips(operation_video)
    quick_scan = _as_dict(operation_video.get("quickScan") or metadata.get("quickScan"))
    transcript_text = _first_text(
        operation_video.get("transcriptText"),
        metadata.get("transcriptText"),
    )
    if not transcript_text:
        transcript_text = "\n\n".join(
            _clean_text(clip.get("transcriptText")) for clip in clips if _clean_text(clip.get("transcriptText"))
        ) or None
    transcript_summary = _first_text(
        operation_video.get("transcriptSummary"),
        metadata.get("transcriptSummary"),
        quick_scan.get("transcriptSummary"),
    )
    if not transcript_summary:
        transcript_summary = "\n".join(
            f"{_clean_text(clip.get('id'), 'clip')}: {_clean_text(clip.get('transcriptSummary'))}"
            for clip in clips
            if _clean_text(clip.get("transcriptSummary"))
        ) or None
    frame_captures = operation_video.get("frameCaptures") or metadata.get(
        "frameCaptures"
    )
    transcript_segments = _compact_transcript_segments(
        operation_video.get("transcriptSegments") or metadata.get("transcriptSegments")
    )
    if not transcript_segments:
        transcript_segments = _compact_transcript_segments(
            _segments_from_srt(operation_video.get("transcriptSrt") or metadata.get("transcriptSrt"))
        )
    clip_frames: list[dict[str, Any]] = []
    clip_segments: list[dict[str, Any]] = []
    clip_srts: list[dict[str, Any]] = []
    for clip in clips:
        clip_id = _clean_text(clip.get("id"))
        clip_frames.extend(_compact_frames(clip.get("frameCaptures"), clip_id=clip_id))
        compact_clip_segments = _compact_transcript_segments(
            clip.get("transcriptSegments"),
            clip_id=clip_id,
        )
        transcript_srt = _clean_text(clip.get("transcriptSrt"))
        if transcript_srt:
            clip_srts.append({"clipId": clip_id, "srt": transcript_srt})
            if not compact_clip_segments:
                compact_clip_segments = _compact_transcript_segments(
                    _segments_from_srt(transcript_srt),
                    clip_id=clip_id,
                )
        clip_segments.extend(compact_clip_segments)
    effective_segments = clip_segments or transcript_segments
    return {
        "has_video_file": any(_clean_text(clip.get("storagePath")) for clip in clips),
        "transcriptText": transcript_text,
        "transcriptSegments": effective_segments,
        "transcriptSrt": _first_text(operation_video.get("transcriptSrt"), metadata.get("transcriptSrt")),
        "transcriptSrts": clip_srts,
        "transcriptTimingStatus": _first_text(
            operation_video.get("transcriptTimingStatus"),
            metadata.get("transcriptTimingStatus"),
        )
        or ("timestamped" if effective_segments else "unavailable"),
        "transcriptSummary": transcript_summary,
        "transcriptProvider": _first_text(
            operation_video.get("transcriptProvider"),
            metadata.get("transcriptProvider"),
        ),
        "quickScan": quick_scan,
        "frameCaptures": clip_frames or _compact_frames(frame_captures),
        "clips": [
            {
                "id": clip.get("id"),
                "fileName": clip.get("fileName"),
                "durationMs": clip.get("durationMs"),
                "recordedAt": clip.get("recordedAt"),
                "hasTranscript": bool(_clean_text(clip.get("transcriptText")) or _clean_text(clip.get("transcriptSummary"))),
                "hasTimestampedTranscript": bool(
                    _as_list(clip.get("transcriptSegments")) or _segments_from_srt(clip.get("transcriptSrt"))
                ),
                "frameCount": len(_as_list(clip.get("frameCaptures"))),
            }
            for clip in clips
        ],
    }


def read_zapping_analysis_context(tool_context: Any = None) -> dict[str, Any]:
    """Read zapping video analysis context from session state."""
    bucket = _task_bucket(tool_context)
    setup = _setup_from_bucket(bucket)
    payload = _payload_from_bucket(bucket)
    operation_video = _as_dict(payload.get("operation_video"))
    source_assets = _as_list(payload.get("source_assets"))
    return {
        "ok": True,
        "phase": bucket.get("phase") or "zapping_analysis",
        "application": {
            "id": _clean_text(setup.get("application_id"), "app-default"),
            "applicationKey": _clean_text(setup.get("application_key"), "APP"),
            "name": _clean_text(setup.get("application_name"), "Application"),
            "fileSpaceId": _clean_text(setup.get("file_space_id")) or None,
            "repoFullName": _clean_text(setup.get("repo_full_name")) or None,
            "defaultBranch": _clean_text(setup.get("default_branch"), "main"),
        },
        "analysis_session_id": _clean_text(setup.get("analysis_session_id")),
        "operation_video": operation_video,
        "analysis_evidence": _analysis_evidence(
            operation_video=operation_video,
            source_assets=source_assets,
        ),
        "source_assets": source_assets,
        "existing_capabilities": _as_list(payload.get("existing_capabilities")),
        "existing_stories": _as_list(payload.get("existing_stories")),
        "existing_evidence": _as_list(payload.get("existing_evidence")),
        "expected_outputs": _as_list(payload.get("expected_outputs")),
        "user_notes": _clean_text(payload.get("user_notes")) or None,
        "vertex_ai_search": _as_dict(_as_dict(bucket.get("tools")).get("vertex_ai_search")),
    }
