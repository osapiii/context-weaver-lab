"""Tests for discovery search → grounding conversion."""
from __future__ import annotations

from common.discovery_to_grounding import (
    build_grounding_from_search_results,
    extract_grounding_from_tool_response,
)


def test_build_grounding_infers_url_from_content():
    grounding = build_grounding_from_search_results(
        query="シーライフ 商品",
        results=[
            {
                "title": "",
                "url": "",
                "content": "## 株式会社シーライフ\nhttps://sealife-hamada.net/product/",
            }
        ],
    )
    chunks = grounding["grounding_chunks"]
    assert len(chunks) == 1
    rc = chunks[0]["retrieved_context"]
    assert rc["title"] == "株式会社シーライフ"
    assert rc["uri"] == "https://sealife-hamada.net/product/"


def test_build_grounding_deduplicates_similar_hits():
    duplicate = {
        "title": "",
        "url": "",
        "content": "https://ec-sealife.net/ same footer",
    }
    grounding = build_grounding_from_search_results(
        query="q",
        results=[duplicate, duplicate, duplicate],
    )
    assert len(grounding["grounding_chunks"]) == 1


def test_extract_grounding_from_tool_response():
    payload = extract_grounding_from_tool_response(
        {
            "status": "success",
            "query": "シーライフ",
            "results": [{"title": "", "url": "", "content": "のどぐろ"}],
        }
    )
    assert payload is not None
    assert payload["grounding_chunks"][0]["retrieved_context"]["text"] == "のどぐろ"
