"""Org/Space scoped ADK session path."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SessionScope:
    organization_id: str
    space_id: str


def resolve_session_scope(
    *,
    organization_id: str | None = None,
    space_id: str | None = None,
    state: dict[str, Any] | None = None,
) -> SessionScope:
    """organization_id / space_id を引数・session.state・invoke context から解決する."""
    from .invoke_session_scope import get_invoke_session_scope

    ctx_org, ctx_space = get_invoke_session_scope()
    state_dict = state or {}
    org = (
        (organization_id or "").strip()
        or str(state_dict.get("organization_id") or "").strip()
        or str(state_dict.get("organizationId") or "").strip()
        or (ctx_org or "").strip()
    )
    space = (
        (space_id or "").strip()
        or str(state_dict.get("space_id") or "").strip()
        or str(state_dict.get("spaceId") or "").strip()
        or (ctx_space or "").strip()
    )
    if not org or not space:
        raise ValueError("organization_id and space_id are required")
    return SessionScope(organization_id=org, space_id=space)
