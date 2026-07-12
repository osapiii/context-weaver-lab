"""Tests for FirestoreSessionService denormalized fields."""
from __future__ import annotations

from common.firestore_session_service import (
    denormalized_fields_from_doc,
    denormalized_fields_from_envelope,
    denormalized_fields_from_state,
)
from common.session_scope import resolve_session_scope


def test_denormalized_fields_from_state():
    fields = denormalized_fields_from_state(
        {
            "theme": "AI 概論",
            "deck_id": "deck-1",
            "current_phase": "phase2_design",
            "status": "active",
        }
    )
    assert fields["theme"] == "AI 概論"
    assert fields["deckId"] == "deck-1"
    assert fields["currentPhase"] == "phase2_design"
    assert fields["status"] == "active"


def test_denormalized_fields_from_state_research_bucket():
    fields = denormalized_fields_from_state(
        {
            "research": {
                "current_phase": "phase2_design",
                "theme": "From bucket",
            }
        }
    )
    assert fields["theme"] == "From bucket"
    assert fields["currentPhase"] == "phase2_design"


def test_denormalized_fields_from_state_golden_research_bucket():
    fields = denormalized_fields_from_state(
        {
            "research": {
                "phase": "phase2_svg",
                "setup": {"theme": "Golden theme"},
                "payload": {"deck_id": "deck-99"},
            }
        }
    )
    assert fields["theme"] == "Golden theme"
    assert fields["currentPhase"] == "phase2_svg"
    assert fields["deckId"] == "deck-99"


def test_denormalized_fields_from_state_hearing_theme():
    fields = denormalized_fields_from_state(
        {"phase1_hearing_result": {"theme": "From hearing"}}
    )
    assert fields["theme"] == "From hearing"


def test_denormalized_fields_from_envelope():
    fields = denormalized_fields_from_envelope(
        {
            "session_meta": {"title": "AI Studio", "status": "active"},
            "active_task": "image",
        }
    )
    assert fields["title"] == "AI Studio"
    assert fields["jobKind"] == "image"
    assert fields["activeAgent"] == "image"


def test_resolve_session_scope_from_state():
    scope = resolve_session_scope(
        state={"organization_id": "org-1", "space_id": "sp-1"}
    )
    assert scope.organization_id == "org-1"
    assert scope.space_id == "sp-1"


def test_denormalized_fields_from_doc_prefers_flat_columns():
    fields = denormalized_fields_from_doc(
        {
            "theme": "Flat theme",
            "deckId": "d1",
            "currentPhase": "phase1_hearing",
            "status": "completed",
            "state": {"theme": "State theme"},
        }
    )
    assert fields["theme"] == "Flat theme"
    assert fields["deckId"] == "d1"
    assert fields["currentPhase"] == "phase1_hearing"
    assert fields["status"] == "completed"
