"""Invoke 時の effective workspace mode 解決."""
from __future__ import annotations

from typing import Any


def normalize_workspace_mode(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    if normalized in {
        "writing",
        "sheet",
        "image",
        "consultation",
        "research",
        "data_analysis",
        "web_page",
        "application_scan",
        "business_partner",
        "vibe_control",
    }:
        return normalized
    return None


def resolve_invoke_agent_mode(
    *,
    url_mode: str,
    mode_state: dict[str, Any] | None,
    session_state: dict[str, Any] | None,
) -> str:
    """今ターンの FE 意図 (mode_state) を最優先し、次に URL path、最後に session の sticky mode."""
    session_mode = normalize_workspace_mode((session_state or {}).get("mode"))
    body_mode = normalize_workspace_mode((mode_state or {}).get("active_mode"))
    path_mode = normalize_workspace_mode(url_mode)
    if body_mode:
        return body_mode
    if path_mode:
        return path_mode
    if session_mode:
        return session_mode
    return "consultation"
