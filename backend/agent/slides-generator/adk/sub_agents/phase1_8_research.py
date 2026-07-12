"""Phase 1.8 — Research SubAgent (旧: braindump).

questions[] への解答集を **Gemini structured output で research.json として直接出力** する.
deep_research を AgentTool として持ち、web 調査は別リクエスト経由で呼ぶ.

設計の経緯:
    Gemini API は `google_search` (built-in tool) と function calling
    (transfer_to_agent 含む) を同一リクエストに混在できない. そのため
    deep_research を sub_agent (transfer) で繋ぐと 400 になる. 解決策として
    deep_research を AgentTool でラップし、別リクエスト経由で呼ぶ.

    本フェーズは 2026-05 大胆刷新で「散文 md → 自動 parse」を廃止し、
    LLM が Pydantic schema 準拠の json を **直接** 出力する方式に変更.
    save_research_tool が Pydantic で validate → 型違反は agent に再出力依頼.
"""
from __future__ import annotations

from typing import Optional

from .. import config
from ..agent_tools import save_research_tool
from .deep_research import build_deep_research_agent
from ._helpers import safe_genai_config, try_import_adk, vertex_search_tools


def build_phase1_8_research_agent(
    model: Optional[str] = None,
    *,
    datastore_path: str | None = None,
):
    Agent, _Seq, _Loop, AgentTool = try_import_adk()
    if Agent is None:
        return None

    # tools 構成:
    #   - save_research_tool: research.json 永続化
    #   - deep_research (AgentTool wrap): web 検索 (google_search built-in tool)
    tools: list = [save_research_tool, *vertex_search_tools(datastore_path)]
    if AgentTool is not None:
        deep_research = build_deep_research_agent()
        if deep_research is not None:
            try:
                tools.append(AgentTool(agent=deep_research))
            except Exception:
                pass

    _m = model or config.RESEARCH_MODEL
    return Agent(
        model=_m,
        name="phase1_8_research",
        description=(
            "**Phase 1.8 — Research (対話あり)**. questions[] への解答集を、"
            "deep_research tool (google_search) で web 調査しつつ、"
            "Gemini structured output で **research.json を直接出力**する. "
            "出力は Pydantic Research schema 準拠 (sections[] + svg_spec[] + references[]). "
            "save_research_tool で validate + 永続化 → ユーザー承認をもらうまでが責務. "
            "承認後の SVG 生成 + HTML 化は Coordinator が atomic tool を 1 個ずつ呼ぶ都度承認モード."
        ),
        instruction=config.make_instruction_provider("phase1_8_research"),
        tools=tools,
        generate_content_config=safe_genai_config(model=_m),
        output_key="phase1_8_research_result",
    )


# 旧名 alias (Task 移行中の互換用)
build_phase1_8_braindump_agent = build_phase1_8_research_agent
