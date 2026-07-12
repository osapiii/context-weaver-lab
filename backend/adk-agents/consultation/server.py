"""Cloud Run entrypoint — `uvicorn server:app --host 0.0.0.0 --port $PORT`.

sys.path resolution:
    backend/adk-agents/ をルートに通すことで、`common.*` / `consultation.*` を絶対 import できる.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent  # .../adk-agents/consultation
_AGENTS_ROOT = _HERE.parent  # .../adk-agents
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
from consultation.agent import root_agent  # type: ignore  # noqa: E402

app = create_app(
    mode="consultation",
    app_name="en-aistudio-consultation-agent",
    root_agent=root_agent,
)
