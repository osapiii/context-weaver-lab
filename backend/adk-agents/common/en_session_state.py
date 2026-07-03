"""ADK session.state golden envelope types (v1)."""
from __future__ import annotations

from typing import Any, Literal, TypedDict

EnActiveTask = Literal[
    "image",
    "writing",
    "consultation",
    "research",
    "business_partner",
    "storyvault",
    "guide",
    "sheet",
]

TaskInvokeStatus = Literal["idle", "pending", "running", "completed", "error"]


class TaskInvokeLogEntry(TypedDict, total=False):
    ts: int
    message: str
    type: Literal["info", "error"]


class TaskInvokeState(TypedDict, total=False):
    status: TaskInvokeStatus
    request_id: str
    linked_response_id: str
    logs: list[TaskInvokeLogEntry]
    error_message: str


class SessionMeta(TypedDict, total=False):
    title: str
    status: Literal["active", "archived", "deleted"]


def empty_invoke_state() -> TaskInvokeState:
    return {"status": "idle", "logs": []}


ENVELOPE_KEYS = frozenset(
    {
        "active_task",
        "session_meta",
        "transcript",
        "context_assets",
        "turn_context_assets",
        "grounding_by_response_id",
    }
)

TASK_BUCKET_KEYS = frozenset(
    {
        "image",
        "writing",
        "consultation",
        "research",
        "business_partner",
        "storyvault",
        "guide",
        "sheet",
    }
)


def is_record(value: Any) -> bool:
    return isinstance(value, dict)
