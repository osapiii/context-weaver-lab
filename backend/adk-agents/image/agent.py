"""image agent — LlmAgent + Agent Search + OpenAI gpt-image-2 tools."""
from __future__ import annotations

import os

from common.agent_builder import (  # type: ignore
    agent_search_datastore_path,
    build_agent_for_mode,
)

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def build_root_agent():
    """Standalone deploy 用。DE があれば Agent Search を付与する."""
    default_fs = os.environ.get("DEFAULT_FILE_SPACE_ID", "").strip() or None
    datastore_path = agent_search_datastore_path(default_fs)
    return build_agent_for_mode(
        "image",
        datastore_path=datastore_path,
        model=MODEL_ID,
    )


root_agent = build_root_agent()
