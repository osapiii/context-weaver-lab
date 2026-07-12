"""Convert Discovery Engine search results → grounding_metadata shape."""
from __future__ import annotations

import re
from typing import Any

_URL_RE = re.compile(r"https?://[^\s)\]\"'<>]+")
_HEADING_RE = re.compile(r"^##\s+(.+)$", re.MULTILINE)


def _as_str(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


def _infer_from_content(content: str) -> tuple[str, str]:
    if not content:
        return "", ""
    uri = ""
    url_match = _URL_RE.search(content)
    if url_match:
        uri = url_match.group(0).rstrip(".,)")
    title = ""
    heading_match = _HEADING_RE.search(content)
    if heading_match:
        title = heading_match.group(1).strip()
    elif uri:
        try:
            from urllib.parse import urlparse

            title = urlparse(uri).hostname or ""
        except Exception:
            title = ""
    return title, uri


def build_grounding_from_search_results(
    *,
    query: str,
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    """ADK discovery_engine_search の title/url/content を grounding 形式に変換."""
    chunks: list[dict[str, Any]] = []
    seen: set[str] = set()

    for index, item in enumerate(results):
        if not isinstance(item, dict):
            continue
        text = _as_str(item.get("content")) or _as_str(item.get("text"))
        title = _as_str(item.get("title")) or _as_str(item.get("displayName"))
        uri = (
            _as_str(item.get("uri"))
            or _as_str(item.get("url"))
            or _as_str(item.get("link"))
        )
        if not title or not uri:
            inferred_title, inferred_uri = _infer_from_content(text)
            title = title or inferred_title or f"資料 {index + 1}"
            uri = uri or inferred_uri

        dedupe_key = uri or text[:160] or title
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        chunks.append(
            {
                "retrieved_context": {
                    "title": title,
                    "uri": uri or None,
                    "text": text or None,
                }
            }
        )

    payload: dict[str, Any] = {"grounding_chunks": chunks}
    if query.strip():
        payload["retrieval_queries"] = [query.strip()]
    return payload


def extract_grounding_from_tool_response(
    response: dict[str, Any] | None,
    *,
    query: str = "",
) -> dict[str, Any] | None:
    if not response or not isinstance(response, dict):
        return None
    if response.get("status") not in (None, "success"):
        return None

    results = response.get("results")
    if not isinstance(results, list) or not results:
        return None

    resolved_query = _as_str(response.get("query")) or query
    return build_grounding_from_search_results(
        query=resolved_query,
        results=[r for r in results if isinstance(r, dict)],
    )
