"""LLM model selection — RequestDoc input.model / invoke body と共通の解決ロジック."""
from __future__ import annotations

import os
import re

# app/types/models/llmModelSelection.ts と同期
_SELECTION_TO_API: dict[str, str] = {
    "2.5-flash-lite": "gemini-2.5-flash-lite",
    "2.5-flash": "gemini-2.5-flash",
    "3": "gemini-3-pro-preview",
    "3-flash": "gemini-3-flash-preview",
    "3.1-flash-lite": "gemini-3.1-flash-lite",
    "3.5-flash": "gemini-3.5-flash",
}

_GEMINI_API_RE = re.compile(r"^gemini-[a-z0-9][a-z0-9._-]*$", re.IGNORECASE)


def normalize_model_override(value: str | None) -> str | None:
    """選択キー (`2.5-flash-lite`) または API 名 (`gemini-2.5-flash`) を正規化."""
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if _GEMINI_API_RE.match(raw):
        return raw
    mapped = _SELECTION_TO_API.get(raw)
    if mapped:
        return mapped
    return None


def default_model_api_name_for_mode(mode: str) -> str:
    if mode in {"consultation", "data_analysis"}:
        return (
            normalize_model_override("3.1-flash-lite") or "gemini-3.1-flash-lite"
        )
    return os.environ.get("MODEL_ID", "gemini-2.5-flash").strip() or "gemini-2.5-flash"


def resolve_model_for_invoke(mode: str, request_model: str | None = None) -> str:
    """RequestDoc command `input.model` / invoke `model` → 実際の Gemini model id."""
    override = normalize_model_override(request_model)
    if override:
        return override
    return default_model_api_name_for_mode(mode)
