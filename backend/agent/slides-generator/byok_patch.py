"""BYOK (Bring Your Own Key) パッチ: google.genai.Client を contextvar 連動に差替.

EN AIstudio 用カスタマイズ: ユーザーが EN AIstudio 設定画面で登録した Gemini API キーを、
リクエストスコープで現在のスレッド/タスクに紐付け、ADK 内部の Gemini Client
初期化時に自動で挿入する.

仕組み:
    1. server.py の auth middleware が `users/{uid}/secrets/geminiApiKey` を read
    2. `current_user_api_key.set(api_key)` で contextvar に格納
    3. ADK の Runner が下位で `google.genai.Client()` を呼ぶ瞬間に
       本パッチ済み Client が contextvar を見て api_key を inject
    4. 既存の `api_key=` 引数 / `vertexai=True` 指定があれば優先 (パッチは noop)

contextvars は asyncio task と thread の両方に伝搬するので、ADK の SSE
ストリーミング (asyncio) でも問題なく動く.

呼び出し:
    `from byok_patch import install, current_user_api_key`
    `install()`  # process 起動時に 1 回
"""
from __future__ import annotations

import contextvars
import logging

logger = logging.getLogger(__name__)

current_user_api_key: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "en_aistudio_slides_agent.gemini_api_key", default=None
)

_installed = False


def install() -> None:
    """google.genai.Client を contextvar 連動版に差替える (idempotent)."""
    global _installed
    if _installed:
        return

    try:
        import google.genai as _genai
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            "google-genai が import できません。Cloud Run image に google-genai>=1.72 を入れてください."
        ) from e

    _Original = _genai.Client

    class _ByokClient(_Original):  # type: ignore[misc, valid-type]
        """contextvar に api_key があれば自動 inject する Client."""

        def __init__(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            if (
                "api_key" not in kwargs
                and not kwargs.get("vertexai", False)
            ):
                key = current_user_api_key.get()
                if key:
                    kwargs["api_key"] = key
            super().__init__(*args, **kwargs)

    _genai.Client = _ByokClient  # type: ignore[assignment]
    _installed = True
    logger.info("BYOK patch installed: google.genai.Client wrapped with contextvar")
