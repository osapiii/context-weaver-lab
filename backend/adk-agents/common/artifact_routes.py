"""Session-scoped ADK artifact REST routes."""
from __future__ import annotations

from typing import Any, Callable

from fastapi import Depends, HTTPException, Query
from fastapi.responses import JSONResponse, Response
from google.genai import types as gtypes

from .adk_artifact_io import part_to_bytes_and_mime, part_to_json_payload
from .auth import require_user


def register_artifact_routes(
    app,
    *,
    app_name: str | Callable[[], str],
    get_artifact_service: Callable[[], Any],
    get_session_service: Callable[[], Any],
) -> None:
    """GET /v1/sessions/{session_id}/artifacts[/{filename}] を登録する."""

    def _app_name() -> str:
        return app_name() if callable(app_name) else app_name

    async def _assert_session_owner(
        session_id: str,
        user_id: str,
        *,
        organization_id: str,
        space_id: str,
    ) -> None:
        session_service = get_session_service()
        get_kwargs: dict[str, Any] = {
            "app_name": _app_name(),
            "user_id": user_id,
            "session_id": session_id,
            "organization_id": organization_id,
            "space_id": space_id,
        }
        session = await session_service.get_session(**get_kwargs)
        if session is None:
            raise HTTPException(status_code=404, detail="session not found")

    @app.get("/v1/sessions/{session_id}/artifacts")
    async def list_session_artifacts(
        session_id: str,
        organizationId: str = Query(..., min_length=1),
        spaceId: str = Query(..., min_length=1),
        user: dict[str, Any] = Depends(require_user),
    ) -> JSONResponse:
        user_id = user.get("uid") or ""
        await _assert_session_owner(
            session_id,
            user_id,
            organization_id=organizationId,
            space_id=spaceId,
        )

        artifact_service = get_artifact_service()
        if artifact_service is None:
            return JSONResponse({"artifacts": []})

        keys = await artifact_service.list_artifact_keys(
            app_name=_app_name(),
            user_id=user_id,
            session_id=session_id,
        )
        items: list[dict[str, Any]] = []
        for filename in keys:
            version_info = await artifact_service.get_artifact_version(
                app_name=_app_name(),
                user_id=user_id,
                filename=filename,
                session_id=session_id,
            )
            if version_info is None:
                continue
            meta = dict(version_info.custom_metadata or {})
            kind = meta.get("kind")
            item: dict[str, Any] = {
                "filename": filename,
                "version": version_info.version,
                "mime_type": version_info.mime_type,
                "custom_metadata": meta,
            }
            if isinstance(kind, str):
                item["kind"] = kind
            title = meta.get("title")
            if isinstance(title, str):
                item["title"] = title
            items.append(item)

        items.sort(key=lambda x: x.get("filename", ""))
        return JSONResponse({"artifacts": items})

    @app.get("/v1/sessions/{session_id}/artifacts/{filename:path}", response_model=None)
    async def load_session_artifact(
        session_id: str,
        filename: str,
        organizationId: str = Query(..., min_length=1),
        spaceId: str = Query(..., min_length=1),
        version: int | None = Query(default=None),
        format: str | None = Query(default=None, alias="format"),
        user: dict[str, Any] = Depends(require_user),
    ):
        user_id = user.get("uid") or ""
        await _assert_session_owner(
            session_id,
            user_id,
            organization_id=organizationId,
            space_id=spaceId,
        )

        artifact_service = get_artifact_service()
        if artifact_service is None:
            raise HTTPException(status_code=503, detail="artifact service unavailable")

        part: gtypes.Part | None = await artifact_service.load_artifact(
            app_name=_app_name(),
            user_id=user_id,
            filename=filename,
            session_id=session_id,
            version=version,
        )
        if part is None:
            raise HTTPException(status_code=404, detail="artifact not found")

        version_info = await artifact_service.get_artifact_version(
            app_name=_app_name(),
            user_id=user_id,
            filename=filename,
            session_id=session_id,
            version=version,
        )
        resolved_version = version_info.version if version_info else (version or 0)
        meta = dict(version_info.custom_metadata or {}) if version_info else {}

        if format == "json":
            return JSONResponse(
                part_to_json_payload(
                    part,
                    filename=filename,
                    version=resolved_version,
                    custom_metadata=meta,
                )
            )

        body, mime = part_to_bytes_and_mime(part)
        return Response(content=body, media_type=mime)
