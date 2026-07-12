"""writing_workflow — invoke 検証・state patch."""
from __future__ import annotations

from common.writing_workflow import (  # type: ignore
    merge_writing_invoke_mode_state,
    resolve_writing_action_from_mode_state,
    validate_writing_invoke,
    writing_state_patch_from_mode_state,
    writing_turn_context_summary,
)


def _writing_bucket(
    *,
    phase: str = "format_review",
    action: str | None = None,
    reference: dict | None = None,
    form: dict | None = None,
) -> dict:
    bucket: dict = {"phase": phase}
    setup: dict = {}
    if reference is not None:
        setup["reference"] = reference
        if reference.get("status") == "complete":
            setup["confirmed"] = True
    if setup:
        bucket["setup"] = setup
    payload: dict = {}
    if action:
        payload["action"] = action
    if form is not None:
        payload["form"] = form
    if payload:
        bucket["payload"] = payload
    return bucket


def _writing_mode_state(bucket: dict) -> dict:
    return {"active_mode": "writing", "writing": bucket}


def test_resolve_writing_action_from_nested_bucket():
    assert (
        resolve_writing_action_from_mode_state(
            _writing_mode_state(
                _writing_bucket(action="generate_document", phase="filling")
            )
        )
        == "generate_document"
    )


def test_resolve_writing_action_prefers_flat_key():
    nested = _writing_mode_state(_writing_bucket(action="extract_schema"))
    nested["writing_action"] = "generate_document"
    assert resolve_writing_action_from_mode_state(nested) == "generate_document"


def test_validate_writing_skips_non_writing():
    assert (
        validate_writing_invoke(
            agent_mode="consultation",
            mode_state={},
            attachments=[],
            selected_knowledge=[],
        )
        is None
    )


def test_validate_writing_requires_reference_material():
    assert (
        validate_writing_invoke(
            agent_mode="writing",
            mode_state=_writing_mode_state(
                _writing_bucket(
                    reference={"status": "complete", "attachments": []},
                    action="extract_schema",
                )
            ),
            attachments=[],
            selected_knowledge=[],
        )
        == "WRITING_REFERENCE_REQUIRED"
    )


def test_validate_writing_extract_ok():
    assert (
        validate_writing_invoke(
            agent_mode="writing",
            mode_state=_writing_mode_state(
                _writing_bucket(
                    reference={
                        "status": "complete",
                        "attachments": [{"id": "a1", "name": "x.pdf"}],
                    },
                    action="extract_schema",
                )
            ),
            attachments=[],
            selected_knowledge=[],
        )
        is None
    )


def test_validate_writing_generate_requires_filling_phase():
    assert (
        validate_writing_invoke(
            agent_mode="writing",
            mode_state=_writing_mode_state(
                _writing_bucket(
                    phase="format_review",
                    reference={
                        "status": "complete",
                        "attachments": [{"id": "a1"}],
                    },
                    action="generate_document",
                    form={
                        "fields": [{"key": "name", "label": "名称", "value": "A"}],
                    },
                )
            ),
            attachments=[],
            selected_knowledge=[],
        )
        == "WRITING_PHASE_NOT_FILLING"
    )


def test_validate_writing_generate_requires_required_values():
    assert (
        validate_writing_invoke(
            agent_mode="writing",
            mode_state=_writing_mode_state(
                _writing_bucket(
                    phase="filling",
                    reference={
                        "status": "complete",
                        "attachments": [{"id": "a1"}],
                    },
                    action="generate_document",
                    form={
                        "fields": [
                            {
                                "key": "name",
                                "label": "名称",
                                "required": True,
                                "value": "",
                            }
                        ],
                    },
                )
            ),
            attachments=[],
            selected_knowledge=[],
        )
        == "WRITING_REQUIRED_VALUES_MISSING"
    )


def test_validate_writing_generate_auto_fill_ok():
    assert (
        validate_writing_invoke(
            agent_mode="writing",
            mode_state=_writing_mode_state(
                _writing_bucket(
                    phase="filling",
                    reference={
                        "status": "complete",
                        "attachments": [{"id": "a1", "name": "x.pdf"}],
                    },
                    action="generate_document",
                    form={
                        "schema_confirmed_at": "2026-01-01T00:00:00Z",
                        "fields": [
                            {
                                "key": "name",
                                "label": "名称",
                                "required": True,
                                "value": "",
                            }
                        ],
                    },
                )
            ),
            attachments=[],
            selected_knowledge=[],
        )
        is None
    )


def test_writing_state_patch_from_mode_state():
    patch = writing_state_patch_from_mode_state(
        _writing_mode_state(
            _writing_bucket(
                phase="filling",
                action="generate_document",
                reference={"status": "complete"},
                form={"fields": [{"key": "a", "label": "A"}]},
            )
        )
    )
    assert patch.get("active_task") == "writing"
    writing = patch["writing"]
    assert writing["phase"] == "filling"
    assert writing["payload"]["action"] == "generate_document"
    assert "mode_state" not in patch


def test_merge_writing_invoke_mode_state_prefers_stored_form():
    merged = merge_writing_invoke_mode_state(
        session_state={
            "writing": _writing_bucket(
                phase="format_review",
                form={
                    "fields": [
                        {"key": "a", "label": "A", "type": "text"},
                        {"key": "b", "label": "B", "type": "text"},
                    ]
                },
            )
        },
        request_mode_state=_writing_mode_state(
            _writing_bucket(
                phase="filling",
                action="generate_document",
                form={"fields": []},
            )
        ),
    )
    form = merged["writing"]["payload"]["form"]
    assert len(form["fields"]) == 2
    assert merged["writing"]["payload"]["action"] == "generate_document"


def test_writing_turn_context_summary_extract():
    summary = writing_turn_context_summary(
        mode_state=_writing_mode_state(
            _writing_bucket(phase="format_review", action="extract_schema")
        )
    )
    assert summary is not None
    assert "save_writing_form_schema" in summary
