"""Invoke 中の writing_action を instruction 切替用に保持."""
from __future__ import annotations

import contextvars

WritingAction = str | None

current_writing_action: contextvars.ContextVar[WritingAction] = contextvars.ContextVar(
    "current_writing_action",
    default=None,
)


def activate_writing_action(action: WritingAction) -> contextvars.Token[WritingAction] | None:
    if not action or not str(action).strip():
        return None
    return current_writing_action.set(str(action).strip())


def deactivate_writing_action(
    token: contextvars.Token[WritingAction] | None,
) -> None:
    if token is None:
        return
    current_writing_action.reset(token)
