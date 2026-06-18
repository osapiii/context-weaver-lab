"""ユーザー添付ファイルを LLM が読める形 (gtypes.Part) に変換する.

設計方針: **素の Gemini multimodal に任せる**.
gemini-2.5-flash は image / pdf / audio / video / text を全て inline_data で
直接受け取って処理できる.

Firestore session では ``inline_data`` を LLM には渡しつつ、
``FirestoreSessionService`` が events 永続化時にバイナリだけ除去する
(画像スタジオと同じ「イベントに載せない」方針).

サポート分岐:
  - text/* / application/json / application/xml
      → そのまま text Part で文脈に混ぜる
  - image/* / application/pdf / audio/* / video/*
      → inline_data Part. Gemini が中身を読む
  - その他
      → URL を text Part で示すだけ (Gemini が解釈不能なため AI に
        ユーザー確認させる)

Firebase Storage の getDownloadURL は token 付き public URL なので、
Cloud Run 側で追加の認証なしに requests.get() で取得できる.
失敗時はその attachment だけ skip して残りを処理する.
"""
from __future__ import annotations

import logging
from typing import Any

import requests
from google.genai import types as gtypes

from .gcs_io import fetch_gcs_bytes

logger = logging.getLogger(__name__)

# Gemini inline_data の実用上限 (公式は 20MB 程度). FE で 25MB まで許可している
# ので、ここを超えるものは text-only fallback にする.
_INLINE_MAX_BYTES = 20 * 1024 * 1024
# 文字数上限: 1 attachment あたり LLM context を喰い過ぎないよう制限.
_MAX_TEXT_CHARS = 8000
_FETCH_TIMEOUT = 30

# Gemini multimodal が直接受け取れる種別 (prefix 一致 / 完全一致).
_INLINE_PREFIXES = ("image/", "audio/", "video/")
_INLINE_EXACT = {"application/pdf"}


def _fetch_bytes(url: str) -> bytes | None:
    try:
        resp = requests.get(url, timeout=_FETCH_TIMEOUT)
        resp.raise_for_status()
        return resp.content
    except Exception as exc:
        logger.warning("attachment fetch failed: url=%s err=%s", url, exc)
        return None


def _truncate(text: str) -> str:
    if len(text) <= _MAX_TEXT_CHARS:
        return text
    return text[:_MAX_TEXT_CHARS] + f"\n\n... (以降 {len(text) - _MAX_TEXT_CHARS} 文字省略)"


def _is_inline_supported(mime: str) -> bool:
    return any(mime.startswith(p) for p in _INLINE_PREFIXES) or mime in _INLINE_EXACT


def _is_text_supported(mime: str) -> bool:
    return mime.startswith("text/") or mime in {
        "application/json",
        "application/xml",
    }


def prepare_attachment_parts(
    attachments: list[Any],
) -> list[gtypes.Part]:
    """attachments を gemini multimodal Part 列に変換する.

    Args:
        attachments: AttachmentRef のリスト (request_schema.AttachmentRef).
            Pydantic モデルでも dict でも動くよう attribute / key 両対応で読む.

    Returns:
        gtypes.Part のリスト. 失敗 attachment は skip.
    """
    parts: list[gtypes.Part] = []
    if not attachments:
        return parts

    parts.append(
        gtypes.Part(
            text=(
                f"## 参考資料 (ユーザー添付, {len(attachments)} 件)\n"
                "以下は本セッションのヒアリングでユーザーが添付した資料です. "
                "必要に応じて踏まえて回答してください.\n"
            )
        )
    )

    for a in attachments:
        name = _attr(a, "name") or "(無題)"
        gcs_path = (
            _attr(a, "gcs_path")
            or _attr(a, "gcsPath")
            or ""
        ).strip()
        url = _attr(a, "url") or ""
        mime = (_attr(a, "mime_type") or _attr(a, "mimeType") or "").lower()
        source_label = gcs_path or url
        if not source_label:
            continue

        def _load_bytes() -> bytes | None:
            if gcs_path:
                return fetch_gcs_bytes(gcs_path)
            return _fetch_bytes(url)

        # Gemini が直接読める binary (PDF / image / audio / video)
        if _is_inline_supported(mime):
            data = _load_bytes()
            if not data:
                parts.append(_failed_part(name, source_label, "fetch 失敗"))
                continue
            if len(data) > _INLINE_MAX_BYTES:
                parts.append(
                    _failed_part(
                        name,
                        url,
                        f"サイズ超過 ({len(data) // 1024 // 1024}MB > {_INLINE_MAX_BYTES // 1024 // 1024}MB)",
                    )
                )
                continue
            parts.append(
                gtypes.Part(
                    text=f"### [{mime}] {name}\n以下に inline 添付します:\n"
                )
            )
            parts.append(
                gtypes.Part(inline_data=gtypes.Blob(mime_type=mime, data=data))
            )
            continue

        # プレーンテキスト系 (txt / md / csv / json / xml)
        if _is_text_supported(mime):
            data = _load_bytes()
            if not data:
                parts.append(_failed_part(name, source_label, "fetch 失敗"))
                continue
            try:
                text = data.decode("utf-8", errors="replace")
            except Exception:
                text = ""
            if text:
                parts.append(
                    gtypes.Part(
                        text=f"### [{mime or 'text'}] {name}\n{_truncate(text)}\n"
                    )
                )
            else:
                parts.append(_failed_part(name, url, "デコード失敗"))
            continue

        # その他: Gemini が直接扱えない. URL を示して AI に聞き返させる.
        parts.append(
            gtypes.Part(
                text=(
                    f"### [{mime or '?'}] {name}\n"
                    f"このファイル形式は LLM が直接扱えません. URL: {url}\n"
                    "中身が必要なら, ユーザーに「要点を 1-2 文で教えてください」と聞いてください.\n"
                )
            )
        )

    return parts


def _attr(obj: Any, key: str) -> str | None:
    """Pydantic model / dict 両対応のフィールド読み出し."""
    if obj is None:
        return None
    if hasattr(obj, key):
        v = getattr(obj, key)
        return v if isinstance(v, str) else None
    if isinstance(obj, dict):
        v = obj.get(key)
        return v if isinstance(v, str) else None
    return None


def _failed_part(name: str, url: str, reason: str) -> gtypes.Part:
    return gtypes.Part(
        text=(
            f"### {name} (取得失敗)\n"
            f"理由: {reason}. URL: {url}\n"
            "ユーザーに資料の要点を直接聞いてください.\n"
        )
    )
