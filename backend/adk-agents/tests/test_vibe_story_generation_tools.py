"""Tests for VibeControl story generation tools."""
from __future__ import annotations

from vibe_story_generation.tools import (
    build_story_generation_package,
    save_story_generation,
)


def test_build_story_generation_package_links_story_to_capability_and_evidence():
    package = build_story_generation_package(
        application={
            "application_id": "app-vc",
            "application_key": "VC",
            "application_name": "VibeControl",
            "file_space_id": "fs1",
        },
        capability={
            "id": "capability-vc-cap-001",
            "capabilityKey": "VC-CAP-001",
            "name": "Knowledge onboarding",
            "domain": "knowledge",
        },
        generation_session_id="gen-1",
        stories=[
            {
                "storyKey": "VC-ST-001",
                "title": "Connect knowledge space",
                "summary": "Admin connects a FileSpace before generating stories.",
                "userStory": "管理者として、FileSpaceを接続したい。",
                "acceptanceCriteria": [
                    {"text": "FileSpace ID is available", "state": "covered"}
                ],
                "confidenceScore": 80,
            }
        ],
        evidence=[
            {
                "storyKey": "VC-ST-001",
                "type": "screen",
                "title": "Application detail screen",
                "excerpt": "Knowledge Space panel is visible.",
                "sourceAssetId": "source-asset-screen-1",
                "citation": {
                    "title": "Screen Observation",
                    "snippet": "Knowledge Space panel",
                },
            }
        ],
    )

    story = package["stories"][0]
    evidence = package["evidence"][0]
    assert story["capabilityId"] == "capability-vc-cap-001"
    assert story["capabilityKey"] == "VC-CAP-001"
    assert story["evidenceIds"] == [evidence["id"]]
    assert evidence["type"] == "screen"
    assert package["draft_patches"][0]["targetType"] == "story"


def test_build_story_generation_package_preserves_story_capability_without_selected_scope():
    package = build_story_generation_package(
        application={
            "application_id": "app-vc",
            "application_key": "VC",
            "application_name": "VibeControl",
        },
        generation_session_id="gen-2",
        stories=[
            {
                "storyKey": "VC-ST-010",
                "title": "Review generated capability structure",
                "capabilityId": "capability-vc-cap-010",
                "capabilityKey": "VC-CAP-010",
                "capabilityName": "Story governance",
                "confidenceScore": 72,
            }
        ],
        evidence=[
            {
                "storyKey": "VC-ST-010",
                "type": "agent",
                "title": "Capability grouping rationale",
                "excerpt": "Story governance is a distinct capability.",
                "capabilityId": "capability-vc-cap-010",
                "capabilityKey": "VC-CAP-010",
            }
        ],
    )

    story = package["stories"][0]
    evidence = package["evidence"][0]
    assert package["capability"]["id"] == ""
    assert story["capabilityId"] == "capability-vc-cap-010"
    assert story["capabilityKey"] == "VC-CAP-010"
    assert evidence["capabilityId"] == "capability-vc-cap-010"


def test_save_story_generation_requires_evidence():
    result = save_story_generation(
        stories=[{"storyKey": "VC-ST-001", "title": "Demo"}],
        evidence=[],
    )
    assert result["ok"] is False
    assert "evidence" in result["error"]


def test_save_story_generation_returns_json_artifact():
    result = save_story_generation(
        stories=[
            {
                "storyKey": "VC-ST-001",
                "title": "Demo story",
                "summary": "Demo summary",
                "userStory": "As a user, I want a demo.",
            }
        ],
        evidence=[
            {
                "storyKey": "VC-ST-001",
                "type": "journey",
                "title": "Demo journey",
                "excerpt": "User completes a demo journey.",
                "citation": {"title": "Journey", "snippet": "demo journey"},
            }
        ],
    )
    assert result["ok"] is True
    assert result["vibe_story_generation"]["story_count"] == 1
    assert result["artifacts"][0]["kind"] == "json_document"
