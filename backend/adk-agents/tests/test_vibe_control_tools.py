"""Tests for VibeControl SSOT package tools."""
from __future__ import annotations

from vibe_control.tools import build_story_ssot_package, save_user_story_ssot


def test_build_story_ssot_package_marks_low_evidence_as_needs_review():
    package = build_story_ssot_package(
        stories=[
            {
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
        stories=[
            {
                "storyKey": "ST-001",
                "title": "Demo story",
                "summary": "Demo summary",
                "userStory": "As a user, I want a demo.",
            }
        ],
        evidence=[
            {
                "storyKey": "ST-001",
                "type": "knowledge",
                "title": "Demo doc",
                "excerpt": "Demo evidence",
                "citation": {"title": "Demo doc", "snippet": "Demo evidence"},
            }
        ],
    )
    assert result["ok"] is True
    assert result["vibe_control"]["story_count"] == 1
    assert result["artifacts"][0]["kind"] == "json_document"
