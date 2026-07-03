"""StoryVault agent — user-story SSOT builder."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent

from common.agent_builder import (  # type: ignore
    agent_search_datastore_path,
    build_agent_for_mode,
)

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def build_root_agent() -> LlmAgent:
    default_fs = os.environ.get("DEFAULT_FILE_SPACE_ID", "").strip() or None
    return build_agent_for_mode(
        "storyvault",
        datastore_path=agent_search_datastore_path(default_fs),
        model=MODEL_ID,
    )


root_agent = build_root_agent()
