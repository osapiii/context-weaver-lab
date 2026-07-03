"""StoryVault Story Generation agent."""
from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    _AGENT_DIR = Path(__file__).resolve().parent
    _ENV_PATH = _AGENT_DIR / ".env"
    load_dotenv(_ENV_PATH, override=True)
    load_dotenv(_AGENT_DIR.parent / ".env", override=False)
except ImportError:  # pragma: no cover
    pass

from google.adk.agents import LlmAgent

from common.agent_builder import (  # type: ignore
    agent_search_datastore_path,
    build_agent_for_mode,
)

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def build_root_agent() -> LlmAgent:
    default_fs = os.environ.get("DEFAULT_FILE_SPACE_ID", "").strip() or None
    return build_agent_for_mode(
        "storyvault_story_generation",
        datastore_path=agent_search_datastore_path(default_fs),
        model=MODEL_ID,
    )


root_agent = build_root_agent()
