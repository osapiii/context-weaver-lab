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


def _repair_flat_timestamps(parts: list[dict[str, Any]], duration_ms: int) -> list[dict[str, Any]]:
    """Spread paragraphs across the recording when STT returned one flat timestamp."""
    if len(parts) < 2:
        return parts
    starts = [max(0, int(part.get("startMs") or 0)) for part in parts]
    if any(starts[index] > starts[index - 1] for index in range(1, len(starts))):
        return parts
    weights = [max(1, len(_clean_text(part.get("text")))) for part in parts]
    total_weight = sum(weights)
    cursor = 0
    repaired: list[dict[str, Any]] = []
    for index, (part, weight) in enumerate(zip(parts, weights)):
        start = cursor
        cursor = duration_ms if index == len(parts) - 1 else round(duration_ms * sum(weights[: index + 1]) / total_weight)
        repaired.append({**part, "startMs": start, "endMs": max(start + 1, cursor)})
    return repaired


def _split_cues_into_sentences(cues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    expanded: list[dict[str, Any]] = []
    for cue in cues:
        sentences = [item.strip() for item in re.split(r"(?<=[。！？!?])\s*", _clean_text(cue.get("text"))) if item.strip()]
        if len(sentences) < 2:
            expanded.append(cue)
            continue
        start = int(cue.get("startMs") or 0)
        end = max(start + 1, int(cue.get("endMs") or start + 1))
        weights = [max(1, len(sentence)) for sentence in sentences]
        total_weight = sum(weights)
        cursor = start
        for index, (sentence, weight) in enumerate(zip(sentences, weights)):
            sentence_start = cursor
            cursor = end if index == len(sentences) - 1 else start + round((end - start) * sum(weights[: index + 1]) / total_weight)
            expanded.append({"text": sentence, "startMs": sentence_start, "endMs": max(sentence_start + 1, cursor)})
    for index, cue in enumerate(expanded, start=1):
        cue["id"], cue["index"] = f"cue-{index:04d}", index
    return expanded


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
    cues = _split_cues_into_sentences(_cues_from_parts(_repair_flat_timestamps(parts, duration_ms), duration_ms))
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


def bullet_summary(text: str, cues: list[dict[str, Any]], limit: int = 5) -> str:
    """Build a compact extractive video summary instead of copying the transcript."""
    source = " ".join(_clean_text(cue.get("text")) for cue in cues if _clean_text(cue.get("text"))) or _clean_text(text)
    sentences = [item.strip() for item in re.split(r"(?<=[。！？!?])\s*", source) if item.strip()]
    unique: list[str] = []
    for sentence in sentences:
        compact = sentence[:180].rstrip()
        if compact and compact not in unique:
            unique.append(compact)
    if not unique:
        return ""
    if len(unique) > limit:
        indexes = [round(index * (len(unique) - 1) / (limit - 1)) for index in range(limit)] if limit > 1 else [0]
        unique = [unique[index] for index in indexes]
    return "\n".join(f"- {sentence}" for sentence in unique)
