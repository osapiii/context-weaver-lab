"""OneStop ADK run → SSE chunk stream (Research Agent 互換)."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, AsyncIterator

from google.adk.runners import Runner
from google.genai import types as gtypes

from .services import AdkServices

logger = logging.getLogger(__name__)


def event_to_sse_chunk(event: Any, *, artifacts: list[dict[str, Any]]) -> dict[str, Any]:
    """ADK Event をフロント転送用 SSE chunk JSON に変換する."""
    out: dict[str, Any] = {
        "type": "event",
        "author": getattr(event, "author", "system"),
        "ts": getattr(event, "timestamp", time.time()),
        "artifacts": artifacts,
    }
    actions = getattr(event, "actions", None)
    if actions is not None:
        state_delta = getattr(actions, "state_delta", None)
        if state_delta:
            try:
                if hasattr(state_delta, "model_dump"):
                    out["stateDelta"] = state_delta.model_dump(mode="json")
                elif isinstance(state_delta, dict):
                    out["stateDelta"] = state_delta
            except Exception:
                pass
    try:
        if hasattr(event, "is_final_response") and event.is_final_response():
            out["turnComplete"] = True
    except Exception:
        pass

    content = getattr(event, "content", None)
    if content is None:
        return out
    parts = getattr(content, "parts", None) or []
    text_chunks: list[str] = []
    for part in parts:
        t = getattr(part, "text", None)
        if t:
            text_chunks.append(t)
        fn_call = getattr(part, "function_call", None)
        if fn_call is not None:
            out["toolCall"] = {
                "name": getattr(fn_call, "name", "?"),
                "args": getattr(fn_call, "args", {}),
            }
        fn_resp = getattr(part, "function_response", None)
        if fn_resp is not None:
            out["toolResult"] = {
                "name": getattr(fn_resp, "name", "?"),
                "response": getattr(fn_resp, "response", {}),
            }
    if text_chunks:
        out["deltaText"] = "".join(text_chunks)
    return out


async def stream_session_run(
    *,
    runner: Runner,
    services: AdkServices,
    app_name: str,
    user_id: str,
    session_id: str,
    message: str,
    storage_client: Any | None = None,
) -> AsyncIterator[bytes]:
    """Runner.run_async を SSE バイト列に変換する."""
    user_message = gtypes.Content(
        role="user",
        parts=[gtypes.Part(text=message)],
    )

    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=user_message,
        ):
            payload = event_to_sse_chunk(event, artifacts=[])
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")
            await asyncio.sleep(0)
    except asyncio.CancelledError:
        logger.info("client disconnected mid-stream (session=%s)", session_id)
        raise
    except Exception as exc:
        logger.exception("runner failed (session=%s)", session_id)
        err_payload = {"type": "error", "message": str(exc)}
        yield f"data: {json.dumps(err_payload, ensure_ascii=False)}\n\n".encode("utf-8")
    finally:
        yield b"data: [DONE]\n\n"


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}
