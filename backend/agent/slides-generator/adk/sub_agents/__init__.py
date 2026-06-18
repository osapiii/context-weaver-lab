"""adk.sub_agents — ユーザー対話 phase の SubAgent.

2026-05 大胆刷新後の構成:
- **phase1_hearing**   — 読者・目的・questions[] を確定する (sub_agent transfer)
- **phase1_8_research** — deep_research で web 調査 + research.json を structured output で作成
- **deep_research**    — phase1_8 内部の AgentTool wrap (google_search built-in)

旧 Phase 2-4 (PPTX 生成パイプライン) は全廃. Coordinator 直下の
generate_svgs_tool / build_research_html_tool で 2 step 都度承認モード進行.
"""
from .phase1_hearing import build_phase1_hearing_agent
from .phase1_8_research import (
    build_phase1_8_research_agent,
    build_phase1_8_braindump_agent,  # 旧名 alias (移行用)
)
from .deep_research import build_deep_research_agent

__all__ = [
    "build_phase1_hearing_agent",
    "build_phase1_8_research_agent",
    "build_phase1_8_braindump_agent",
    "build_deep_research_agent",
]
