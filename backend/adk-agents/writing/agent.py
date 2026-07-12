"""writing agent — LlmAgent + VertexAiSearchTool + フォームワークフロー tools."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent

from common.agent_builder import (  # type: ignore  # noqa: E402
    agent_search_datastore_path,
    build_agent_for_mode,
)

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def build_root_agent() -> LlmAgent:
    return build_agent_for_mode(
        "writing",
        datastore_path=agent_search_datastore_path(None),
        model=MODEL_ID,
    )


root_agent = build_root_agent()
