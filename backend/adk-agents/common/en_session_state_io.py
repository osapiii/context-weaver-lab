"""Golden envelope read helpers — transcript / session_meta / active_task のみ."""
from __future__ import annotations

from typing import Any

from .en_session_state import empty_invoke_state, is_record
from .task_invoke_state import read_task_invoke


def read_transcript(state: dict[str, Any] | None) -> list[Any]:
    if not is_record(state):
        return []
    transcript = state.get("transcript")
    if isinstance(transcript, list):
        return list(transcript)
    return []


def read_session_meta(state: dict[str, Any] | None) -> dict[str, Any]:
    if not is_record(state):
        return {"title": "", "status": "active"}
    meta = state.get("session_meta")
    if is_record(meta):
        title = meta.get("title")
        status = meta.get("status")
        return {
            "title": title.strip() if isinstance(title, str) else "",
            "status": status if status in ("active", "archived", "deleted") else "active",
        }
    return {"title": "", "status": "active"}


def read_active_task(state: dict[str, Any] | None) -> str | None:
    if not is_record(state):
        return None
    active = state.get("active_task")
    if isinstance(active, str) and active.strip():
        return active.strip()
    return None


def read_grounding_by_response_id(state: dict[str, Any] | None) -> dict[str, Any]:
    if not is_record(state):
        return {}
    top = state.get("grounding_by_response_id")
    if is_record(top):
        return dict(top)
    return {}


def read_active_task_invoke(state: dict[str, Any] | None) -> dict[str, Any]:
    task = read_active_task(state)
    if not task or not is_record(state):
        return empty_invoke_state()
    bucket = state.get(task)
    if not is_record(bucket):
        return empty_invoke_state()
    return read_task_invoke(bucket)
