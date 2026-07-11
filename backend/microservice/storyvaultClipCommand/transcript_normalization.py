"""Normalize StoryVault transcription artifacts into clip-local subtitle cues."""

from __future__ import annotations

import json
import re
from typing import Any


def _clean_text(value: Any) -> str:
    return " ".join(str(value or "").split())


def _timestamp_ms(value: Any) -> int | None:
    if isinstance(value, (int, float)):
        return max(0, round(float(value) * 1000))
    text = str(value or "").strip()
    if not text:
        return None
    if re.fullmatch(r"\d+(?:\.\d+)?", text):
        return max(0, round(float(text) * 1000))
    parts = text.split(":")
    if len(parts) not in (2, 3):
        return None
    try:
        seconds = float(parts[-1])
        minutes = int(parts[-2])
        hours = int(parts[-3]) if len(parts) == 3 else 0
    except ValueError:
        return None
    return max(0, round((hours * 3600 + minutes * 60 + seconds) * 1000))


def _cues_from_parts(parts: list[dict[str, Any]], duration_ms: int) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for index, part in enumerate(parts, start=1):
        start = max(0, int(part.get("startMs") or 0))
        following_start = int(parts[index].get("startMs") or duration_ms) if index < len(parts) else duration_ms
        end = int(part.get("endMs") or following_start or duration_ms)
        text = _clean_text(part.get("text"))
        if text:
            result.append({
                "id": f"cue-{index:04d}", "index": index, "text": text,
                "startMs": start, "endMs": max(start + 1, min(max(1, duration_ms), end)),
            })
    return result


def normalize_transcript(raw: str, duration_ms: int) -> dict[str, Any]:
    """Return display text plus absolute-time cues from plain text or JSON artifacts."""
    payload: Any = None
    if raw.lstrip().startswith(("{", "[")):
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            pass
    if not isinstance(payload, dict):
        clean = _clean_text(raw)
        return {"text": clean, "cues": _cues_from_parts([{"text": clean, "startMs": 0}], duration_ms)}

    llm_output = payload.get("llm_output") if isinstance(payload.get("llm_output"), dict) else {}
    raw_parts = llm_output.get("paragraphs") or payload.get("paragraphs") or payload.get("segments") or []
    parts: list[dict[str, Any]] = []
    if isinstance(raw_parts, list):
        for item in raw_parts:
            if not isinstance(item, dict):
                continue
            text = _clean_text(item.get("text") or item.get("transcript"))
            if text:
                parts.append({
                    "text": text,
                    "startMs": _timestamp_ms(item.get("startMs") or item.get("start") or item.get("offset")) or 0,
                    "endMs": _timestamp_ms(item.get("endMs") or item.get("end")),
                })
    transcript = _clean_text(payload.get("transcript") or payload.get("text"))
    if not parts and transcript:
        parts = [{"text": transcript, "startMs": 0}]
    cues = _cues_from_parts(parts, duration_ms)
    return {"text": transcript or " ".join(cue["text"] for cue in cues), "cues": cues}


def clip_local_transcript(normalized: dict[str, Any], section_start_ms: int, section_end_ms: int, clip_duration_ms: int) -> dict[str, Any]:
    """Filter absolute transcript cues to a section and rebase them to clip-local time."""
    start, end = max(0, section_start_ms), max(section_start_ms + 1, section_end_ms)
    local: list[dict[str, Any]] = []
    for cue in normalized.get("cues") or []:
        cue_start = int(cue.get("startMs") or 0)
        cue_end = int(cue.get("endMs") or cue_start + 1)
        if cue_end <= start or cue_start >= end:
            continue
        local.append({
            "text": _clean_text(cue.get("text")),
            "startMs": max(0, cue_start - start),
            "endMs": min(clip_duration_ms, max(1, cue_end - start)),
        })
    if not local:
        local = [{"text": _clean_text(normalized.get("text")) or "（発話なし）", "startMs": 0, "endMs": max(1, clip_duration_ms)}]
    for index, cue in enumerate(local, start=1):
        cue["id"], cue["index"] = f"cue-{index:04d}", index
        cue["endMs"] = max(cue["startMs"] + 1, cue["endMs"])
    return {"text": " ".join(cue["text"] for cue in local), "cues": local}
