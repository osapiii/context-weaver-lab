"""Tests for SSE artifact ref building without GCS bucket."""
from __future__ import annotations

import pytest

from common.server_base import _en_message_artifact_ref


@pytest.mark.asyncio
async def test_en_message_artifact_ref_from_tool_ref_without_bucket():
    ref = await _en_message_artifact_ref(
        event_name="artifact_ref",
        payload={
            "filename": "generated_image_1_abc.png",
            "version": 0,
            "kind": "image",
        },
        artifact_service=None,
        bucket_name="",
        app_name="en-aistudio-adk-agent",
        user_id="user-1",
        session_id="sess-1",
    )
    assert ref is not None
    assert ref["kind"] == "image"
    assert ref["adkFilename"] == "generated_image_1_abc.png"
