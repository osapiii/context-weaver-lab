"""Research / AI Studio 向け `/v1/sessions` CRUD + run routes."""
from __future__ import annotations

import logging
import os
from typing import Any, Callable

from fastapi import Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .firestore_session_service import (
    FirestoreSessionService,
    denormalized_fields_from_state,
)
from .run_sse import SSE_HEADERS, stream_session_run
from .services import AdkServices

logger = logging.getLogger(__name__)


class CreateSessionBody(BaseModel):
    organizationId: str = Field(..., min_length=1)
    spaceId: str = Field(..., min_length=1)
    sessionId: str | None = None
    initialPrompt: str | None = None


class RunSessionBody(BaseModel):
    message: str


def _resolve_scope(
    organization_id: str | None,
    space_id: str | None,
) -> tuple[str, str]:
    org = (organization_id or os.environ.get("ADK_DEFAULT_ORGANIZATION_ID") or "").strip()
    space = (space_id or os.environ.get("ADK_DEFAULT_SPACE_ID") or "").strip()
    if not org or not space:
        raise HTTPException(
            status_code=400,
            detail="organizationId and spaceId are required",
        )
    return org, space


def register_session_routes(
    app,
    *,
    app_name: str,
    get_services: Callable[[Request], AdkServices],
    get_runner: Callable[[Request], Any],
    require_user: Callable[..., Any],
    get_storage_client: Callable[[Request], Any] | None = None,
) -> None:
    """POST/GET/PATCH/DELETE `/v1/sessions` と POST `/v1/sessions/{id}/run` を登録する."""

    def _storage(request: Request) -> Any | None:
        if get_storage_client is None:
            return None
        return get_storage_client(request)

    async def _parent_fields(
        services: AdkServices,
        session_id: str,
        *,
        organization_id: str,
        space_id: str,
        state: dict[str, Any],
    ) -> dict[str, Any]:
        if isinstance(services.session_service, FirestoreSessionService):
            return await services.session_service.get_parent_doc_fields(
                session_id,
                organization_id=organization_id,
                space_id=space_id,
            )
        return denormalized_fields_from_state(state)

    @app.post("/v1/sessions", status_code=201)
    async def create_session(
        request: Request,
        body: CreateSessionBody,
        user: dict[str, Any] = Depends(require_user),
    ) -> JSONResponse:
        services = get_services(request)
        org_id, space_id = _resolve_scope(body.organizationId, body.spaceId)
        initial_state: dict[str, Any] = {
            "status": "active",
            "organization_id": org_id,
            "space_id": space_id,
        }
        if body.initialPrompt:
            initial_state["initial_prompt"] = body.initialPrompt
        session = await services.session_service.create_session(
            app_name=app_name,
            user_id=user["uid"],
            state=initial_state,
            session_id=body.sessionId,
            organization_id=org_id,
            space_id=space_id,
        )
        return JSONResponse(
            {
                "sessionId": session.id,
                "createdAt": session.last_update_time,
            },
            status_code=201,
        )

    @app.get("/v1/sessions")
    async def list_sessions(
        request: Request,
        organizationId: str = Query(..., min_length=1),
        spaceId: str = Query(..., min_length=1),
        user: dict[str, Any] = Depends(require_user),
    ) -> JSONResponse:
        services = get_services(request)
        org_id, space_id = _resolve_scope(organizationId, spaceId)
        resp = await services.session_service.list_sessions(
            app_name=app_name,
            user_id=user["uid"],
            organization_id=org_id,
            space_id=space_id,
        )
        sessions_out: list[dict[str, Any]] = []
        for s in resp.sessions:
            flat = await _parent_fields(
                services,
                s.id,
                organization_id=org_id,
                space_id=space_id,
                state=dict(s.state or {}),
            )
            sessions_out.append(
                {
                    "sessionId": s.id,
                    "state": s.state,
                    "lastUpdateTime": s.last_update_time,
                    "title": flat.get("title"),
                    "jobKind": flat.get("jobKind"),
                    "activeAgent": flat.get("activeAgent"),
                    "theme": flat.get("theme"),
                    "currentPhase": flat.get("currentPhase"),
                    "status": flat.get("status", "active"),
                }
            )
        return JSONResponse({"sessions": sessions_out})

    @app.get("/v1/sessions/{session_id}")
    async def get_session(
        session_id: str,
        request: Request,
        organizationId: str = Query(..., min_length=1),
        spaceId: str = Query(..., min_length=1),
        user: dict[str, Any] = Depends(require_user),
    ) -> JSONResponse:
        services = get_services(request)
        org_id, space_id = _resolve_scope(organizationId, spaceId)
        session = await services.session_service.get_session(
            app_name=app_name,
            user_id=user["uid"],
            session_id=session_id,
            organization_id=org_id,
            space_id=space_id,
        )
        if not session:
            raise HTTPException(status_code=404, detail="session not found")
        flat = await _parent_fields(
            services,
            session_id,
            organization_id=org_id,
            space_id=space_id,
            state=dict(session.state or {}),
        )
        events_view: list[dict[str, Any]] = []
        for e in session.events:
            view: dict[str, Any] = {
                "author": getattr(e, "author", "system"),
                "timestamp": getattr(e, "timestamp", None),
            }
            content = getattr(e, "content", None)
            if content is not None:
                try:
                    view["content"] = content.model_dump(mode="json", exclude_none=True)
                except Exception:
                    view["content"] = str(content)
            events_view.append(view)
        return JSONResponse(
            {
                "sessionId": session.id,
                "appName": app_name,
                "state": session.state,
                "events": events_view,
                "eventCount": len(events_view),
                "lastUpdateTime": session.last_update_time,
                "title": flat.get("title"),
                "jobKind": flat.get("jobKind"),
                "activeAgent": flat.get("activeAgent"),
                "theme": flat.get("theme"),
                "currentPhase": flat.get("currentPhase"),
                "status": flat.get("status", "active"),
            }
        )

    @app.delete("/v1/sessions/{session_id}", status_code=204)
    async def delete_session(
        session_id: str,
        request: Request,
        organizationId: str = Query(..., min_length=1),
        spaceId: str = Query(..., min_length=1),
        user: dict[str, Any] = Depends(require_user),
    ) -> JSONResponse:
        services = get_services(request)
        org_id, space_id = _resolve_scope(organizationId, spaceId)
        try:
            await services.session_service.delete_session(
                app_name=app_name,
                user_id=user["uid"],
                session_id=session_id,
                organization_id=org_id,
                space_id=space_id,
            )
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        return JSONResponse(status_code=204, content=None)

    @app.post("/v1/sessions/{session_id}/run")
    async def run_session(
        session_id: str,
        body: RunSessionBody,
        request: Request,
        organizationId: str = Query(..., min_length=1),
        spaceId: str = Query(..., min_length=1),
        user: dict[str, Any] = Depends(require_user),
    ) -> StreamingResponse:
        services = get_services(request)
        org_id, space_id = _resolve_scope(organizationId, spaceId)
        session = await services.session_service.get_session(
            app_name=app_name,
            user_id=user["uid"],
            session_id=session_id,
            organization_id=org_id,
            space_id=space_id,
        )
        if not session:
            raise HTTPException(status_code=404, detail="session not found")

        runner = get_runner(request)
        if runner is None:
            raise HTTPException(status_code=500, detail="ADK agent unavailable")

        async def _sse() -> Any:
            async for chunk in stream_session_run(
                runner=runner,
                services=services,
                app_name=app_name,
                user_id=user["uid"],
                session_id=session_id,
                message=body.message,
                storage_client=_storage(request),
            ):
                yield chunk

        return StreamingResponse(_sse(), media_type="text/event-stream", headers=SSE_HEADERS)
