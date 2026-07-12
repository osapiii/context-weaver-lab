"""Tests for image reference session state helpers."""
from __future__ import annotations

from common.image_reference import (
    confirm_image_reference_state,
    empty_image_reference_state,
    fe_requests_image_workflow,
    image_reference_state_for_mode_handoff,
    image_turn_context_summary,
    is_image_mode_selected,
    merge_image_reference_on_invoke,
    normalize_image_reference_state,
    resolve_image_creation_mode,
    resolve_image_reference_for_tool,
    validate_image_workflow_invoke,
)
from common.image_reference_scope import (
    activate_invoke_image_reference,
    deactivate_invoke_image_reference,
)


def test_empty_image_reference_state():
    st = empty_image_reference_state()
    assert st["status"] == "incomplete"
    assert st["references"] == []


def test_merge_scratch_clears_references():
    ref_state = normalize_image_reference_state(
        {
            "status": "complete",
            "references": [
                {
                    "id": "1",
                    "source": "upload",
                    "name": "a.png",
                    "mime_type": "image/png",
                    "url": "https://example.com/a.png",
                }
            ],
        }
    )
    stored = {
        "image": {
            "setup": {
                "creation": "reference",
                "reference": ref_state,
            }
        }
    }
    merged = merge_image_reference_on_invoke(
        stored=stored,
        mode_state={"image": {"setup": {"creation": "scratch"}}},
        reference_images=None,
    )
    assert merged["status"] == "incomplete"
    assert merged["references"] == []


def test_image_turn_context_summary_scratch():
    text = image_turn_context_summary(
        creation_mode="scratch",
        image_reference=empty_image_reference_state(),
    )
    assert "scratch" in text
    assert "generate" in text.lower()


def test_resolve_image_creation_mode_from_mode_state():
    mode = resolve_image_creation_mode(
        None,
        mode_state={"image": {"setup": {"creation": "scratch", "confirmed": True}}},
    )
    assert mode == "scratch"


def test_resolve_image_creation_mode_ignores_stale_complete_refs():
    """scratch 明示時はセッションに確定済み参照があっても reference にしない."""
    from common.image_creation_mode_scope import (
        activate_invoke_image_creation_mode,
        deactivate_invoke_image_creation_mode,
    )

    complete = {
        "status": "complete",
        "references": [
            {
                "id": "1",
                "source": "upload",
                "name": "a.png",
                "mime_type": "image/png",
                "url": "https://example.com/a.png",
            }
        ],
        "min_count": 1,
        "confirmed_at": "2026-01-01T00:00:00+00:00",
    }
    ctx = type(
        "Ctx",
        (),
        {"state": {"image": {"setup": {"reference": complete, "creation": "reference"}}}},
    )()
    token = activate_invoke_image_creation_mode("scratch")
    try:
        assert resolve_image_creation_mode(ctx) == "scratch"
    finally:
        deactivate_invoke_image_creation_mode(token)


def test_merge_adds_draft_from_reference_images():
    stored = empty_image_reference_state()
    refs = [
        {
            "id": "k1",
            "source": "knowledge",
            "name": "logo.png",
            "mime_type": "image/png",
            "gcs_path": "gs://bucket/logo.png",
        }
    ]
    merged = merge_image_reference_on_invoke(
        stored=stored,
        mode_state={},
        reference_images=refs,
    )
    assert merged["status"] == "draft"
    assert len(merged["references"]) == 1


def test_confirm_requires_at_least_one_reference():
    result = confirm_image_reference_state(empty_image_reference_state())
    assert result["ok"] is False


def test_resolve_image_reference_uses_contextvar():
    complete = {
        "status": "complete",
        "references": [
            {
                "id": "1",
                "source": "upload",
                "name": "a.png",
                "mime_type": "image/png",
                "url": "https://example.com/a.png",
            }
        ],
        "min_count": 1,
        "confirmed_at": "2026-01-01T00:00:00+00:00",
    }
    token = activate_invoke_image_reference(complete)
    try:
        resolved = resolve_image_reference_for_tool(None)
        assert resolved["status"] == "complete"
        assert len(resolved["references"]) == 1
    finally:
        deactivate_invoke_image_reference(token)


def test_confirm_complete_with_reference():
    draft = normalize_image_reference_state(
        {
            "status": "draft",
            "references": [
                {
                    "id": "u1",
                    "source": "upload",
                    "name": "ref.png",
                    "mime_type": "image/png",
                    "url": "https://example.com/ref.png",
                }
            ],
        }
    )
    result = confirm_image_reference_state(
        {"image": {"setup": {"reference": draft, "creation": "reference"}}}
    )
    assert result["ok"] is True
    assert result["image_reference"]["status"] == "complete"
    assert result["image_reference"]["confirmed_at"]


def test_fe_requests_image_workflow_reference_mode():
    assert fe_requests_image_workflow(
        mode_state={
            "active_mode": "consultation",
            "image": {"setup": {"creation": "reference"}},
        },
        reference_images=None,
    )


def test_is_image_mode_selected_from_mode_state():
    assert is_image_mode_selected(
        mode_state={"image": {"setup": {"confirmed": True, "creation": "scratch"}}},
    )
    assert not is_image_mode_selected(
        mode_state={
            "active_mode": "image",
            "image": {"setup": {"confirmed": False}},
        },
    )


def test_is_image_mode_selected_from_nested_image_bucket():
    assert is_image_mode_selected(
        mode_state={
            "active_mode": "image",
            "image": {
                "setup": {
                    "confirmed": True,
                    "creation": "reference",
                },
            },
        },
    )


def test_is_image_mode_selected_from_golden_setup_confirmed():
    assert is_image_mode_selected(
        mode_state={
            "active_mode": "image",
            "image": {
                "setup": {
                    "confirmed": True,
                    "creation": "reference",
                },
            },
        },
    )


def test_validate_image_workflow_invoke_golden_setup_confirmed():
    assert (
        validate_image_workflow_invoke(
            mode_state={
                "active_mode": "image",
                "image": {
                    "setup": {
                        "confirmed": True,
                        "creation": "reference",
                        "reference": {
                            "status": "complete",
                            "references": [
                                {
                                    "id": "1",
                                    "source": "upload",
                                    "name": "flyer.png",
                                    "mime_type": "image/png",
                                    "url": "https://example.com/flyer.png",
                                }
                            ],
                            "min_count": 1,
                            "confirmed_at": "2026-01-01T00:00:00Z",
                        },
                    },
                },
            },
        )
        is None
    )


def test_validate_image_workflow_invoke_requires_selection():
    assert (
        validate_image_workflow_invoke(
            mode_state={
                "active_mode": "image",
                "image": {"setup": {"confirmed": False}},
            },
        )
        == "IMAGE_MODE_NOT_SELECTED"
    )
    assert (
        validate_image_workflow_invoke(
            mode_state={
                "active_mode": "image",
                "image": {"setup": {"confirmed": True, "creation": "scratch"}},
            },
        )
        is None
    )


def test_image_reference_state_for_mode_handoff_preserves_merged():
    merged = normalize_image_reference_state(
        {
            "status": "complete",
            "references": [
                {
                    "id": "1",
                    "source": "upload",
                    "name": "flyer.png",
                    "mime_type": "image/png",
                    "url": "https://example.com/flyer.png",
                }
            ],
            "confirmed_at": "2026-01-01T00:00:00Z",
        }
    )
    preserved = image_reference_state_for_mode_handoff(
        mode_state={"image": {"setup": {"creation": "reference"}}},
        merged_on_invoke=merged,
    )
    assert preserved["status"] == "complete"
    assert len(preserved["references"]) == 1


def test_image_reference_state_for_mode_handoff_scratch_clears():
    merged = normalize_image_reference_state(
        {
            "status": "complete",
            "references": [
                {
                    "id": "1",
                    "source": "upload",
                    "name": "flyer.png",
                    "mime_type": "image/png",
                    "url": "https://example.com/flyer.png",
                }
            ],
        }
    )
    cleared = image_reference_state_for_mode_handoff(
        mode_state={"image": {"setup": {"creation": "scratch"}}},
        merged_on_invoke=merged,
    )
    assert cleared["status"] == "incomplete"
    assert cleared["references"] == []
