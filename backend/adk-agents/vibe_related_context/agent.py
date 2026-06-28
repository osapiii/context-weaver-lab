"""VibeControl Related Context agent."""
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

from common.agent_builder import build_agent_for_mode  # type: ignore

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def build_root_agent() -> LlmAgent:
    return build_agent_for_mode(
        "vibe_related_context",
        datastore_path=None,
        model=MODEL_ID,
    )


root_agent = build_root_agent()
