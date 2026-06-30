"""Read-only tools for VibeControl Zapping Analysis Agent."""
from __future__ import annotations

from typing import Any

from common.tool_state import read_tool_state  # type: ignore


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
    return _as_dict(state.get("vibe_zapping_analysis"))


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
    clip_frames: list[dict[str, Any]] = []
    for clip in clips:
        clip_frames.extend(
            _compact_frames(clip.get("frameCaptures"), clip_id=_clean_text(clip.get("id")))
        )
    return {
        "has_video_file": any(_clean_text(clip.get("storagePath")) for clip in clips),
        "transcriptText": transcript_text,
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
