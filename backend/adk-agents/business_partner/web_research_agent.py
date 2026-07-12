"""google_search 専用 SubAgent — consultation と同型."""
from __future__ import annotations

from typing import Any

WEB_RESEARCH_INSTRUCTION = """\
あなたは EN AIstudio 取引先マスタ登録の **Web 調査担当** です.

## 役割
親 Agent から渡された調査依頼について、google_search で公開 Web 情報を収集し、
**事実ベースの調査メモ** を返します.

## 調査対象
- 公式 Web サイトの会社概要・代表者・所在地・連絡先
- 商号・法人番号の裏取り (可能な場合)
- 業種・従業員規模・設立年など公開情報

## 出力形式 (Markdown)
1. **調査クエリ** — 何を検索したか 1 行
2. **要点** — 箇条書き 5-12 件 (数値・固有名詞を含める)
3. **参考 URL** — 信頼できそうな URL を最大 8 件 (タイトル付き)
4. **注意** — 推測・古い情報は明示

## 禁止
- ユーザーへの追加質問
- 出典 URL なしの数値・固有名詞のでっち上げ
"""


def build_web_research_agent_tool(model: str) -> Any | None:
    try:
        from google.adk.agents.llm_agent import Agent  # type: ignore
        from google.adk.tools import google_search  # type: ignore
        from google.adk.tools.agent_tool import AgentTool  # type: ignore
    except ImportError:
        return None

    if google_search is None:
        return None

    try:
        sub_agent = Agent(
            model=model,
            name="business_partner_web_research",
            description=(
                "Web 検索で企業の公式 HP・会社概要・代表者・連絡先・業種を調査する."
            ),
            instruction=WEB_RESEARCH_INSTRUCTION,
            tools=[google_search],
        )
        return AgentTool(agent=sub_agent)
    except Exception:
        return None
