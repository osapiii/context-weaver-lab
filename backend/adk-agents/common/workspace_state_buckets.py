"""Session state — golden タスク別バケット (state.<task>) のみ."""
from __future__ import annotations

from typing import Any

TASK_KEYS = (
    "image",
    "writing",
    "sheet",
    "consultation",
    "research",
    "data_analysis",
    "web_page",
    "business_partner",
    "vibe_control",
    "vibe_capability_structuring",
    "vibe_story_generation",
    "guide",
)


def _is_dict(value: Any) -> bool:
    return isinstance(value, dict)


def read_task_bucket(
    container: dict[str, Any] | None, task: str
) -> dict[str, Any]:
    """`container[task]` golden バケットのみ（フラット / en_ui / mode_state なし）."""
    if not _is_dict(container):
        return {}
    nested = container.get(task)
    return dict(nested) if _is_dict(nested) else {}


def task_bucket_from_mode_state(
    mode_state: dict[str, Any] | None, task: str
) -> dict[str, Any]:
    """invoke `mode_state[task]` golden バケット."""
    return read_task_bucket(mode_state, task)


def task_bucket_from_session_state(
    session_state: dict[str, Any] | None, task: str
) -> dict[str, Any]:
    """ADK / Firestore `session.state[task]` golden バケット."""
    return read_task_bucket(session_state, task)


def merge_task_buckets(
    *,
    session_state: dict[str, Any] | None,
    mode_state: dict[str, Any] | None,
    task: str,
) -> dict[str, Any]:
    """session をベースに invoke request バケットで上書き."""
    bucket = task_bucket_from_session_state(session_state, task)
    request = task_bucket_from_mode_state(mode_state, task)
    if not request:
        return bucket
    return {**bucket, **request}


def effective_image_mode_state(
    *,
    mode_state: dict[str, Any] | None = None,
    session_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """画像ツール用 — golden `state.image` を flat tool ビューに正規化."""
    from .golden_task_bucket_io import image_golden_to_effective_flat

    bucket = merge_task_buckets(
        session_state=session_state,
        mode_state=mode_state,
        task="image",
    )
    out = image_golden_to_effective_flat(bucket)
    if _is_dict(mode_state) and isinstance(mode_state.get("active_mode"), str):
        out["active_mode"] = mode_state["active_mode"]
    return out


def effective_writing_state(tool_context_state: dict[str, Any]) -> dict[str, Any]:
    """writing ツール — golden `state.writing` を flat tool ビューに正規化."""
    from .golden_task_bucket_io import writing_golden_to_effective_flat

    bucket = task_bucket_from_session_state(tool_context_state, "writing")
    return writing_golden_to_effective_flat(bucket)


def effective_research_state(
    *,
    mode_state: dict[str, Any] | None = None,
    session_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """research ツール / invoke — golden `state.research` を flat ビューに正規化."""
    from .golden_task_bucket_io import research_golden_to_effective_flat

    bucket = merge_task_buckets(
        session_state=session_state,
        mode_state=mode_state,
        task="research",
    )
    return research_golden_to_effective_flat(bucket)


def patch_task_bucket(
    state_patch: dict[str, Any],
    task: str,
    bucket_patch: dict[str, Any],
    *,
    active_task: str | None = None,
) -> None:
    """state.<task> に golden 形状でマージ."""
    if not bucket_patch:
        return
    from .golden_task_bucket_io import (
        merge_golden_task_bucket,
        normalize_task_patch_to_golden,
    )

    golden_patch = normalize_task_patch_to_golden(task, bucket_patch)
    existing = state_patch.get(task)
    state_patch[task] = merge_golden_task_bucket(
        existing=existing if _is_dict(existing) else None,
        patch=golden_patch,
    )
    if active_task:
        state_patch["active_task"] = active_task
