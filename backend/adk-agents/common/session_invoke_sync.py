"""Invoke 中に Firestore session.state ゴールデンエンベロープを更新し FE onSnapshot と同期する."""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from .en_session_state_io import (
    read_active_task,
    read_grounding_by_response_id,
    read_session_meta,
    read_transcript,
)
from .session_state import read_session_state
from .adk_tool_activities import upsert_tool_activity

logger = logging.getLogger(__name__)

_TEXT_FLUSH_INTERVAL_SEC = 0.35


def _now_ms() -> int:
    return int(time.time() * 1000)


def _history_to_messages(history: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for turn in history:
        role = getattr(turn, "role", None) or (
            turn.get("role") if isinstance(turn, dict) else None
        )
        text = getattr(turn, "text", None) or (
            turn.get("text") if isinstance(turn, dict) else ""
        )
        if role not in ("user", "model") or not isinstance(text, str):
            continue
        out.append(
            {
                "id": f"hist_{len(out)}_{uuid.uuid4().hex[:8]}",
                "role": "user" if role == "user" else "assistant",
                "text": text,
                "createdAt": _now_ms(),
            }
        )
    return out


class SessionInvokeSync:
    """Throttled golden envelope patch during ADK invoke streaming."""

    def __init__(
        self,
        *,
        session_service: Any,
        app_name: str,
        user_id: str,
        session_id: str,
        organization_id: str,
        space_id: str,
        response_id: str | None,
        agent_mode: str,
        mode_state: dict[str, Any] | None = None,
    ) -> None:
        self._session_service = session_service
        self._app_name = app_name
        self._user_id = user_id
        self._session_id = session_id
        self._organization_id = organization_id
        self._space_id = space_id
        self._response_id = (response_id or "").strip() or None
        self._agent_mode = agent_mode
        self._mode_state = dict(mode_state or {})
        self._transcript: list[dict[str, Any]] = []
        self._session_meta: dict[str, Any] = {"title": "", "status": "active"}
        self._active_task: str = agent_mode
        self._grounding_by_response_id: dict[str, Any] = {}
        self._assistant_index: int | None = None
        self._last_flush = 0.0
        self._dirty = False
        self._enabled = bool(organization_id.strip() and space_id.strip())

    async def bootstrap_from_request(
        self,
        *,
        prompt: str,
        history: list[Any],
    ) -> None:
        if not self._enabled:
            return
        stored = await read_session_state(
            self._session_service,
            app_name=self._app_name,
            user_id=self._user_id,
            session_id=self._session_id,
            organization_id=self._organization_id,
            space_id=self._space_id,
        )
        self._transcript = [
            dict(m) for m in read_transcript(stored) if isinstance(m, dict)
        ]
        self._session_meta = read_session_meta(stored)
        self._grounding_by_response_id = read_grounding_by_response_id(stored)
        active = read_active_task(stored)
        if active:
            self._active_task = active
        elif self._mode_state.get("active_mode"):
            self._active_task = str(self._mode_state["active_mode"])
        else:
            self._active_task = self._agent_mode

        messages = _history_to_messages(history)
        if not messages and self._transcript:
            messages = list(self._transcript)
        user_text = (prompt or "").strip()
        if user_text:
            if (
                not messages
                or messages[-1].get("role") != "user"
                or messages[-1].get("text") != user_text
            ):
                messages.append(
                    {
                        "id": f"user_{uuid.uuid4().hex[:12]}",
                        "role": "user",
                        "text": user_text,
                        "createdAt": _now_ms(),
                    }
                )
        rid = self._response_id or f"asst_{uuid.uuid4().hex[:12]}"
        self._response_id = rid
        self._assistant_index = len(messages)
        messages.append(
            {
                "id": rid,
                "role": "assistant",
                "text": "",
                "createdAt": _now_ms(),
                "isStreaming": True,
                "agent": self._agent_mode,
                "artifacts": [],
                "activities": [],
            }
        )
        self._transcript = messages
        self._dirty = True
        await self._flush(force=True)

    def _assistant_msg(self) -> dict[str, Any] | None:
        if self._assistant_index is None:
            return None
        if self._assistant_index >= len(self._transcript):
            return None
        msg = self._transcript[self._assistant_index]
        return msg if isinstance(msg, dict) else None

    async def append_text_delta(self, *, text: str) -> None:
        if not self._enabled or not text:
            return
        msg = self._assistant_msg()
        if msg is None:
            return
        msg["text"] = str(msg.get("text") or "") + text
        self._dirty = True
        await self._flush(force=False)

    async def add_activity(self, *, name: str, status: str) -> None:
        if not self._enabled:
            return
        msg = self._assistant_msg()
        if msg is None:
            return
        activities = msg.get("activities")
        if not isinstance(activities, list):
            activities = []
            msg["activities"] = activities
        upsert_tool_activity(activities, name=name, status=status)
        self._dirty = True
        await self._flush(force=True)

    async def append_artifact(self, *, artifact: dict[str, Any]) -> None:
        if not self._enabled or not artifact.get("kind"):
            return
        msg = self._assistant_msg()
        if msg is None:
            return
        artifacts = msg.get("artifacts")
        if not isinstance(artifacts, list):
            artifacts = []
            msg["artifacts"] = artifacts
        artifacts.append(dict(artifact))
        self._dirty = True
        await self._flush(force=True)

    async def patch_image_primary(self, *, primary: dict[str, Any]) -> None:
        if not self._enabled:
            return
        filename = primary.get("adk_filename") or primary.get("adkFilename")
        if not isinstance(filename, str) or not filename.strip():
            return
        primary_patch: dict[str, Any] = {"adk_filename": filename.strip()}
        artifact_id_val = primary.get("artifact_id") or primary.get("artifactId")
        if isinstance(artifact_id_val, str) and artifact_id_val.strip():
            primary_patch["artifact_id"] = artifact_id_val.strip()
        version = primary.get("version")
        if version is None:
            version = primary.get("artifactVersion")
        if isinstance(version, int):
            primary_patch["version"] = version
        state_patch: dict[str, Any] = {}
        patch_task_bucket(state_patch, "image", {"primary": primary_patch})
        self._dirty = True
        await self._patch_task_buckets(state_patch)
        await self._flush(force=True)

    async def patch_writing_bucket(self, *, bucket: dict[str, Any]) -> None:
        if not self._enabled or not bucket:
            return
        writing_patch: dict[str, Any] = {}
        phase = bucket.get("writing_phase") or bucket.get("phase")
        if phase in ("format_review", "filling", "done"):
            writing_patch["phase"] = phase
        form = bucket.get("writing_form") or bucket.get("form")
        if isinstance(form, dict):
            writing_patch["payload"] = {"form": dict(form)}
        ref = bucket.get("writing_reference") or bucket.get("reference")
        if isinstance(ref, dict):
            writing_patch.setdefault("setup", {})
            if isinstance(writing_patch["setup"], dict):
                writing_patch["setup"]["reference"] = dict(ref)
        state_patch: dict[str, Any] = {}
        patch_task_bucket(state_patch, "writing", writing_patch)
        await self._patch_task_buckets(state_patch)
        self._dirty = True
        await self._flush(force=True)

    async def merge_grounding(
        self, *, grounding: dict[str, Any], response_id: str | None = None
    ) -> None:
        if not self._enabled:
            return
        rid = (response_id or self._response_id or "").strip()
        if not rid:
            return
        existing = self._grounding_by_response_id.get(rid)
        if isinstance(existing, dict):
            merged = dict(existing)
            merged.update(grounding)
            self._grounding_by_response_id[rid] = merged
        else:
            self._grounding_by_response_id[rid] = dict(grounding)
        msg = self._assistant_msg()
        if msg is not None:
            msg["groundingMetadata"] = self._grounding_by_response_id[rid]
        self._dirty = True
        await self._flush(force=True)

    async def apply_mode_change(self, *, mode: str, reason: str | None = None) -> None:
        if not self._enabled:
            return
        self._active_task = mode
        msg = self._assistant_msg()
        if msg is not None:
            msg["agent"] = mode
        self._dirty = True
        await self._flush(force=True)

    async def finalize_turn(self, *, error_message: str | None = None) -> None:
        if not self._enabled:
            return
        msg = self._assistant_msg()
        if msg is not None:
            msg["isStreaming"] = False
            msg["completedAt"] = _now_ms()
            if error_message:
                msg["text"] = (
                    str(msg.get("text") or "")
                    + f"\n\n⚠️ {error_message.strip()}"
                )
        self._dirty = True
        await self._flush(force=True)

    async def _patch_task_buckets(self, state_patch: dict[str, Any]) -> None:
        if not state_patch:
            return
        try:
            await self._session_service.patch_session_state(
                app_name=self._app_name,
                user_id=self._user_id,
                session_id=self._session_id,
                organization_id=self._organization_id,
                space_id=self._space_id,
                state_patch=state_patch,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "task bucket patch failed session=%s: %s", self._session_id, exc
            )

    async def _flush(self, *, force: bool) -> None:
        if not self._enabled or not self._dirty:
            return
        now = time.monotonic()
        if not force and (now - self._last_flush) < _TEXT_FLUSH_INTERVAL_SEC:
            return
        self._dirty = False
        self._last_flush = now
        envelope: dict[str, Any] = {
            "transcript": list(self._transcript),
            "session_meta": dict(self._session_meta),
            "active_task": self._active_task,
        }
        if self._grounding_by_response_id:
            envelope["grounding_by_response_id"] = dict(
                self._grounding_by_response_id
            )
        try:
            await self._session_service.patch_session_envelope(
                app_name=self._app_name,
                user_id=self._user_id,
                session_id=self._session_id,
                organization_id=self._organization_id,
                space_id=self._space_id,
                envelope=envelope,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "session envelope patch failed session=%s: %s",
                self._session_id,
                exc,
            )
