"""Invoke リクエスト中の org/space を ADK Runner まで伝播する (contextvars).

google-adk Runner は get_session / create_session を organization_id 引数なしで呼ぶため、
HTTP invoke 開始時にここへセットし FirestoreSessionService が参照する.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar, Token
from typing import Iterator

from .session_scope import SessionScope

_invoke_organization_id: ContextVar[str | None] = ContextVar(
    "invoke_organization_id", default=None
)
_invoke_space_id: ContextVar[str | None] = ContextVar("invoke_space_id", default=None)
_invoke_scope_by_session_id: ContextVar[dict[str, SessionScope] | None] = (
    ContextVar("invoke_scope_by_session_id", default=None)
)


def get_invoke_session_scope() -> tuple[str | None, str | None]:
    return _invoke_organization_id.get(), _invoke_space_id.get()


def get_invoke_session_scope_for_id(session_id: str) -> SessionScope | None:
    sid = (session_id or "").strip()
    if not sid:
        return None
    mapping = _invoke_scope_by_session_id.get() or {}
    return mapping.get(sid)


def set_invoke_session_scope(
    *,
    organization_id: str | None,
    space_id: str | None,
    session_id: str | None = None,
) -> tuple[Token, Token, Token | None]:
    org_token = _invoke_organization_id.set(
        organization_id.strip() if organization_id else None
    )
    space_token = _invoke_space_id.set(space_id.strip() if space_id else None)
    session_token: Token | None = None
    sid = (session_id or "").strip()
    org = (organization_id or "").strip()
    space = (space_id or "").strip()
    if sid and org and space:
        mapping = dict(_invoke_scope_by_session_id.get() or {})
        mapping[sid] = SessionScope(organization_id=org, space_id=space)
        session_token = _invoke_scope_by_session_id.set(mapping)
    return org_token, space_token, session_token


def reset_invoke_session_scope(
    tokens: tuple[Token, Token, Token | None],
) -> None:
    org_token, space_token, session_token = tokens
    _invoke_organization_id.reset(org_token)
    _invoke_space_id.reset(space_token)
    if session_token is not None:
        _invoke_scope_by_session_id.reset(session_token)


@contextmanager
def activate_invoke_session_scope(
    *,
    organization_id: str,
    space_id: str,
) -> Iterator[None]:
    tokens = set_invoke_session_scope(
        organization_id=organization_id,
        space_id=space_id,
        session_id=None,
    )
    try:
        yield
    finally:
        reset_invoke_session_scope(tokens)
