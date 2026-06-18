"""adk_tool_activities — upsert by tool key."""
from __future__ import annotations

from common.adk_tool_activities import activity_tool_key, upsert_tool_activity


def test_activity_tool_key_normalizes_knowledge_search():
    assert activity_tool_key("discovery_engine_search") == "vertex_ai_search"
    assert activity_tool_key("VertexAiSearchTool") == "vertex_ai_search"


def test_upsert_tool_activity_replaces_same_tool():
    activities: list[dict[str, str]] = []
    upsert_tool_activity(activities, name="discovery_engine_search", status="running")
    upsert_tool_activity(activities, name="discovery_engine_search", status="completed")
    assert len(activities) == 1
    assert activities[0]["status"] == "completed"


def test_upsert_tool_activity_keeps_different_tools():
    activities: list[dict[str, str]] = []
    upsert_tool_activity(activities, name="add_citation", status="running")
    upsert_tool_activity(activities, name="generate_image", status="running")
    assert len(activities) == 2
