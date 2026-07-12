"""Web 検索 SubAgent — google_search built-in を AgentTool で consultation に接続.

ADK 制約: google_search は FunctionTool と同一 agent に混在できないため、
google_search のみを持つ sub-agent を AgentTool として親 agent に載せる.
"""
from __future__ import annotations

from typing import Any

WEB_RESEARCH_INSTRUCTION = """\
あなたは EN AIstudio 経営相談 Agent 配下の **Web 調査担当** です.

## 役割
親 Agent から渡された調査依頼について、google_search で公開 Web 情報を収集し、
**事実ベースの調査メモ** を返します.

## 調査対象の例
- 企業の公式 Web サイト URL
- 会社概要・代表者・本社所在地など公開情報
- 業界統計・ニュース・規制情報
- 競合・市場動向の裏取り

## 出力形式 (Markdown)
1. **調査クエリ** — 何を検索したか 1 行
2. **要点** — 箇条書き 3-8 件 (数値・固有名詞を含める)
3. **参考 URL** — 信頼できそうな URL を最大 5 件 (タイトル付き)
4. **注意** — 情報が古い / 推測を含む場合は明示

## 禁止
- ユーザーへの追加質問 (調査依頼文だけで完結させる)
- 社内 FileSpace に無い情報を「社内資料にある」と断定しない
- 出典 URL なしの数値・固有名詞のでっち上げ
"""


def build_web_research_agent_tool(model: str) -> Any | None:
    """google_search 内蔵 sub-agent を AgentTool として返す. 不可なら None."""
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
            name="web_research",
            description=(
                "Web 検索で公開情報 (企業公式 HP, 業界記事, 統計, ニュース) を調査する. "
                "会社名から公式サイト URL を特定したり、市場データの裏取りに使う."
            ),
            instruction=WEB_RESEARCH_INSTRUCTION,
            tools=[google_search],
        )
        return AgentTool(agent=sub_agent)
    except Exception:
        return None
