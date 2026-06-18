"""リクエストスコープでユーザー global system prompt を ADK instruction に渡す."""
from __future__ import annotations

import contextvars

current_user_global_prompt: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_user_global_prompt",
    default=None,
)


def activate_global_prompt(prompt: str | None) -> contextvars.Token[str | None] | None:
    if not prompt or not prompt.strip():
        return None
    return current_user_global_prompt.set(prompt.strip())


def deactivate_global_prompt(
    token: contextvars.Token[str | None] | None,
) -> None:
    if token is None:
        return
    current_user_global_prompt.reset(token)


def resolve_global_prompt(
    *,
    firestore_prompt: str | None,
    request_override: str | None = None,
) -> str | None:
    """Firestore 値を基本とし、明示 override があればそちらを優先."""
    if isinstance(request_override, str) and request_override.strip():
        return request_override.strip()
    return firestore_prompt
