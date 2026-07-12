"""data_analysis agent — ADK context + Vertex Search + CA API tool."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from common.mode_tools import convert_mode  # type: ignore  # noqa: E402

from .prompts import SYSTEM_INSTRUCTION
from .tools import analyze_bigquery_data

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def build_root_agent() -> LlmAgent:
    return LlmAgent(
        name="en_aistudio_data_analysis_agent",
        model=MODEL_ID,
        instruction=SYSTEM_INSTRUCTION,
        tools=[
            FunctionTool(func=convert_mode),
            FunctionTool(func=analyze_bigquery_data),
        ],
    )


root_agent = build_root_agent()
