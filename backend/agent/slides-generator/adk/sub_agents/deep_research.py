"""Deep Research SubAgent — google_search で各 question の具体事例を調査.

phase1_8_braindump がユーザーに「どんなエピソードがありますか?」と聞き返すのは
NG (Agent が自分で調査すべき). このサブエージェントが google_search built-in
tool で:
    - 業界の代表的な企業名 / 数字 / 事例
    - 規制 / 標準 / 業界レポート
    - 競合プレーヤーや関連プロダクト
を集めて、調査メモを `output_key=deep_research_notes` で session.state に書き出す.

phase1_8_braindump がこの notes を受けて braindump 本文を組み立てる.

注意: ADK の制約で **built-in tool (google_search) は他の function tool と
混在させられない**. このエージェントは google_search のみを持つ.
"""
from __future__ import annotations

from typing import Optional

from .. import config
from ._helpers import try_import_adk, safe_genai_config


def build_deep_research_agent(model: Optional[str] = None):
    Agent, _Seq, _Loop, _AgentTool = try_import_adk()
    if Agent is None:
        return None

    try:
        from google.adk.tools import google_search  # type: ignore
    except ImportError:
        google_search = None  # type: ignore

    tools = [google_search] if google_search is not None else []

    _m = model or config.DEEP_RESEARCH_MODEL
    return Agent(
        model=_m,
        name="deep_research",
        description=(
            "Phase 1.8 の補助担当. questions[] の各 Q について web 検索で "
            "具体事例 (企業名 / 数値 / 規制 / 製品例 / 業界統計) を集め、"
            "調査メモを返す. ユーザーには絶対に質問しない."
        ),
        instruction=config.make_instruction_provider("deep_research"),
        tools=tools,
        generate_content_config=safe_genai_config(model=_m),
        output_key="deep_research_notes",
    )
