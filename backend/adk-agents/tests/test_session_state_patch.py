"""Tests for InMemorySessionService state persistence."""
from __future__ import annotations

import asyncio

from google.adk.sessions import InMemorySessionService

from common.session_state import ensure_session_state, persist_session_state_patch


def test_ensure_session_state_persists_to_storage_on_existing_session():
    async def _run() -> None:
        service = InMemorySessionService()
        app_name = "en-aistudio-adk-agent"
        user_id = "user-1"
        session_id = "sess-1"

        await service.create_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            state={"file_space_id": "old"},
        )

        await ensure_session_state(
            service,
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            state_patch={
                "file_space_id": "default-xspfh3z713hk",
                "mode": "consultation",
            },
        )

        loaded = await service.get_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
        )
        assert loaded is not None
        assert loaded.state.get("file_space_id") == "default-xspfh3z713hk"
        assert loaded.state.get("mode") == "consultation"

    asyncio.run(_run())


def test_ensure_session_state_creates_session_with_initial_patch():
    async def _run() -> None:
        service = InMemorySessionService()
        app_name = "en-aistudio-adk-agent"
        user_id = "user-2"
        session_id = "sess-new"

        await ensure_session_state(
            service,
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            state_patch={"mode": "consultation"},
        )

        loaded = await service.get_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
        )
        assert loaded is not None
        assert loaded.state.get("mode") == "consultation"

    asyncio.run(_run())


def test_persist_session_state_patch_updates_canonical_storage():
    async def _run() -> None:
        service = InMemorySessionService()
        app_name = "en-aistudio-adk-agent"
        user_id = "user-3"
        session_id = "sess-3"

        await service.create_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            state={},
        )

        await persist_session_state_patch(
            service,
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            state_patch={"mode": "consultation"},
        )

        stored = service.sessions[app_name][user_id][session_id]
        assert stored.state.get("mode") == "consultation"

    asyncio.run(_run())
