"""操作ガイド (guide) invoke — mode_state / session.state 契約."""
from __future__ import annotations

from typing import Any

from .workspace_state_buckets import patch_task_bucket, task_bucket_from_mode_state


def merge_guide_invoke_mode_state(
    *,
    session_state: dict[str, Any],
    request_mode_state: dict[str, Any],
) -> dict[str, Any]:
    merged = dict(request_mode_state or {})
    stored = task_bucket_from_mode_state(session_state, "guide")
    if stored:
        nested = merged.get("guide")
        if isinstance(nested, dict):
            combined = {**stored, **nested}
        else:
            combined = dict(stored)
        merged["guide"] = combined
    return merged


def guide_state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    bucket = task_bucket_from_mode_state(mode_state, "guide")
    if not bucket:
        return {}
    return {"guide": dict(bucket)}


def patch_guide_bucket(
    state_patch: dict[str, Any],
    mode_state: dict[str, Any] | None,
) -> None:
    bucket = task_bucket_from_mode_state(mode_state, "guide")
    if not bucket:
        return
    golden: dict[str, Any] = {
        "phase": bucket.get("phase") or "chat",
        "setup": bucket.get("setup")
        if isinstance(bucket.get("setup"), dict)
        else {"confirmed": True},
        "payload": bucket.get("payload")
        if isinstance(bucket.get("payload"), dict)
        else {},
    }
    route = bucket.get("route_path") or bucket.get("routePath")
    if isinstance(route, str) and route.strip():
        setup = dict(golden["setup"])
        setup["route_path"] = route.strip()
        golden["setup"] = setup
    patch_task_bucket(state_patch, "guide", golden)
