"""Tests for StoryVault capability structuring tools."""
from __future__ import annotations

from storyvault_capability_structuring.tools import (
    build_capability_structure_package,
    save_capability_structure,
)


def test_build_capability_structure_package_normalizes_capabilities_and_patches():
    package = build_capability_structure_package(
        application={
            "application_id": "app-vc",
            "application_key": "VC",
            "application_name": "StoryVault",
            "repo_full_name": "enostech/storyvault",
        },
        generation_session_id="gen-1",
        capabilities=[
            {
                "name": "Knowledge onboarding",
                "summary": "User can connect product knowledge sources.",
                "domain": "knowledge",
                "evidenceIds": ["source-asset-1"],
                "confidenceScore": 82,
                "reviewState": "ready",
            }
        ],
        generation_trace=["Grouped source assets by user goal"],
    )

    capability = package["capabilities"][0]
    patch = package["draft_patches"][0]
    assert package["application"]["id"] == "app-vc"
    assert capability["applicationKey"] == "VC"
    assert capability["capabilityKey"] == "VC-CAP-001"
    assert capability["reviewState"] == "ready"
    assert patch["operation"] == "create"
    assert patch["after"]["id"] == capability["id"]


def test_save_capability_structure_requires_capabilities():
    result = save_capability_structure(capabilities=[])
    assert result["ok"] is False
    assert "capabilities" in result["error"]


def test_save_capability_structure_returns_json_artifact():
    result = save_capability_structure(
        capabilities=[
            {
                "capabilityKey": "VC-CAP-010",
                "name": "Application scan review",
                "summary": "Review scan evidence before story generation.",
            }
        ]
    )
    assert result["ok"] is True
    assert result["storyvault_capability_structuring"]["capability_count"] == 1
    assert result["artifacts"][0]["kind"] == "json_document"
