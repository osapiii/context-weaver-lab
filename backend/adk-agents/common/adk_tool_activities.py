"""ADK tool activity list — 同一ツール名は最新実行のみ保持."""
from __future__ import annotations

from typing import Any


def _activity_tool_key(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


_KNOWLEDGE_SEARCH_KEYS = frozenset(
    {
        "vertex_ai_search",
        "vertexaisearchtool",
        "discovery_engine_search",
        "discoveryengine_search",
        "search_knowledge",
    }
)


def activity_tool_key(name: str) -> str:
    """UI 上同一扱いにするツール名キー（知識検索系は canonical に集約）."""
    key = _activity_tool_key(name)
    if key in _KNOWLEDGE_SEARCH_KEYS:
        return "vertex_ai_search"
    return key


def upsert_tool_activity(
    activities: list[Any],
    *,
    name: str,
    status: str,
) -> None:
    """同一ツール（activity_tool_key）の既存行を上書き。なければ追加."""
    raw_name = name.strip()
    if not raw_name:
        return
    key = activity_tool_key(raw_name)
    for item in activities:
        if not isinstance(item, dict):
            continue
        existing_name = item.get("name")
        if not isinstance(existing_name, str):
            continue
        if activity_tool_key(existing_name) != key:
            continue
        item["name"] = raw_name
        item["status"] = status
        return
    activities.append(
        {
            "id": f"{key}-{len(activities)}",
            "name": raw_name,
            "status": status,
        }
    )
