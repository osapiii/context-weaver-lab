"""adk — ENOSTECH Slides Multi-Agent Orchestrator (Google ADK v1.33+).

skills/enostech-slides v12 (Node + Python) を subprocess で叩く Python
オーケストレータ. Phase 1 / 1.8 は対話 SubAgent (transfer), Phase 2-4 は
Coordinator が atomic tool を 1 個ずつ呼ぶ「都度承認モード」で進む.

`adk web` (もしくは scripts/start_adk_web.sh) で起動するとこの
ディレクトリ (`agents-sandbox/adk/`) が agent としてディスカバリされ、
`adk.agent.root_agent` が chat に繋がる.

設計詳細は `adk/README.md` を参照.
"""
from . import agent  # noqa: F401
from .agent import root_agent  # noqa: F401
