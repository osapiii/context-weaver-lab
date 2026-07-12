"""sheet agent — LlmAgent + VertexAiSearchTool + Sheets API tools."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from common.mode_tools import convert_mode  # type: ignore  # noqa: E402

from .prompts import SYSTEM_INSTRUCTION
from .sheets_tools import append_rows, list_sheets, read_range, update_range

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def build_root_agent() -> LlmAgent:
    return LlmAgent(
        name="en_sheet_agent",
        model=MODEL_ID,
        instruction=SYSTEM_INSTRUCTION,
        tools=[
            FunctionTool(func=convert_mode),
            FunctionTool(func=list_sheets),
            FunctionTool(func=read_range),
            FunctionTool(func=update_range),
            FunctionTool(func=append_rows),
        ],
    )


root_agent = build_root_agent()
