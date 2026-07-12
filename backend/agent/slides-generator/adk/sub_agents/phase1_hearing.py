"""Phase 1 — Hearing SubAgent.

読者・目的・分量・テーマ + questions[] (2-15 件) を聞き出し、ユーザー承認後に
session.state へ記録する.
"""
from __future__ import annotations

from typing import Optional

from .. import config
from ..agent_tools import ensure_deck_dir_tool
from ._helpers import safe_genai_config, try_import_adk, vertex_search_tools


def build_phase1_hearing_agent(
    model: Optional[str] = None,
    *,
    datastore_path: str | None = None,
):
    """Phase 1 hearing — 対話と deck_dir 確保だけを担当.

    questions[] の永続化は意図的に tool で持たせない:
      flash 系モデルは長い JSON 文字列引数を取る tool 呼び出しで
      MALFORMED_FUNCTION_CALL を頻発するため. questions[] は agent の
      最終 text 応答に embed され、`output_key=phase1_hearing_result`
      で session.state に自動保存される. 後続 Phase はこの state を
      参照する.
    """
    Agent, _Seq, _Loop, _AgentTool = try_import_adk()
    if Agent is None:
        return None
    tools: list = [ensure_deck_dir_tool, *vertex_search_tools(datastore_path)]
    _m = model or config.HEARING_MODEL
    return Agent(
        model=_m,
        name="phase1_hearing",
        description=(
            "**Phase 1 — ヒアリング**. 読者・目的・分量・テーマと "
            "questions[] (2-15 件) を対話で確定する."
        ),
        instruction=config.make_instruction_provider("phase1_hearing"),
        tools=tools,
        generate_content_config=safe_genai_config(model=_m),
        output_key="phase1_hearing_result",
    )
