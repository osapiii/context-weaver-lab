"""Session state patch helpers — Firestore / InMemory 両対応."""
from __future__ import annotations

import logging
from typing import Any

from google.adk.sessions import InMemorySessionService

from .firestore_session_service import FirestoreSessionService
from .session_scope import resolve_session_scope

logger = logging.getLogger(__name__)


def _scope_kwargs(
    *,
    organization_id: str | None,
    space_id: str | None,
    state: dict[str, Any] | None = None,
) -> dict[str, str]:
    scope = resolve_session_scope(
        organization_id=organization_id,
        space_id=space_id,
        state=state,
    )
    return {
        "organization_id": scope.organization_id,
        "space_id": scope.space_id,
    }


async def persist_session_state_patch(
    session_service: Any,
    *,
    app_name: str,
    user_id: str,
    session_id: str,
    state_patch: dict[str, Any],
    organization_id: str | None = None,
    space_id: str | None = None,
) -> None:
    """Runner が参照する storage 側 session.state を更新する."""
    if not state_patch:
        return

    if isinstance(session_service, FirestoreSessionService):
        scope = _scope_kwargs(
            organization_id=organization_id,
            space_id=space_id,
            state=state_patch,
        )
        await session_service.patch_session_state(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            state_patch=state_patch,
            **scope,
        )
        return

    if isinstance(session_service, InMemorySessionService):
        stored = (
            session_service.sessions.get(app_name, {})
            .get(user_id, {})
            .get(session_id)
        )
        if stored is None:
            logger.warning(
                "session state patch skipped: session not found app=%s user=%s id=%s",
                app_name,
                user_id,
                session_id,
            )
            return
        stored.state.update(state_patch)
        return

    if hasattr(session_service, "patch_session_state"):
        patch_kwargs: dict[str, Any] = {
            "app_name": app_name,
            "user_id": user_id,
            "session_id": session_id,
            "state_patch": state_patch,
        }
        if organization_id and space_id:
            patch_kwargs["organization_id"] = organization_id
            patch_kwargs["space_id"] = space_id
        await session_service.patch_session_state(**patch_kwargs)
        return

    logger.warning(
        "session state patch unsupported for service=%s",
        type(session_service).__name__,
    )


async def ensure_session_state(
    session_service: Any,
    *,
    app_name: str,
    user_id: str,
    session_id: str,
    state_patch: dict[str, Any],
    organization_id: str | None = None,
    space_id: str | None = None,
) -> None:
    """Session を用意し state を merge する."""
    get_kwargs: dict[str, Any] = {
        "app_name": app_name,
        "user_id": user_id,
        "session_id": session_id,
    }
    create_kwargs: dict[str, Any] = dict(get_kwargs, state=state_patch)
    if organization_id and space_id:
        get_kwargs["organization_id"] = organization_id
        get_kwargs["space_id"] = space_id
        create_kwargs["organization_id"] = organization_id
        create_kwargs["space_id"] = space_id

    session = await session_service.get_session(**get_kwargs)
    if session is None:
        await session_service.create_session(**create_kwargs)
        return
    await persist_session_state_patch(
        session_service,
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
        state_patch=state_patch,
        organization_id=organization_id,
        space_id=space_id,
    )


async def read_session_state(
    session_service: Any,
    *,
    app_name: str,
    user_id: str,
    session_id: str,
    organization_id: str | None = None,
    space_id: str | None = None,
) -> dict[str, Any]:
    if isinstance(session_service, FirestoreSessionService):
        scope = _scope_kwargs(
            organization_id=organization_id,
            space_id=space_id,
        )
        return await session_service.get_session_state(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            **scope,
        )
    get_kwargs: dict[str, Any] = {
        "app_name": app_name,
        "user_id": user_id,
        "session_id": session_id,
    }
    if organization_id and space_id:
        get_kwargs["organization_id"] = organization_id
        get_kwargs["space_id"] = space_id
    session = await session_service.get_session(**get_kwargs)
    if session is None:
        return {}
    return dict(session.state or {})
