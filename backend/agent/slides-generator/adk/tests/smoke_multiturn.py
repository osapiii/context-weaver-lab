"""multi-turn smoke test: ADK Runner で root_agent を複数 turn 回し、
transfer / tool call / artifact 登録 が機能することを確認する.

`python3 -m adk.tests.smoke_multiturn` で実行.

各 turn の応答 (text / function_call / function_response / transfer) を
1 行ずつ表示し、最後に登録された artifact 名のリストをダンプする.
"""
from __future__ import annotations

import asyncio
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


TURNS = [
    # 初回: 必要情報を全部詰め込む
    (
        "テーマ: ベアフットシューズ入門。"
        "趣旨: 靴ではなくプロセスです。最初の14日でやることを並べました。"
        "読者: ベアフットシューズを買おうとしている 30 代ランナー。"
        "目的: Before = ベアフットが気になっているがいきなり履けるか不安。"
        "After = 最初の 14 日でやる移行手順がイメージできて、足の準備を始められる。"
        "目標スライド数: 14。"
        "deck_type: learning-deck。"
        "questions[] を 5〜8 件立てて、承認用にまとめてください。"
    ),
    # 2 turn: questions 承認 + braindump 進行依頼
    "questions のリストで OK です。Phase 1.8 の braindump に進んでください。"
    "(braindump は手書きが間に合わないので、references 1-2 件 + Q1 だけ 300 字で書いて先に進めて構いません)",
    # 3 turn: braindump 承認 → Phase 2 へ
    "braindump はそれで OK です。Phase 2 の build_plan → SchemaQA → render へ進んでください。"
    "SchemaQA で fatal が出たら repair を最大 3 回回し、その後私に状況を報告してください。",
    # 4 turn: Phase 2 結果を見て、進めるかを判断
    "現状を簡潔に報告してください。plan.json と artifact 登録状況を教えてもらえれば次の判断ができます。",
]


async def main() -> int:
    from google.adk.runners import InMemoryRunner  # type: ignore
    from google.genai import types as gtypes  # type: ignore

    from adk.agent import root_agent

    if root_agent is None:
        print("[smoke] root_agent is None")
        return 1

    runner = InMemoryRunner(agent=root_agent, app_name="adk_smoke_mt")
    session_svc = runner.session_service
    artifact_svc = runner.artifact_service

    user_id, session_id = "osanai", "local-multiturn"
    await session_svc.create_session(
        app_name="adk_smoke_mt", user_id=user_id, session_id=session_id
    )

    for i, user_text in enumerate(TURNS, start=1):
        print(f"\n========== TURN {i} ==========")
        print(f"[user] {user_text[:160]}{'...' if len(user_text)>160 else ''}")
        content = gtypes.Content(role="user", parts=[gtypes.Part(text=user_text)])
        n_events = 0
        async for event in runner.run_async(
            user_id=user_id, session_id=session_id, new_message=content
        ):
            n_events += 1
            author = getattr(event, "author", "?")
            c = getattr(event, "content", None)
            if c and getattr(c, "parts", None):
                for p in c.parts:
                    if getattr(p, "text", None):
                        print(f"[{author}] {p.text[:200]}{'...' if len(p.text)>200 else ''}")
                    fc = getattr(p, "function_call", None)
                    if fc:
                        args_keys = list((fc.args or {}).keys())[:5]
                        print(f"[{author}] call: {fc.name}({args_keys})")
                    fr = getattr(p, "function_response", None)
                    if fr:
                        keys = list((fr.response or {}).keys())[:8] if isinstance(fr.response, dict) else []
                        print(f"[{author}] resp: {fr.name} keys={keys}")
            if n_events > 80:
                print(f"[{author}] (event cap reached)")
                break

    # Artifact 一覧
    print("\n========== ARTIFACTS ==========")
    try:
        names = await artifact_svc.list_artifact_keys(
            app_name="adk_smoke_mt", user_id=user_id, session_id=session_id
        )
        print(f"registered {len(names)} artifacts:")
        for n in names[:30]:
            print(f"  - {n}")
        if len(names) > 30:
            print(f"  ... +{len(names) - 30} more")
    except Exception as e:
        print(f"list_artifact_keys failed: {e}")

    # session state の主要キー
    print("\n========== SESSION STATE ==========")
    try:
        sess = await session_svc.get_session(
            app_name="adk_smoke_mt", user_id=user_id, session_id=session_id
        )
        st = sess.state if sess else {}
        for k in (
            "deck_id", "deck_dir", "plan_path", "pptx_path", "narration_path",
            "phase1_questions_approved", "phase1_8_braindump_approved",
            "schema_qa_passed", "writing_qa_passed",
        ):
            if k in st:
                v = str(st[k])
                print(f"  {k}: {v[:160]}")
    except Exception as e:
        print(f"get_session failed: {e}")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
