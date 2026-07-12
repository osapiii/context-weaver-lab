"""取引先登録 Agent — google_search SubAgent + 構造化ドラフト tools."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from common.global_prompt_scope import current_user_global_prompt  # type: ignore
from common.instruction_compose import compose_instruction  # type: ignore

from .prompts import SYSTEM_INSTRUCTION
from .tools import save_business_partner_draft, update_business_partner_phase
from .web_research_agent import build_web_research_agent_tool

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def _instruction(_ctx) -> str:
    return compose_instruction(
        SYSTEM_INSTRUCTION,
        current_user_global_prompt.get(),
    )


def build_root_agent() -> LlmAgent:
    tools: list = [
        FunctionTool(func=update_business_partner_phase),
        FunctionTool(func=save_business_partner_draft),
    ]
    web_tool = build_web_research_agent_tool(MODEL_ID)
    if web_tool is not None:
        tools.insert(0, web_tool)

    return LlmAgent(
        name="en_business_partner_agent",
        model=MODEL_ID,
        instruction=_instruction,
        tools=tools,
    )


root_agent = build_root_agent()
