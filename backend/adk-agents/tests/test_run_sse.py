"""Tests for oneStop SSE chunk encoding."""
from __future__ import annotations

from types import SimpleNamespace

from common.run_sse import event_to_sse_chunk


def test_event_to_sse_chunk_text_delta():
    part = SimpleNamespace(text="hello", function_call=None, function_response=None)
    content = SimpleNamespace(parts=[part])
    event = SimpleNamespace(
        author="model",
        timestamp=1.0,
        content=content,
        actions=None,
        is_final_response=lambda: False,
    )
    chunk = event_to_sse_chunk(event, artifacts=[])
    assert chunk["deltaText"] == "hello"
    assert chunk["type"] == "event"
