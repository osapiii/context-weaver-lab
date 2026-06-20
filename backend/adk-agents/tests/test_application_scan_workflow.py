"""Tests for application_scan invoke state wiring."""
from __future__ import annotations

from common.application_scan_workflow import application_scan_state_patch_from_mode_state


def test_application_scan_state_patch_from_mode_state():
    patch = application_scan_state_patch_from_mode_state(
        {
            "active_mode": "application_scan",
            "application_scan": {
                "setup": {
                    "start_url": "https://example.com/",
                    "max_pages": 3,
                    "capture_screenshots": True,
                }
            },
        }
    )

    assert patch["active_task"] == "application_scan"
    assert patch["application_scan"]["setup"]["start_url"] == "https://example.com/"
