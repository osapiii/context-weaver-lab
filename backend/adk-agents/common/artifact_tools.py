"""共通 Artifact 出力 tools — SSE artifact event として UI に配信される."""
from __future__ import annotations

from typing import Any


def add_markdown_document(title: str, body: str) -> dict[str, Any]:
    """Markdown 形式の成果物を 1 件 UI に追加する.

    Args:
        title: ドキュメントタイトル (例: "粗利分析レポート").
        body: Markdown 本文 (そのまま右ペイン / コピー用).

    Returns:
        artifacts キーに markdown_document 1 件を含む dict.
    """
    return {
        "ok": True,
        "artifacts": [
            {
                "kind": "markdown_document",
                "title": title,
                "body": body,
            }
        ],
    }


def add_html_document(title: str, body: str) -> dict[str, Any]:
    """HTML 形式の成果物を 1 件 UI に追加する.

    Args:
        title: ドキュメントタイトル (例: "経営分析 HTML レポート").
        body: 完全な HTML ドキュメント (<!DOCTYPE html> から).

    Returns:
        artifacts キーに html_document 1 件を含む dict.
    """
    return {
        "ok": True,
        "artifacts": [
            {
                "kind": "html_document",
                "title": title,
                "body": body,
            }
        ],
    }
