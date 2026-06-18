"""consultation agent 専用 tools — citation 出力."""
from __future__ import annotations

from typing import Any


def add_citation(
    title: str,
    snippet: str,
    uri: str | None = None,
) -> dict[str, Any]:
    """grounding citation を 1 件 UI に追加する.

    consultation Agent が search_knowledge で取得した出典のうち、応答に実際に
    寄与したものだけを `add_citation` で 1 件ずつ追加する.

    Args:
        title: 出典のタイトル (例: "2025年度上期 経営会議議事録")
        snippet: 関連する 1-3 行の引用.
        uri: 元資料の URL (null 可).

    Returns:
        artifacts キーに citation 1 件を含む dict.
    """
    return {
        "ok": True,
        "artifacts": [
            {
                "kind": "citation",
                "title": title,
                "snippet": snippet,
                "uri": uri,
            }
        ],
    }
