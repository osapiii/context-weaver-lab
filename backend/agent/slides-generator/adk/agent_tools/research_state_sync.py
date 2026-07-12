"""Research session.state — golden `state.research` とルート flat キーの同期."""
from __future__ import annotations

from typing import Any

_RESEARCH_STATE_KEYS = frozenset(
    {
        "current_phase",
        "theme",
        "intent",
        "target_slides",
        "deck_structure",
        "auto_mode",
        "briefing_theme",
        "briefing_audience",
        "briefing_use_case",
        "deck_id",
        "deck_dir",
        "research_path",
        "research_html_path",
        "progress",
        "progress_history",
        "job_log",
        "phase_status",
        "plan_draft",
        "workflow_phase",
        "notification_email",
        "plan_only",
    }
)


def _golden_helpers():
    try:
        from common.golden_task_bucket_io import (  # type: ignore
            merge_research_into_session_state,
            research_golden_to_effective_flat,
        )

        return merge_research_into_session_state, research_golden_to_effective_flat
    except ImportError:
        return None, None


def is_research_state_key(key: str) -> bool:
    return key in _RESEARCH_STATE_KEYS


def read_research_state_key(
    state: dict[str, Any], key: str, default: Any = None
) -> Any:
    merge_fn, golden_to_flat = _golden_helpers()
    if golden_to_flat is not None:
        bucket = state.get("research")
        if isinstance(bucket, dict):
            flat = golden_to_flat(bucket)
            if key in flat and flat[key] is not None:
                return flat[key]
    value = state.get(key)
    return value if value is not None else default


def write_research_state_key(state: dict[str, Any], key: str, value: Any) -> None:
    if value is None:
        return
    state[key] = value
    merge_fn, _ = _golden_helpers()
    if merge_fn is not None:
        merge_fn(state, {key: value})


def sync_research_progress_bucket(state: dict[str, Any]) -> None:
    merge_fn, _ = _golden_helpers()
    if merge_fn is None:
        return
    merge_fn(
        state,
        {
            "current_phase": state.get("current_phase"),
            "progress": state.get("progress"),
            "progress_history": state.get("progress_history"),
            "job_log": state.get("job_log"),
            "phase_status": state.get("phase_status"),
        },
    )
