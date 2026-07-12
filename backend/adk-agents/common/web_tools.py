"""公開 Web ページの fetch — consultation 等の FunctionTool 用."""
from __future__ import annotations

import html
import ipaddress
import logging
import re
from typing import Any
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

_FETCH_TIMEOUT = 25
_DEFAULT_MAX_CHARS = 8000
_USER_AGENT = (
    "Mozilla/5.0 (compatible; EN-AIStudio-ADK-WebFetch/1.0; "
    "+https://github.com/enostech/en-aistudio)"
)

_PRIVATE_NETWORKS = (
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
)


def _is_blocked_host(host: str) -> bool:
    lowered = (host or "").strip().lower()
    if not lowered or lowered == "localhost":
        return True
    if lowered.endswith(".internal") or lowered.endswith(".local"):
        return True
    if lowered in {"metadata.google.internal", "metadata.google"}:
        return True
    try:
        addr = ipaddress.ip_address(lowered)
    except ValueError:
        return False
    return any(addr in net for net in _PRIVATE_NETWORKS)


def _validate_public_http_url(url: str) -> str | None:
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in {"http", "https"}:
        return None
    if not parsed.netloc or _is_blocked_host(parsed.hostname or ""):
        return None
    return parsed.geturl()


def _html_to_text(raw: str) -> str:
    cleaned = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", raw)
    cleaned = re.sub(r"(?is)<(br|p|div|li|tr|h[1-6])[^>]*>", "\n", cleaned)
    cleaned = re.sub(r"(?s)<[^>]+>", " ", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = re.sub(r"[ \t\f\v]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _extract_title(raw: str) -> str:
    match = re.search(r"(?is)<title[^>]*>(.*?)</title>", raw)
    if not match:
        return ""
    return html.unescape(re.sub(r"\s+", " ", match.group(1))).strip()


def fetch_web_page(url: str, max_chars: int = _DEFAULT_MAX_CHARS) -> dict[str, Any]:
    """公開 Web ページを取得し、本文テキストを返す.

    企業公式 HP・ニュース記事・公開資料など、URL が分かっている情報源の
    内容確認に使う. 社内 FileSpace には無い外部情報の裏取り用.

    Args:
        url: http / https の公開 URL.
        max_chars: 返却する本文の最大文字数 (既定 8000).

    Returns:
        ok, url, title, text, truncated 等を含む dict.
    """
    safe_url = _validate_public_http_url(url)
    if not safe_url:
        return {
            "ok": False,
            "error": "http / https の公開 URL のみ取得できます",
            "artifacts": [],
        }

    limit = max(500, min(int(max_chars or _DEFAULT_MAX_CHARS), 20000))

    try:
        resp = requests.get(
            safe_url,
            timeout=_FETCH_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
            allow_redirects=True,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("fetch_web_page failed: url=%s err=%s", safe_url, exc)
        return {
            "ok": False,
            "error": f"ページ取得に失敗しました: {exc}",
            "url": safe_url,
            "artifacts": [],
        }

    content_type = (resp.headers.get("Content-Type") or "").lower()
    if "html" not in content_type and "text/plain" not in content_type:
        return {
            "ok": False,
            "error": (
                f"HTML / テキスト以外は未対応です (Content-Type: {content_type or 'unknown'})"
            ),
            "url": safe_url,
            "artifacts": [],
        }

    raw = resp.text
    title = _extract_title(raw) if "html" in content_type else ""
    text = _html_to_text(raw) if "html" in content_type else raw.strip()
    truncated = len(text) > limit
    if truncated:
        text = text[:limit] + f"\n\n... (以降 {len(text) - limit} 文字省略)"

    return {
        "ok": True,
        "url": safe_url,
        "title": title,
        "text": text,
        "truncated": truncated,
        "content_type": content_type,
        "artifacts": [],
    }
