"""Per-task invoke bootstrap / finalize — `state.<task>.invoke` SSOT."""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from .session_state import persist_session_state_patch
from .task_invoke_state import append_invoke_log, set_invoke_status
from .workspace_state_buckets import patch_task_bucket

TaskInvokeHandler = Callable[..., dict[str, Any] | None]

INVOKE_TASKS = frozenset(
    {
        "image",
        "writing",
        "consultation",
        "research",
        "data_analysis",
        "web_page",
        "business_partner",
        "vibe_control",
        "vibe_capability_structuring",
        "vibe_story_generation",
        "guide",
        "sheet",
    }
)


def _noop_validate(**_kwargs: Any) -> None:
    return None


def _noop_merge(**kwargs: Any) -> dict[str, Any]:
    return dict(kwargs.get("request_mode_state") or {})


TASK_INVOKE_HANDLERS: dict[str, dict[str, Any]] = {
    "image": {"merge": _noop_merge, "validate": _noop_validate},
    "writing": {"merge": _noop_merge, "validate": _noop_validate},
    "consultation": {"merge": _noop_merge, "validate": _noop_validate},
    "research": {"merge": _noop_merge, "validate": _noop_validate},
    "data_analysis": {"merge": _noop_merge, "validate": _noop_validate},
    "web_page": {"merge": _noop_merge, "validate": _noop_validate},
    "business_partner": {"merge": _noop_merge, "validate": _noop_validate},
    "vibe_control": {"merge": _noop_merge, "validate": _noop_validate},
    "vibe_capability_structuring": {"merge": _noop_merge, "validate": _noop_validate},
    "vibe_story_generation": {"merge": _noop_merge, "validate": _noop_validate},
    "guide": {"merge": _noop_merge, "validate": _noop_validate},
    "sheet": {"merge": _noop_merge, "validate": _noop_validate},
}


def register_task_invoke_handler(
    *,
    task: str,
    merge: TaskInvokeHandler | None = None,
    validate: TaskInvokeHandler | None = None,
) -> None:
    entry = TASK_INVOKE_HANDLERS.setdefault(task, {})
    if merge is not None:
        entry["merge"] = merge
    if validate is not None:
        entry["validate"] = validate


async def bootstrap_task_invoke(
    *,
    session_service: Any,
    app_name: str,
    user_id: str,
    session_id: str,
    organization_id: str,
    space_id: str,
    task: str,
    request_id: str | None = None,
    linked_response_id: str | None = None,
    message: str = "invoke started",
) -> None:
    if task not in INVOKE_TASKS:
        return
    state_patch: dict[str, Any] = {}
    bucket: dict[str, Any] = {}
    set_invoke_status(
        bucket=bucket,
        status="running",
        request_id=request_id,
        linked_response_id=linked_response_id,
    )
    append_invoke_log(bucket=bucket, message=message)
    patch_task_bucket(state_patch, task, {"invoke": bucket["invoke"]})
    await persist_session_state_patch(
        session_service,
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
        state_patch=state_patch,
        organization_id=organization_id,
        space_id=space_id,
    )


async def finalize_task_invoke(
    *,
    session_service: Any,
    app_name: str,
    user_id: str,
    session_id: str,
    organization_id: str,
    space_id: str,
    task: str,
    status: str = "completed",
    error_message: str | None = None,
    message: str | None = None,
) -> None:
    if task not in INVOKE_TASKS:
        return
    terminal = "error" if status == "error" else "completed"
    state_patch: dict[str, Any] = {}
    bucket: dict[str, Any] = {}
    set_invoke_status(
        bucket=bucket,
        status=terminal,
        error_message=error_message,
    )
    if message:
        append_invoke_log(
            bucket=bucket,
            message=message,
            log_type="error" if terminal == "error" else "info",
        )
    patch_task_bucket(state_patch, task, {"invoke": bucket["invoke"]})
    await persist_session_state_patch(
        session_service,
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
        state_patch=state_patch,
        organization_id=organization_id,
        space_id=space_id,
    )


async def append_task_invoke_log(
    *,
    session_service: Any,
    app_name: str,
    user_id: str,
    session_id: str,
    organization_id: str,
    space_id: str,
    task: str,
    message: str,
    log_type: str = "info",
) -> None:
    if task not in INVOKE_TASKS:
        return
    state_patch: dict[str, Any] = {}
    bucket: dict[str, Any] = {}
    append_invoke_log(bucket=bucket, message=message, log_type=log_type)
    patch_task_bucket(state_patch, task, {"invoke": bucket["invoke"]})
    await persist_session_state_patch(
        session_service,
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
        state_patch=state_patch,
        organization_id=organization_id,
        space_id=space_id,
    )
