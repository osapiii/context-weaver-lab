"""Cloud Run entrypoint for VibeControl Capability Structuring agent."""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_AGENTS_ROOT = _HERE.parent
if str(_AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_AGENTS_ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(_HERE / ".env", override=True)
    load_dotenv(_AGENTS_ROOT / ".env", override=False)
except ImportError:
    pass

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

from common.datadog_llmobs import init_datadog_llmobs  # type: ignore  # noqa: E402

init_datadog_llmobs()

from common.server_base import create_app  # type: ignore  # noqa: E402
from vibe_capability_structuring.agent import root_agent  # type: ignore  # noqa: E402

app = create_app(
    mode="vibe_capability_structuring",
    app_name="vibe-capability-structuring-agent",
    root_agent=root_agent,
)
