"""Application scan invoke state contract."""
from __future__ import annotations

from typing import Any

from .workspace_state_buckets import patch_task_bucket, task_bucket_from_mode_state


def application_scan_state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build the canonical session state patch for application_scan."""
    bucket = task_bucket_from_mode_state(mode_state, "application_scan")
    if not bucket:
        return {}
    patch: dict[str, Any] = {}
    patch_task_bucket(
        patch,
        "application_scan",
        bucket,
        active_task="application_scan",
    )
    return patch
