"""Firebase ID token または internal invoke シークレットで ADK invoke を認可する."""
from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import Header, HTTPException

from .auth import require_user_optional_gemini
from .byok_auth import (
    resolve_request_gemini_api_key,
    resolve_request_openai_api_key,
)
from .byok_scope import activate_byok
from .user_settings_auth import (
    load_user_global_system_prompt,
    load_user_pinned_knowledge,
)

logger = logging.getLogger(__name__)


def _internal_secret() -> str:
    return (os.environ.get("ADK_INTERNAL_INVOKE_SECRET") or "").strip()


def require_user_or_internal_invoke(
    authorization: str | None = Header(default=None),
    x_en_aistudio_internal_invoke: str | None = Header(
        default=None, alias="X-En-AIStudio-Internal-Invoke"
    ),
    x_en_aistudio_requested_uid: str | None = Header(
        default=None, alias="X-En-AIStudio-Requested-Uid"
    ),
) -> dict[str, Any]:
    """Browser Bearer token または Firebase Functions からの internal invoke."""
    secret = _internal_secret()
    if (
        secret
        and x_en_aistudio_internal_invoke
        and x_en_aistudio_internal_invoke.strip() == secret
    ):
        uid = (x_en_aistudio_requested_uid or "").strip()
        if not uid:
            raise HTTPException(
                status_code=400,
                detail="X-En-AIStudio-Requested-Uid required for internal invoke",
            )
        api_key = resolve_request_gemini_api_key(uid)
        openai_api_key = resolve_request_openai_api_key(uid)
        if api_key:
            activate_byok(api_key)
        return {
            "uid": uid,
            "email": None,
            "auth_disabled": True,
            "internal_invoke": True,
            "has_gemini_api_key": bool(api_key),
            "gemini_api_key": api_key,
            "has_openai_api_key": bool(openai_api_key),
            "openai_api_key": openai_api_key,
            "global_system_prompt": load_user_global_system_prompt(uid),
            "pinned_knowledge": load_user_pinned_knowledge(uid),
        }

    return require_user_optional_gemini(authorization)
