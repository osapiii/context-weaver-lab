"""Tests for grounding metadata merge."""
from __future__ import annotations

from common.grounding_merge import merge_grounding_metadata


def test_merge_grounding_metadata_deduplicates_chunks():
    merged = merge_grounding_metadata(
        {
            "grounding_chunks": [
                {
                    "retrieved_context": {
                        "title": "A",
                        "uri": "https://example.com/a",
                        "text": "part 1",
                    }
                }
            ],
            "retrieval_queries": ["query-a"],
        },
        {
            "grounding_chunks": [
                {
                    "retrieved_context": {
                        "title": "A",
                        "uri": "https://example.com/a",
                        "text": "part 2",
                    }
                },
                {
                    "web": {"uri": "https://example.com/b", "title": "B"},
                },
            ],
            "retrieval_queries": ["query-b"],
        },
    )
    assert len(merged["grounding_chunks"]) == 2
    assert merged["retrieval_queries"] == ["query-a", "query-b"]
