"""Firebase ID Token 検証 + BYOK Gemini API キー / global prompt 注入.

Frontend は `Authorization: Bearer <Firebase ID token>` で ADK を叩く.
検証後、Firestore secrets から BYOK キーと global system prompt を read する.
"""
from __future__ import annotations

import logging
import os
from typing import Any

import firebase_admin
from fastapi import Header, HTTPException
from firebase_admin import auth as fb_auth

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

_ALLOW_UNAUTH = os.environ.get("ALLOW_UNAUTH", "0") in ("1", "true", "True")


def _ensure_initialized() -> None:
    if not firebase_admin._apps:  # noqa: SLF001
        firebase_admin.initialize_app()
        logger.info("firebase_admin initialized")


def require_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """FastAPI dependency. token を verify し BYOK api_key を request scope にセット."""
    if _ALLOW_UNAUTH:
        dev_key = resolve_request_gemini_api_key("local-dev")
        dev_openai = resolve_request_openai_api_key("local-dev")
        if dev_key:
            activate_byok(dev_key)
        return {
            "uid": "local-dev",
            "email": "dev@localhost",
            "auth_disabled": True,
            "has_gemini_api_key": bool(dev_key),
            "gemini_api_key": dev_key,
            "has_openai_api_key": bool(dev_openai),
            "openai_api_key": dev_openai,
        }

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401, detail="Authorization: Bearer <id_token> required"
        )
    token = authorization.split(" ", 1)[1].strip()
    _ensure_initialized()
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception as exc:  # pragma: no cover
        logger.warning("ID token verify failed: %s", exc)
        raise HTTPException(status_code=401, detail="invalid id token") from exc

    uid = decoded["uid"]
    api_key = resolve_request_gemini_api_key(uid)
    if not api_key:
        logger.warning("BYOK missing for uid=%s", uid)
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY_NOT_REGISTERED",
        )

    global_system_prompt = load_user_global_system_prompt(uid)
    pinned_knowledge = load_user_pinned_knowledge(uid)
    openai_api_key = resolve_request_openai_api_key(uid)
    activate_byok(api_key)
    logger.info("BYOK loaded for uid=%s suffix=...%s", uid, api_key[-4:])
    return {
        "uid": uid,
        "email": decoded.get("email"),
        "claims": decoded,
        "has_gemini_api_key": True,
        "gemini_api_key": api_key,
        "has_openai_api_key": bool(openai_api_key),
        "openai_api_key": openai_api_key,
        "global_system_prompt": global_system_prompt,
        "pinned_knowledge": pinned_knowledge,
    }
