"""ADK Runner で root_agent を 1 turn 走らせる smoke test.

`python3 -m adk.tests.smoke_runner` で実行. 実 Gemini が必要 (mock fallback あり).
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_REPO = _HERE.parent.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(_REPO / ".env")
except ImportError:
    pass


async def main() -> int:
    from google.adk.runners import InMemoryRunner  # type: ignore
    from google.genai import types as gtypes  # type: ignore

    from adk.agent import root_agent

    if root_agent is None:
        print("[smoke] root_agent is None — ADK install を確認")
        return 1

    runner = InMemoryRunner(agent=root_agent, app_name="adk_smoke")
    # session を作る (API 違いがあるので存在チェック付き)
    session_svc = runner.session_service
    session = await session_svc.create_session(
        app_name="adk_smoke",
        user_id="osanai",
        session_id="local-smoke",
    )

    user_text = (
        "テーマ: ベアフットシューズ入門。"
        "趣旨: 靴ではなくプロセス。最初の14日でやることを並べる。"
        "対象スライド数 14。"
        "questions[] を立ててヒアリングを始めてください。"
    )

    content = gtypes.Content(role="user", parts=[gtypes.Part(text=user_text)])
    print("[smoke] sending first turn ...")
    n_events = 0
    n_text = 0
    last_text = ""
    async for event in runner.run_async(
        user_id="osanai",
        session_id="local-smoke",
        new_message=content,
    ):
        n_events += 1
        author = getattr(event, "author", "?")
        content_obj = getattr(event, "content", None)
        if content_obj and getattr(content_obj, "parts", None):
            for p in content_obj.parts:
                if getattr(p, "text", None):
                    last_text = p.text
                    n_text += 1
                    print(f"[{author}] {p.text[:200]}")
                fc = getattr(p, "function_call", None)
                if fc:
                    print(f"[{author}] call: {fc.name}({list((fc.args or {}).keys())[:5]})")
                fr = getattr(p, "function_response", None)
                if fr:
                    keys = list((fr.response or {}).keys())[:5]
                    print(f"[{author}] resp: {fr.name} keys={keys}")
        if n_events > 40:
            print("[smoke] event cap reached, stopping")
            break

    print(f"\n[smoke] total events={n_events}, text events={n_text}")
    print(f"[smoke] last text tail: {last_text[-200:]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
