"""Tests for VibeControl SSOT package tools."""
from __future__ import annotations

from vibe_control.tools import build_story_ssot_package, save_user_story_ssot


def test_build_story_ssot_package_marks_low_evidence_as_needs_review():
    package = build_story_ssot_package(
        applications=[
            {
                "id": "app-commerce",
                "applicationKey": "SHOP",
                "name": "Commerce App",
            }
        ],
        stories=[
            {
                "applicationId": "app-commerce",
                "applicationKey": "SHOP",
                "storyKey": "ST-104",
                "title": "Cart payment",
                "summary": "Pay from cart",
                "userStory": "As a shopper, I want to pay from the cart.",
                "status": "ready_for_dev",
                "domain": "billing",
                "acceptanceCriteria": [
                    {"text": "Cart total is visible", "state": "covered"},
                    {"text": "Confirmation is shown", "state": "missing"},
                ],
                "confidenceScore": 90,
            }
        ],
        evidence=[
            {
                "applicationId": "app-commerce",
                "applicationKey": "SHOP",
                "storyKey": "ST-104",
                "type": "knowledge",
                "title": "Billing MVP memo",
                "excerpt": "Checkout includes cart total and confirmation.",
                "citation": {
                    "title": "Billing MVP memo",
                    "snippet": "cart total and confirmation",
                    "uri": "fileSpace://docs/billing",
                },
            }
        ],
        generation_trace=["Agent Search extracted billing story"],
    )

    story = package["stories"][0]
    assert package["applications"][0]["id"] == "app-commerce"
    assert package["applications"][0]["storyCount"] == 1
    assert story["applicationId"] == "app-commerce"
    assert package["evidence"][0]["applicationKey"] == "SHOP"
    assert story["storyKey"] == "ST-104"
    assert story["reviewState"] == "needs_review"
    assert story["confidenceScore"] < 90
    assert package["evidence"][0]["citation"]["snippet"] == "cart total and confirmation"


def test_save_user_story_ssot_requires_evidence():
    result = save_user_story_ssot(
        stories=[{"storyKey": "ST-001", "title": "Demo"}],
        evidence=[],
    )
    assert result["ok"] is False
    assert "evidence" in result["error"]


def test_save_user_story_ssot_returns_json_document_artifact():
    result = save_user_story_ssot(
        applications=[
            {
                "id": "app-demo",
                "applicationKey": "DEMO",
                "name": "Demo Application",
            }
        ],
        stories=[
            {
                "applicationId": "app-demo",
                "applicationKey": "DEMO",
                "storyKey": "ST-001",
                "title": "Demo story",
                "summary": "Demo summary",
                "userStory": "As a user, I want a demo.",
            }
        ],
        evidence=[
            {
                "applicationId": "app-demo",
                "applicationKey": "DEMO",
                "storyKey": "ST-001",
                "type": "knowledge",
                "title": "Demo doc",
                "excerpt": "Demo evidence",
                "citation": {"title": "Demo doc", "snippet": "Demo evidence"},
            }
        ],
    )
    assert result["ok"] is True
    assert result["vibe_control"]["application_count"] == 1
    assert result["vibe_control"]["story_count"] == 1
    assert result["artifacts"][0]["kind"] == "json_document"


def test_build_story_ssot_package_infers_application_when_omitted():
    package = build_story_ssot_package(
        stories=[
            {
                "applicationId": "app-platform",
                "applicationKey": "VC",
                "applicationName": "VibeControl Platform",
                "storyKey": "ST-201",
                "title": "Editor context",
                "summary": "Export application story context",
                "userStory": "As a developer, I want story context.",
            }
        ],
        evidence=[
            {
                "applicationId": "app-platform",
                "applicationKey": "VC",
                "storyKey": "ST-201",
                "type": "knowledge",
                "title": "Concept doc",
                "excerpt": "Application owns many user stories.",
                "citation": {"title": "Concept doc", "snippet": "Application owns stories"},
            }
        ],
    )

    assert package["applications"][0]["id"] == "app-platform"
    assert package["applications"][0]["applicationKey"] == "VC"
    assert package["stories"][0]["applicationId"] == "app-platform"
