"""リクエストスコープで BYOK Gemini API キーを ADK に渡す."""
from __future__ import annotations

import contextvars
import logging
import os
from typing import Any

from .byok_patch import current_user_api_key

logger = logging.getLogger(__name__)


def activate_byok(api_key: str | None) -> contextvars.Token[str | None] | None:
    """contextvar + GEMINI_API_KEY env をリクエスト用にセット."""
    if not api_key:
        return None
    token = current_user_api_key.set(api_key)
    os.environ["GEMINI_API_KEY"] = api_key
    return token


def suspend_byok() -> tuple[contextvars.Token[str | None], str | None, str | None]:
    """Temporarily clear request/user Gemini API keys so ADC/Vertex is used."""
    previous_gemini_env = os.environ.get("GEMINI_API_KEY")
    previous_google_env = os.environ.get("GOOGLE_API_KEY")
    token = current_user_api_key.set(None)
    os.environ.pop("GEMINI_API_KEY", None)
    os.environ.pop("GOOGLE_API_KEY", None)
    return token, previous_gemini_env, previous_google_env


def resume_byok(
    token: contextvars.Token[str | None],
    *,
    previous_gemini_env: str | None,
    previous_google_env: str | None,
) -> None:
    current_user_api_key.reset(token)
    if previous_gemini_env is None:
        os.environ.pop("GEMINI_API_KEY", None)
    else:
        os.environ["GEMINI_API_KEY"] = previous_gemini_env
    if previous_google_env is None:
        os.environ.pop("GOOGLE_API_KEY", None)
    else:
        os.environ["GOOGLE_API_KEY"] = previous_google_env


def deactivate_byok(
    token: contextvars.Token[str | None] | None,
    *,
    previous_env: str | None,
) -> None:
    """activate_byok の後始末."""
    if token is None:
        return
    current_user_api_key.reset(token)
    if previous_env is None:
        os.environ.pop("GEMINI_API_KEY", None)
    else:
        os.environ["GEMINI_API_KEY"] = previous_env


def gemini_api_key_from_user(user: dict[str, Any]) -> str | None:
    key = user.get("gemini_api_key")
    return key if isinstance(key, str) and key.strip() else None
