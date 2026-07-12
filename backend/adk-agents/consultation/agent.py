"""consultation agent — LlmAgent + VertexAiSearchTool + citation tool.

server.py が adk-agents/ を sys.path に通すので、ここからは `common` を絶対 import で参照できる.
"""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from common.artifact_tools import add_html_document, add_markdown_document  # type: ignore  # noqa: E402
from common.mode_tools import convert_mode  # type: ignore  # noqa: E402

from .prompts import SYSTEM_INSTRUCTION
from .tools import add_citation

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def build_root_agent() -> LlmAgent:
    """Legacy static agent — unified server uses common.agent_builder."""
    return LlmAgent(
        name="en_consultation_agent",
        model=MODEL_ID,
        instruction=SYSTEM_INSTRUCTION,
        tools=[
            FunctionTool(func=convert_mode),
            FunctionTool(func=add_citation),
            FunctionTool(func=add_markdown_document),
            FunctionTool(func=add_html_document),
        ],
    )


root_agent = build_root_agent()
