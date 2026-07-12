"""Firestore-backed ADK BaseSessionService for en-aistudio-adk-agent.

Cloud Run の再起動 / オートスケール後も session.state / events を維持する.

Firestore layout:

    organizations/{organizationId}/spaces/{spaceId}/adkSessions/{sessionId}
      ├ uid: string
      ├ appName: string
      ├ organizationId: string
      ├ spaceId: string
      ├ title?: string
      ├ jobKind?: string
      ├ activeAgent?: string
      ├ createdAt: Timestamp
      ├ updatedAt: Timestamp
      ├ state: map            # en_ui, image_reference, grounding_metadata_by_response_id 等
      ├ status: string        # active | deleted
      └ events/{eventId}
           ├ author, timestamp, invocationId, payload
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Any, Optional

from google.cloud import firestore
from google.cloud.firestore import AsyncClient, SERVER_TIMESTAMP

from .firestore_multimodal import sanitize_event_dict_for_firestore
from .session_scope import SessionScope, resolve_session_scope

try:
    from google.adk.events.event import Event
    from google.adk.sessions.base_session_service import (
        BaseSessionService,
        GetSessionConfig,
        ListSessionsResponse,
    )
    from google.adk.sessions.session import Session
except ImportError as e:  # pragma: no cover
    raise RuntimeError(
        "google-adk が import できません。common/requirements.txt を確認してください。"
    ) from e

logger = logging.getLogger(__name__)

DEFAULT_SUBCOLLECTION = os.environ.get(
    "FIRESTORE_ADK_SESSIONS_COLLECTION", "adkSessions"
)


def _event_to_dict(event: Event) -> dict[str, Any]:
    try:
        payload = event.model_dump(mode="json", exclude_none=False)
    except Exception:
        return {"raw_repr": repr(event)}
    return sanitize_event_dict_for_firestore(payload)


def _dict_to_event(payload: dict[str, Any]) -> Event:
    try:
        return Event.model_validate(payload)
    except Exception:
        return Event(
            invocation_id=payload.get("invocationId")
            or payload.get("invocation_id")
            or "",
            author=payload.get("author", "system"),
        )


def _theme_from_state(state: dict[str, Any]) -> Any:
    theme = state.get("theme")
    if theme:
        return theme
    hearing = state.get("phase1_hearing_result")
    if isinstance(hearing, dict):
        return hearing.get("theme")
    return None


def denormalized_fields_from_envelope(state: dict[str, Any]) -> dict[str, Any]:
    """AI Studio 一覧用 — golden envelope (`session_meta`, `active_task`) のみ."""
    out: dict[str, Any] = {}
    meta = state.get("session_meta")
    if isinstance(meta, dict):
        title = meta.get("title")
        if isinstance(title, str) and title.strip():
            out["title"] = title.strip()
        status = meta.get("status")
        if isinstance(status, str) and status.strip():
            out["status"] = status.strip()
    active = state.get("active_task")
    if isinstance(active, str) and active.strip():
        task = active.strip()
        out["jobKind"] = task
        out["activeAgent"] = task
    return out


def denormalized_fields_from_state(state: dict[str, Any]) -> dict[str, Any]:
    """UI 一覧用: golden state から親 doc へ flatten するフィールド."""
    research = state.get("research")
    current_phase = state.get("current_phase")
    theme = _theme_from_state(state)
    deck_id = state.get("deck_id")
    if isinstance(research, dict):
        rp = research.get("current_phase") or research.get("phase")
        if isinstance(rp, str) and rp.strip():
            current_phase = rp.strip()
        setup = research.get("setup")
        rt = None
        if isinstance(setup, dict):
            rt = setup.get("theme")
        if not (isinstance(rt, str) and rt.strip()):
            rt = research.get("theme")
        if isinstance(rt, str) and rt.strip():
            theme = rt.strip()
        payload = research.get("payload")
        if isinstance(payload, dict) and payload.get("deck_id"):
            deck_id = payload.get("deck_id")
    fields: dict[str, Any] = {
        "theme": theme,
        "deckId": deck_id,
        "currentPhase": current_phase,
        "status": state.get("status", "active"),
    }
    fields.update(denormalized_fields_from_envelope(state))
    return fields


def denormalized_fields_from_doc(data: dict[str, Any]) -> dict[str, Any]:
    """Firestore 親 doc から API レスポンス用フィールドを取り出す."""
    state = dict(data.get("state") or {})
    flat = denormalized_fields_from_state(state)
    return {
        "theme": data.get("theme") if data.get("theme") is not None else flat["theme"],
        "deckId": data.get("deckId") if data.get("deckId") is not None else flat["deckId"],
        "currentPhase": (
            data.get("currentPhase")
            if data.get("currentPhase") is not None
            else flat["currentPhase"]
        ),
        "status": data.get("status") or flat["status"] or "active",
        "title": data.get("title") if data.get("title") is not None else flat.get("title"),
        "jobKind": data.get("jobKind") if data.get("jobKind") is not None else flat.get("jobKind"),
        "activeAgent": (
            data.get("activeAgent")
            if data.get("activeAgent") is not None
            else flat.get("activeAgent")
        ),
    }


def _session_to_doc(session: Session, *, scope: SessionScope) -> dict[str, Any]:
    state = dict(session.state or {})
    doc: dict[str, Any] = {
        "sessionId": session.id,
        "uid": session.user_id,
        "appName": session.app_name,
        "organizationId": scope.organization_id,
        "spaceId": scope.space_id,
        "state": state,
        "updatedAt": SERVER_TIMESTAMP,
        "lastUpdateTime": session.last_update_time,
    }
    doc.update(denormalized_fields_from_state(state))
    return doc


class FirestoreSessionService(BaseSessionService):
    """ADK session を org/space 配下 Firestore に永続化する."""

    def __init__(
        self,
        *,
        project_id: Optional[str] = None,
        collection: str = DEFAULT_SUBCOLLECTION,
        client: Optional[AsyncClient] = None,
    ):
        self._subcollection = collection
        self._client = client or AsyncClient(project=project_id)
        logger.info(
            "FirestoreSessionService initialized: project=%s subcollection=%s",
            self._client.project,
            collection,
        )

    def _scope_from_session(self, session: Session) -> SessionScope:
        return resolve_session_scope(state=dict(session.state or {}))

    def _sessions_collection(self, scope: SessionScope):
        return (
            self._client.collection("organizations")
            .document(scope.organization_id)
            .collection("spaces")
            .document(scope.space_id)
            .collection(self._subcollection)
        )

    def _doc_ref(self, scope: SessionScope, session_id: str):
        return self._sessions_collection(scope).document(session_id)

    def _events_ref(self, scope: SessionScope, session_id: str):
        return self._doc_ref(scope, session_id).collection("events")

    async def _load_events(
        self,
        scope: SessionScope,
        session_id: str,
        *,
        config: Optional[GetSessionConfig] = None,
    ) -> list[Event]:
        q = self._events_ref(scope, session_id).order_by("timestamp")
        after_ts = getattr(config, "after_timestamp", None) if config else None
        if after_ts is not None:
            q = q.where("timestamp", ">", after_ts)
        events: list[Event] = []
        async for snap in q.stream():
            payload = snap.to_dict() or {}
            events.append(_dict_to_event(payload.get("payload") or payload))
        if config is not None:
            num = getattr(config, "num_recent_events", None)
            if num is not None:
                if num == 0:
                    return []
                if len(events) > num:
                    events = events[-num:]
        return events

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: Optional[dict[str, Any]] = None,
        session_id: Optional[str] = None,
        organization_id: str | None = None,
        space_id: str | None = None,
    ) -> Session:
        state_dict = dict(state or {})
        scope = resolve_session_scope(
            organization_id=organization_id,
            space_id=space_id,
            state=state_dict,
        )
        state_dict.setdefault("organization_id", scope.organization_id)
        state_dict.setdefault("space_id", scope.space_id)

        sid = (session_id or "").strip() or uuid.uuid4().hex
        now = time.time()
        session = Session(
            id=sid,
            app_name=app_name,
            user_id=user_id,
            state=state_dict,
            events=[],
            last_update_time=now,
        )
        doc = _session_to_doc(session, scope=scope)
        doc["createdAt"] = SERVER_TIMESTAMP
        await self._doc_ref(scope, sid).set(doc)
        logger.info(
            "adk session created: %s org=%s space=%s uid=%s app=%s",
            sid,
            scope.organization_id,
            scope.space_id,
            user_id,
            app_name,
        )
        return session

    def _resolve_get_session_scope(
        self,
        *,
        session_id: str,
        organization_id: str | None,
        space_id: str | None,
    ) -> SessionScope:
        try:
            return resolve_session_scope(
                organization_id=organization_id,
                space_id=space_id,
            )
        except ValueError:
            from .invoke_session_scope import get_invoke_session_scope_for_id

            mapped = get_invoke_session_scope_for_id(session_id)
            if mapped is not None:
                return mapped
            raise

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        organization_id: str | None = None,
        space_id: str | None = None,
        config: Optional[GetSessionConfig] = None,
    ) -> Optional[Session]:
        scope = self._resolve_get_session_scope(
            session_id=session_id,
            organization_id=organization_id,
            space_id=space_id,
        )
        snap = await self._doc_ref(scope, session_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        if data.get("uid") != user_id or data.get("appName") != app_name:
            logger.warning(
                "adk session ownership mismatch: id=%s expected uid=%s app=%s",
                session_id,
                user_id,
                app_name,
            )
            return None
        if data.get("status") == "deleted":
            return None
        events = await self._load_events(scope, session_id, config=config)
        return Session(
            id=session_id,
            app_name=app_name,
            user_id=user_id,
            state=dict(data.get("state") or {}),
            events=events,
            last_update_time=float(data.get("lastUpdateTime") or 0.0),
        )

    async def list_sessions(
        self,
        *,
        app_name: str,
        user_id: Optional[str] = None,
        organization_id: str | None = None,
        space_id: str | None = None,
    ) -> ListSessionsResponse:
        scope = resolve_session_scope(
            organization_id=organization_id,
            space_id=space_id,
        )
        q = self._sessions_collection(scope).where("appName", "==", app_name)
        if user_id is not None:
            q = q.where("uid", "==", user_id)
        q = q.order_by("updatedAt", direction=firestore.Query.DESCENDING).limit(100)
        sessions: list[Session] = []
        async for snap in q.stream():
            data = snap.to_dict() or {}
            if data.get("status") == "deleted":
                continue
            sessions.append(
                Session(
                    id=snap.id,
                    app_name=app_name,
                    user_id=data.get("uid") or user_id or "",
                    state=dict(data.get("state") or {}),
                    events=[],
                    last_update_time=float(data.get("lastUpdateTime") or 0.0),
                )
            )
        return ListSessionsResponse(sessions=sessions)

    async def delete_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        organization_id: str | None = None,
        space_id: str | None = None,
    ) -> None:
        scope = resolve_session_scope(
            organization_id=organization_id,
            space_id=space_id,
        )
        ref = self._doc_ref(scope, session_id)
        snap = await ref.get()
        if not snap.exists:
            return
        data = snap.to_dict() or {}
        if data.get("uid") != user_id or data.get("appName") != app_name:
            raise PermissionError(
                f"session {session_id} は uid={user_id} / app={app_name} の所有ではありません"
            )
        await ref.set(
            {"status": "deleted", "updatedAt": SERVER_TIMESTAMP},
            merge=True,
        )
        logger.info("adk session deleted (logical): %s", session_id)

    async def clear_session_events(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        organization_id: str | None = None,
        space_id: str | None = None,
    ) -> int:
        """ADK events サブコレクションを削除 (session.state は保持)."""
        scope = self._resolve_get_session_scope(
            session_id=session_id,
            organization_id=organization_id,
            space_id=space_id,
        )
        snap = await self._doc_ref(scope, session_id).get()
        if not snap.exists:
            return 0
        data = snap.to_dict() or {}
        if data.get("uid") != user_id or data.get("appName") != app_name:
            raise PermissionError(
                f"session {session_id} は uid={user_id} / app={app_name} の所有ではありません"
            )
        deleted = 0
        ev_ref = self._events_ref(scope, session_id)
        async for doc in ev_ref.stream():
            await doc.reference.delete()
            deleted += 1
        if deleted:
            logger.info(
                "adk session events cleared: %s count=%s org=%s space=%s",
                session_id,
                deleted,
                scope.organization_id,
                scope.space_id,
            )
        return deleted

    async def append_event(self, session: Session, event: Event) -> Event:
        if event.partial:
            return event

        scope = self._scope_from_session(session)

        self._apply_temp_state(session, event)
        event = self._trim_temp_delta_state(event)
        self._update_session_state(session, event)

        ts = event.timestamp or time.time()
        event_doc = {
            "author": event.author,
            "invocationId": getattr(event, "invocation_id", None),
            "timestamp": ts,
            "payload": _event_to_dict(event),
        }
        ev_ref = self._events_ref(scope, session.id)
        if getattr(event, "id", None):
            await ev_ref.document(event.id).set(event_doc)
        else:
            await ev_ref.add(event_doc)

        session.last_update_time = ts
        doc = _session_to_doc(session, scope=scope)
        await self._doc_ref(scope, session.id).set(doc, merge=True)
        session.events.append(event)
        return event

    async def patch_session_state(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        state_patch: dict[str, Any],
        organization_id: str | None = None,
        space_id: str | None = None,
    ) -> None:
        """Runner 実行前/後に server が state を直接更新する."""
        if not state_patch:
            return
        scope = resolve_session_scope(
            organization_id=organization_id,
            space_id=space_id,
            state=state_patch,
        )
        session = await self.get_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            organization_id=scope.organization_id,
            space_id=scope.space_id,
        )
        if session is None:
            await self.create_session(
                app_name=app_name,
                user_id=user_id,
                session_id=session_id,
                state=state_patch,
                organization_id=scope.organization_id,
                space_id=scope.space_id,
            )
            return
        merged = dict(session.state or {})
        merged.update(state_patch)
        patch_doc = {
            "state": merged,
            "updatedAt": SERVER_TIMESTAMP,
            "lastUpdateTime": time.time(),
        }
        patch_doc.update(denormalized_fields_from_state(merged))
        await self._doc_ref(scope, session_id).set(patch_doc, merge=True)

    async def patch_session_envelope(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        organization_id: str,
        space_id: str,
        envelope: dict[str, Any],
    ) -> None:
        """Golden envelope (`transcript`, `session_meta`, `active_task`, …) を merge."""
        if not envelope:
            return
        await self.patch_session_state(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            organization_id=organization_id,
            space_id=space_id,
            state_patch=dict(envelope),
        )

    async def get_session_state(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        organization_id: str | None = None,
        space_id: str | None = None,
    ) -> dict[str, Any]:
        session = await self.get_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            organization_id=organization_id,
            space_id=space_id,
        )
        if session is None:
            return {}
        return dict(session.state or {})

    async def get_parent_doc_fields(
        self,
        session_id: str,
        *,
        organization_id: str,
        space_id: str,
    ) -> dict[str, Any]:
        """Firestore 親 doc の denormalized フィールド."""
        scope = SessionScope(organization_id=organization_id, space_id=space_id)
        snap = await self._doc_ref(scope, session_id).get()
        if not snap.exists:
            return {}
        return denormalized_fields_from_doc(snap.to_dict() or {})

    def _artifacts_ref(self, scope: SessionScope, session_id: str):
        return self._doc_ref(scope, session_id).collection("artifacts")

    async def patch_artifact_message_link(
        self,
        *,
        session_id: str,
        organization_id: str,
        space_id: str,
        artifact_id: str,
        message_id: str | None = None,
        response_id: str | None = None,
    ) -> None:
        """Link en_ui message to Firestore artifacts/{artifactId} (optional)."""
        if not artifact_id.strip():
            return
        scope = SessionScope(
            organization_id=organization_id.strip(),
            space_id=space_id.strip(),
        )
        patch: dict[str, Any] = {"updatedAt": SERVER_TIMESTAMP}
        if message_id and message_id.strip():
            patch["messageId"] = message_id.strip()
        if response_id and response_id.strip():
            patch["responseId"] = response_id.strip()
        if len(patch) <= 1:
            return
        await self._artifacts_ref(scope, session_id).document(artifact_id).set(
            patch, merge=True
        )
