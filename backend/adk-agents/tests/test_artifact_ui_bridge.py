"""Tests for artifact UI bridge helpers."""
from __future__ import annotations

from common.artifact_ui_bridge import (
    message_artifact_ref_from_ref,
    message_artifact_ref_from_tool_ref,
)


def test_message_artifact_ref_from_ref():
    ref = message_artifact_ref_from_ref(
        session_id="sess-1",
        filename="gen.png",
        version=0,
        kind="image",
    )
    assert ref["kind"] == "image"
    assert ref["artifactId"]
    assert len(ref["artifactId"]) == 16
    assert ref["adkFilename"] == "gen.png"
    assert ref["artifactVersion"] == 0


def test_message_artifact_ref_from_tool_ref():
    ref = message_artifact_ref_from_tool_ref(
        session_id="sess-1",
        ref={
            "filename": "generated_image_1_43b95e13.png",
            "version": 0,
            "kind": "image",
            "mime_type": "image/png",
        },
    )
    assert ref is not None
    assert ref["adkFilename"] == "generated_image_1_43b95e13.png"
    assert ref["artifactVersion"] == 0
    assert ref["kind"] == "image"
