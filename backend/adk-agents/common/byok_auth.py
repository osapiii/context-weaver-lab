"""Firestore からユーザー BYOK Gemini API キーを読み出す."""
from __future__ import annotations

import logging
import os

import firebase_admin
from firebase_admin import firestore as fb_firestore

logger = logging.getLogger(__name__)

GEMINI_BYOK_DOC_ID = "geminiApiKey"
OPENAI_BYOK_DOC_ID = "openaiApiKey"


def _ensure_firebase_initialized() -> None:
    if not firebase_admin._apps:  # noqa: SLF001
        firebase_admin.initialize_app()


def load_user_gemini_api_key(uid: str) -> str | None:
    """`users/{uid}/secrets/geminiApiKey` から apiKey を取得."""
    _ensure_firebase_initialized()
    snap = (
        fb_firestore.client()
        .collection("users")
        .document(uid)
        .collection("secrets")
        .document(GEMINI_BYOK_DOC_ID)
        .get()
    )
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    api_key = data.get("apiKey")
    if not isinstance(api_key, str):
        return None
    trimmed = api_key.strip()
    return trimmed or None


def resolve_request_gemini_api_key(uid: str | None) -> str | None:
    """リクエストで使う Gemini API キーを解決 (BYOK 優先)."""
    if uid:
        key = load_user_gemini_api_key(uid)
        if key:
            return key
    # ローカル開発 (ALLOW_UNAUTH) 用フォールバック
    env_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if env_key and env_key.strip():
        logger.info("using GEMINI_API_KEY from environment (dev fallback)")
        return env_key.strip()
    return None


def load_user_openai_api_key(uid: str) -> str | None:
    """`users/{uid}/secrets/openaiApiKey` から apiKey を取得."""
    if not uid or not uid.strip():
        return None
    _ensure_firebase_initialized()
    snap = (
        fb_firestore.client()
        .collection("users")
        .document(uid.strip())
        .collection("secrets")
        .document(OPENAI_BYOK_DOC_ID)
        .get()
    )
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    api_key = data.get("apiKey")
    if not isinstance(api_key, str):
        return None
    trimmed = api_key.strip()
    return trimmed or None


def resolve_request_openai_api_key(uid: str | None) -> str | None:
    """画像生成で使う OpenAI API キーを解決 (BYOK 優先)."""
    if uid:
        key = load_user_openai_api_key(uid)
        if key:
            return key
    env_key = os.environ.get("OPENAI_API_KEY")
    if env_key and env_key.strip():
        logger.info("using OPENAI_API_KEY from environment (dev fallback)")
        return env_key.strip()
    return None
