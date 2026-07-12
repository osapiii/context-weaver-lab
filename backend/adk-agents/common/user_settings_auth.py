"""Firestore からユーザー AI 設定 (グローバル system prompt 等) を読み出す."""
from __future__ import annotations

import logging

import firebase_admin
from firebase_admin import firestore as fb_firestore

from .byok_auth import _ensure_firebase_initialized

logger = logging.getLogger(__name__)

GLOBAL_SYSTEM_PROMPT_DOC_ID = "globalSystemPrompt"
PINNED_KNOWLEDGE_DOC_ID = "pinnedKnowledge"


def load_user_global_system_prompt(uid: str) -> str | None:
    """`users/{uid}/secrets/globalSystemPrompt` から prompt を取得."""
    if not uid or not uid.strip():
        return None
    _ensure_firebase_initialized()
    snap = (
        fb_firestore.client()
        .collection("users")
        .document(uid.strip())
        .collection("secrets")
        .document(GLOBAL_SYSTEM_PROMPT_DOC_ID)
        .get()
    )
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    prompt = data.get("prompt")
    if not isinstance(prompt, str):
        return None
    trimmed = prompt.strip()
    return trimmed or None


def load_user_pinned_knowledge(uid: str) -> list[dict[str, str]]:
    """`users/{uid}/secrets/pinnedKnowledge` からピン留め資料一覧を取得."""
    if not uid or not uid.strip():
        return []
    _ensure_firebase_initialized()
    snap = (
        fb_firestore.client()
        .collection("users")
        .document(uid.strip())
        .collection("secrets")
        .document(PINNED_KNOWLEDGE_DOC_ID)
        .get()
    )
    if not snap.exists:
        return []
    data = snap.to_dict() or {}
    items = data.get("items")
    if not isinstance(items, list):
        return []
    result: list[dict[str, str]] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        doc_id = raw.get("id")
        name = raw.get("name")
        gcs_path = raw.get("gcs_path")
        if not (
            isinstance(doc_id, str)
            and isinstance(name, str)
            and isinstance(gcs_path, str)
            and gcs_path.strip().startswith("gs://")
        ):
            continue
        mime = raw.get("mime_type")
        result.append(
            {
                "id": doc_id.strip(),
                "name": name.strip(),
                "gcs_path": gcs_path.strip(),
                "mime_type": mime.strip() if isinstance(mime, str) else "",
            }
        )
    return result

