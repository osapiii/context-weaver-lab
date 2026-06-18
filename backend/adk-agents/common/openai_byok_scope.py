"""リクエストスコープで BYOK OpenAI API キーを画像生成ツールに渡す."""
from __future__ import annotations

import contextvars
import logging
from typing import Any

logger = logging.getLogger(__name__)

current_user_openai_api_key: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "en_aistudio_adk_agent.openai_api_key", default=None
)


def activate_openai_byok(api_key: str | None) -> contextvars.Token[str | None] | None:
    if not api_key:
        return None
    token = current_user_openai_api_key.set(api_key)
    logger.info("OpenAI BYOK loaded suffix=...%s", api_key[-4:])
    return token


def deactivate_openai_byok(token: contextvars.Token[str | None] | None) -> None:
    if token is None:
        return
    current_user_openai_api_key.reset(token)


def resolve_openai_api_key() -> str | None:
    key = current_user_openai_api_key.get()
    return key if isinstance(key, str) and key.strip() else None


def openai_api_key_from_user(user: dict[str, Any]) -> str | None:
    key = user.get("openai_api_key")
    return key if isinstance(key, str) and key.strip() else None
