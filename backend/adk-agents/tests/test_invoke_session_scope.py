"""invoke_session_scope と get_session の Runner 向けフォールバック."""
from __future__ import annotations

import pytest

from common.firestore_session_service import FirestoreSessionService
from common.invoke_session_scope import (
    get_invoke_session_scope,
    get_invoke_session_scope_for_id,
    reset_invoke_session_scope,
    set_invoke_session_scope,
)
from common.session_scope import resolve_session_scope


def test_resolve_session_scope_from_invoke_context():
    tokens = set_invoke_session_scope(
        organization_id="org-ctx",
        space_id="sp-ctx",
        session_id="sess-1",
    )
    try:
        scope = resolve_session_scope()
        assert scope.organization_id == "org-ctx"
        assert scope.space_id == "sp-ctx"
        assert get_invoke_session_scope() == ("org-ctx", "sp-ctx")
        mapped = get_invoke_session_scope_for_id("sess-1")
        assert mapped is not None
        assert mapped.organization_id == "org-ctx"
    finally:
        reset_invoke_session_scope(tokens)


def test_get_session_scope_fallback_by_session_id():
    svc = FirestoreSessionService(project_id="test-project")
    tokens = set_invoke_session_scope(
        organization_id="org-map",
        space_id="sp-map",
        session_id="sess-map",
    )
    try:
        scope = svc._resolve_get_session_scope(
            session_id="sess-map",
            organization_id=None,
            space_id=None,
        )
        assert scope.organization_id == "org-map"
        assert scope.space_id == "sp-map"
    finally:
        reset_invoke_session_scope(tokens)


def test_get_session_scope_fallback_missing_raises():
    svc = FirestoreSessionService(project_id="test-project")
    with pytest.raises(ValueError, match="organization_id and space_id are required"):
        svc._resolve_get_session_scope(
            session_id="unknown",
            organization_id=None,
            space_id=None,
        )
