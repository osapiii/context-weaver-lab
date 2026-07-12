"""SessionInvokeSync bootstrap."""
from __future__ import annotations

import asyncio

from common.session_invoke_sync import SessionInvokeSync, _history_to_messages


class _FakeSessionService:
    def __init__(self) -> None:
        self.envelopes: list[dict] = []

    async def patch_session_envelope(self, **kwargs):  # type: ignore[no-untyped-def]
        self.envelopes.append(kwargs)


def test_bootstrap_adds_user_and_assistant_messages():
    svc = _FakeSessionService()

    import common.session_invoke_sync as sync_mod

    original = sync_mod.read_session_state

    async def read_session_state(_session_service, **kwargs):  # type: ignore[no-untyped-def]
        return {
            "session_meta": {"title": "", "status": "active"},
            "active_task": "writing",
            "transcript": [],
        }

    sync_mod.read_session_state = read_session_state  # type: ignore[method-assign]
    try:
        sync = SessionInvokeSync(
            session_service=svc,
            app_name="en-aistudio-adk-agent",
            user_id="u1",
            session_id="s1",
            organization_id="org",
            space_id="sp",
            response_id="resp-1",
            agent_mode="writing",
        )
        asyncio.run(sync.bootstrap_from_request(prompt="hello", history=[]))
    finally:
        sync_mod.read_session_state = original  # type: ignore[method-assign]

    assert len(svc.envelopes) == 1
    envelope = svc.envelopes[0]["envelope"]
    messages = envelope["transcript"]
    assert messages[-2]["role"] == "user"
    assert messages[-2]["text"] == "hello"
    assert messages[-1]["role"] == "assistant"
    assert messages[-1]["id"] == "resp-1"
    assert messages[-1]["isStreaming"] is True
    assert envelope["active_task"] == "writing"


def test_history_to_messages_maps_roles():
    msgs = _history_to_messages(
        [{"role": "user", "text": "a"}, {"role": "model", "text": "b"}]
    )
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"
