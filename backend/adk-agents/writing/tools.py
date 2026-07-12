"""writing agent 専用 tools.

- `add_text_block(title, body)`: コピーしやすい単位の文章ブロックを 1 件返す.
  LLM が複数 (件名 + 本文 / A 案 + B 案 など) を生成する時、各単位を 1 回ずつ呼ぶ.
  返り値の `artifacts` フィールドが server_base.py で SSE artifact event として配信される.
"""
from __future__ import annotations

from typing import Any


def add_text_block(title: str | None, body: str) -> dict[str, Any]:
    """1 つのコピー単位の文章ブロックを UI に追加する.

    Args:
        title: ブロックのタイトル (例: "件名" / "本文" / "A 案"). 不要なら null.
        body: コピー対象の本文. プレーンテキストまたは Markdown.

    Returns:
        artifacts キーに UI 描画用の text_block 1 件を含む dict.
    """
    return {
        "ok": True,
        "artifacts": [
            {
                "kind": "text_block",
                "title": title,
                "body": body,
            }
        ],
    }
