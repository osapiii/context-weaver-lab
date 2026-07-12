"""Tests for ADK artifact catalog."""
from __future__ import annotations

from common.adk_artifact_catalog import (
    adk_blob_path,
    artifact_id,
    message_artifact_ref,
    parse_adk_storage_object_name,
)


def test_adk_blob_path():
    path = adk_blob_path(
        app_name="en-aistudio-adk-agent",
        user_id="user-1",
        session_id="sess-1",
        filename="deck__research.json",
        version=0,
    )
    assert path == "en-aistudio-adk-agent/user-1/sess-1/deck__research.json/0"


def test_parse_storage_object():
    parsed = parse_adk_storage_object_name(
        "en-aistudio-adk-agent/uid-1/sess-9/generated_image_ab.png/2",
        allowed_app_names=frozenset({"en-aistudio-adk-agent"}),
    )
    assert parsed is not None
    assert parsed.session_id == "sess-9"
    assert parsed.filename == "generated_image_ab.png"
    assert parsed.version == 2


def test_parse_skips_canonical_prefix():
    parsed = parse_adk_storage_object_name(
        "organizations/org/spaces/sp/adkSessions/sess/a.png/0",
        allowed_app_names=frozenset({"en-aistudio-adk-agent"}),
    )
    assert parsed is None


def test_artifact_id_deterministic():
    a = artifact_id(session_id="s1", filename="f.png", version=1)
    b = artifact_id(session_id="s1", filename="f.png", version=1)
    assert a == b
    assert len(a) == 16


def test_message_artifact_ref():
    ref = message_artifact_ref(artifact_id="abc", kind="image")
    assert ref == {"artifactId": "abc", "kind": "image"}
