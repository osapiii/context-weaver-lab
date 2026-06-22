"""VibeControl separated ADK invoke state contracts."""
from __future__ import annotations

from typing import Any

from .workspace_state_buckets import patch_task_bucket, task_bucket_from_mode_state


def _state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
    task: str,
) -> dict[str, Any]:
    bucket = task_bucket_from_mode_state(mode_state, task)
    if not bucket:
        return {}
    patch: dict[str, Any] = {}
    patch_task_bucket(patch, task, bucket, active_task=task)
    return patch


def vibe_capability_structuring_state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build canonical session state patch for capability structuring."""
    return _state_patch_from_mode_state(mode_state, "vibe_capability_structuring")


def vibe_story_generation_state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build canonical session state patch for story generation."""
    return _state_patch_from_mode_state(mode_state, "vibe_story_generation")
