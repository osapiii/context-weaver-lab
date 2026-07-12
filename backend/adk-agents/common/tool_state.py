"""ADK ToolContext.state — State オブジェクトを plain dict として安全に読む (§16b)."""
from __future__ import annotations

from typing import Any


def state_to_plain_dict(state: Any) -> dict[str, Any]:
    """Firestore session.state または ADK State → plain dict."""
    if state is None:
        return {}
    if isinstance(state, dict):
        return state
    to_dict = getattr(state, "to_dict", None)
    if callable(to_dict):
        raw = to_dict()
        if isinstance(raw, dict):
            return raw
    try:
        return dict(state)
    except (TypeError, ValueError):
        return {}


def read_tool_state(tool_context: Any) -> dict[str, Any]:
    """FunctionTool 入口 — isinstance(state, dict) は使わない."""
    if tool_context is None:
        return {}
    return state_to_plain_dict(getattr(tool_context, "state", None))


def get_writable_state(tool_context: Any) -> Any:
    """session.state へ書き込むときは ADK State 本体を使う."""
    if tool_context is None:
        return None
    return getattr(tool_context, "state", None)
