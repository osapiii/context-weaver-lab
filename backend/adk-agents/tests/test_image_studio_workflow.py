"""image_studio_workflow invoke validation."""
from __future__ import annotations

from common.image_studio_workflow import (
    image_studio_state_patch_from_mode_state,
    image_studio_turn_context_summary,
    merge_image_invoke_mode_state,
    resolve_image_workflow_phase,
    validate_image_studio_invoke,
)
from common.image_workflow_phase_scope import (
    activate_invoke_image_workflow_phase,
    deactivate_invoke_image_workflow_phase,
)
from common.workspace_state_buckets import effective_image_mode_state


def _image_mode_state(**image: object) -> dict:
    return {"active_mode": "image", "image": image}


def test_resolve_phase_defaults_create():
    assert resolve_image_workflow_phase(mode_state={}) == "create"


def test_validate_retouch_requires_primary():
    assert (
        validate_image_studio_invoke(
            agent_mode="image",
            mode_state=_image_mode_state(phase="retouch"),
        )
        == "IMAGE_PRIMARY_NOT_SET"
    )


def test_validate_retouch_ok_with_primary():
    assert (
        validate_image_studio_invoke(
            agent_mode="image",
            mode_state=_image_mode_state(
                phase="retouch",
                primary={"adk_filename": "img.png", "version": 1},
            ),
        )
        is None
    )


def test_turn_context_summary_retouch_lists_regions():
    summary = image_studio_turn_context_summary(
        mode_state=_image_mode_state(
            phase="retouch",
            primary={"adk_filename": "poster.png", "version": 3},
            retouch_regions=[
                {
                    "id": "r1",
                    "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1},
                    "instruction": "Change title",
                }
            ],
        )
    )
    assert summary is not None
    assert "retouch_image" in summary
    assert "poster.png" in summary
    assert "Change title" in summary


def test_resolve_phase_from_golden_image_bucket():
    phase = resolve_image_workflow_phase(
        mode_state=_image_mode_state(
            phase="retouch",
            primary={"adk_filename": "poster.png", "version": 1},
        )
    )
    assert phase == "retouch"


def test_effective_image_mode_state_request_overrides_stale_session():
    effective = effective_image_mode_state(
        mode_state=_image_mode_state(phase="retouch"),
        session_state={
            "image": {"phase": "create", "setup": {"confirmed": True}},
        },
    )
    assert effective["image_workflow_phase"] == "retouch"


def test_resolve_phase_uses_invoke_scope_when_session_stale():
    token = activate_invoke_image_workflow_phase("retouch")
    try:
        assert (
            resolve_image_workflow_phase(
                mode_state=_image_mode_state(phase="create"),
                session_state={"image": {"phase": "create"}},
            )
            == "retouch"
        )
    finally:
        deactivate_invoke_image_workflow_phase(token)


def test_merge_invoke_applies_request_retouch_when_session_still_create():
    merged = merge_image_invoke_mode_state(
        session_state={"image": {"phase": "create"}},
        request_mode_state=_image_mode_state(
            phase="retouch",
            primary={"adk_filename": "poster.png", "version": 2},
            retouch_regions=[{"id": "r1", "instruction": "fix title"}],
        ),
    )
    assert merged["image"]["phase"] == "retouch"
    assert merged["image"]["primary"]["adk_filename"] == "poster.png"


def test_merge_invoke_prefers_firestore_retouch_over_stale_request():
    stored = {
        "image": {
            "phase": "retouch",
            "primary": {"adk_filename": "poster.png", "version": 2},
            "retouch_regions": [{"id": "r1", "instruction": "fix title"}],
        }
    }
    merged = merge_image_invoke_mode_state(
        session_state=stored,
        request_mode_state=_image_mode_state(phase="create"),
    )
    assert merged["image"]["phase"] == "retouch"
    assert merged["image"]["primary"]["adk_filename"] == "poster.png"
    assert len(merged["image"]["retouch_regions"]) == 1


def test_mode_state_from_adk_state_object_reads_phase():
    from google.adk.sessions.state import State

    from common.image_studio_workflow import mode_state_from_tool_context
    from common.tool_state import read_tool_state

    class _FakeToolContext:
        def __init__(self, state: State) -> None:
            self.state = state

    adk_state = State(
        value={"image": {"phase": "retouch", "primary": {"adk_filename": "a.png"}}},
        delta={},
    )
    assert not isinstance(adk_state, dict)
    plain = read_tool_state(_FakeToolContext(adk_state))
    assert plain["image"]["phase"] == "retouch"
    effective = mode_state_from_tool_context(_FakeToolContext(adk_state))
    assert effective["image_workflow_phase"] == "retouch"
    assert effective["primary_image"]["adk_filename"] == "a.png"


def test_state_patch_writes_image_bucket():
    patch = image_studio_state_patch_from_mode_state(
        _image_mode_state(
            phase="retouch",
            primary={"adk_filename": "a.png"},
            retouch_regions=[{"id": "r1"}],
        )
    )
    assert patch.get("active_task") == "image"
    image = patch["image"]
    assert image["phase"] == "retouch"
    assert image["primary"]["adk_filename"] == "a.png"
    assert "mode_state" not in patch
