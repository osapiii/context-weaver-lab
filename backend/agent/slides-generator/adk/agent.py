"""adk.agent — Multi-Agent Orchestrator (ADK web / API のエントリポイント).

構成:

    root_agent (LlmAgent, "enostech_coordinator")
      │
      ├── sub_agents (transfer; ユーザー対話あり)
      │     ├── phase1_hearing       — 読者・目的・questions[] 合意形成
      │     └── phase1_8_braindump   — 深堀調査 + braindump.md 確認
      │
      └── tools (Coordinator が 1 個ずつ呼ぶ atomic tool 群 = 都度承認モード)
            ├── 補助:  show_backend_status / list_deck_artifacts / save_braindump / update_progress
            ├── Phase 2:  build_plan / validate_structure / run_schema_qa /
            │             render_pptx_strict / repair_plan
            ├── Phase 3:  run_svg_pass / render_pptx / build_narration /
            │             pptx_to_images / build_contact_sheet /
            │             analyze_visual_qa / repair_plan_from_visual_qa
            └── Phase 4:  run_writing_qa / build_deck_package

動作モード (都度承認モード):
    Phase 1 / 1.8 は sub_agent transfer で対話的に進行. ユーザーが braindump.md を
    承認したら Coordinator が Phase 2-4 の atomic tool を **1 個ずつ呼ぶ**.
    各 tool 後に Coordinator は結果を要約して text only で user に floor を返す.
    user (or App 層の自動「次へ」) で進行が再開する.

    過去試した「workflow agent (AgentTool) で一気通貫」「自律 atomic 連打」は
    LLM のサボり + ADK の SSE event 仕様で挙動が読めずに収束しなかったため、
    都度承認モードに着地. App 層が自動「次へ」を送れば実質自律稼動になる.

    進捗は session.state.progress / progress_history / job_log に逐次 push
    (詳細: docs/STATE_SCHEMA.md).

実装の依存:
    - LLM (plan 生成 / QA repair): google-genai + Gemini API
    - レンダリング / QA / package: skills/enostech-slides v12 の Node + Python script を subprocess

ADK が未インストールな環境 (CI / オフライン) では `root_agent = None` になる.
そのときも `agent_tools/` は素の Python から import / 呼び出し可能.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# adk/ を sys.path に通す (ADK web からも CLI からも同じ resolution)
_HERE = Path(__file__).resolve().parent
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))

# .env を auto-load
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(_HERE.parent / ".env")
except ImportError:
    pass

from . import config  # noqa: E402
from .auth import detect_backend, describe_backend  # noqa: E402
from .agent_tools import (  # noqa: E402
    # 共通 (Coordinator 自身も使う)
    list_deck_artifacts_tool,
    update_progress_tool,
    # 2026-05 大胆刷新: research.{json,html} 一級成果物パイプライン
    save_research_tool,         # phase1_8 完了時に research.json を validate + 永続化
    generate_svgs_tool,         # post-step 1: svg_spec → svg_asset
    build_research_html_tool,   # post-step 2: research.json → research.html (Notion 風)
)
from .agent_tools.research_plan_tools import save_research_plan_draft  # noqa: E402
from .sub_agents import (  # noqa: E402
    build_phase1_hearing_agent,
    build_phase1_8_research_agent,
)


def show_backend_status() -> dict:
    """現在の Gemini backend 種別を返す (デバッグ用 tool)."""
    info = detect_backend(config.DEFAULT_MODEL)
    return {
        "backend": info["backend"],
        "model": info["model"],
        "project": info.get("project"),
        "location": info.get("location"),
        "reason": info["reason"],
        "summary": describe_backend(),
        "skill_root": str(config.SKILL_ROOT),
        "deck_out_dir": str(config.DECK_OUT_DIR),
    }


def _make_root_agent(datastore_path: str | None = None):
    """都度承認モードの Coordinator を組み立てる.

    2026-05 大胆刷新: PPTX 出力 (旧 Phase 2-4 / 18 tool) を全廃し、
    research.json + research.html (Notion 風読み物) 一級成果物に集約.

    sub_agents (transfer):
        phase1_hearing → phase1_8_research
    tools (atomic, Coordinator が 1 個ずつ呼ぶ / 都度承認モード):
        Phase 2 (SVG):  generate_svgs_tool       — svg_spec → svg_asset
        Phase 3 (HTML): build_research_html_tool — Notion 風 1 ファイル
        補助:           show_backend_status / list_deck_artifacts / save_research / update_progress
    """
    try:
        from google.adk.agents.llm_agent import Agent  # type: ignore
    except ImportError:
        return None

    sub_agents = [
        a for a in (
            build_phase1_hearing_agent(datastore_path=datastore_path),
            build_phase1_8_research_agent(datastore_path=datastore_path),
        ) if a is not None
    ]

    tools: list = [
        # 補助
        show_backend_status,
        list_deck_artifacts_tool,
        update_progress_tool,
        save_research_plan_draft,     # plan_only: HITL 用プラン素案
        # 新パイプライン: research.{json,html} 一級成果物
        save_research_tool,           # phase1_8 完了時に research.json を永続化
        generate_svgs_tool,           # post-step: svg_spec → svg_asset
        build_research_html_tool,     # post-step: research.html (Notion 風)
    ]

    # safe_genai_config: flash 系は thinking_budget=0 で MALFORMED_FUNCTION_CALL 防止,
    # pro-preview 系は thinking 必須なので config は default のまま (詳細: sub_agents/_helpers.py).
    from .sub_agents._helpers import safe_genai_config
    return Agent(
        model=config.COORDINATOR_MODEL,
        name="enostech_coordinator",
        description=(
            "Research レポート生成オーケストレータ. "
            "Phase 1 / 1.8 (ヒアリング + リサーチ) は sub_agent transfer で対話, "
            "ユーザー承認後は SVG → HTML の 2 step 都度承認モードで進行."
        ),
        instruction=config.make_instruction_provider("coordinator"),
        tools=tools,
        sub_agents=sub_agents,
        generate_content_config=safe_genai_config(model=config.COORDINATOR_MODEL),
    )


root_agent = _make_root_agent()
