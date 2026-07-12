"""Cloud Run entrypoint for sheet agent."""
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
    from dotenv import load_dotenv  # type: ignore

    load_dotenv(_HERE / ".env")
    load_dotenv(_AGENTS_ROOT / ".env")
except ImportError:
    pass

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

from common.datadog_llmobs import init_datadog_llmobs  # type: ignore  # noqa: E402

init_datadog_llmobs()

from common.server_base import create_app  # type: ignore  # noqa: E402
from sheet.agent import root_agent  # type: ignore  # noqa: E402

app = create_app(
    mode="sheet",
    app_name="en-aistudio-sheet-agent",
    root_agent=root_agent,
)
