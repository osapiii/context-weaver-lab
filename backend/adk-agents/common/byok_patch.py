"""BYOK patch — google.genai.Client にリクエストスコープの api_key を注入."""
from __future__ import annotations

import contextvars
import logging
import os

logger = logging.getLogger(__name__)

current_user_api_key: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "en_aistudio_adk_agent.gemini_api_key", default=None
)

_installed = False


def _resolve_api_key() -> str | None:
    """contextvar → GEMINI_API_KEY env の順で解決 (ADK SSE タスク跨ぎ対策)."""
    key = current_user_api_key.get()
    if key:
        return key
    env_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if env_key and env_key.strip():
        return env_key.strip()
    return None


def install() -> None:
    """google.genai.Client を contextvar 連動版に差替える (idempotent)."""
    global _installed
    if _installed:
        return

    try:
        import google.genai as _genai
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            "google-genai が import できません。requirements.txt を確認してください."
        ) from e

    _Original = _genai.Client

    class _ByokClient(_Original):  # type: ignore[misc, valid-type]
        def __init__(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            if "api_key" not in kwargs and not kwargs.get("vertexai", False):
                key = _resolve_api_key()
                if key:
                    kwargs["api_key"] = key
            super().__init__(*args, **kwargs)

    _genai.Client = _ByokClient  # type: ignore[assignment]
    _installed = True
    logger.info("ADK BYOK patch installed")
