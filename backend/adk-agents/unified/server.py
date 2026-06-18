"""Cloud Run entrypoint — unified EN AIstudio ADK agent (all modes).

sys.path resolution:
    backend/adk-agents/ をルートに通すことで、各 mode パッケージを import できる.
"""
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

from common.byok_patch import install as install_byok_patch  # type: ignore  # noqa: E402

install_byok_patch()

from common.server_base import create_unified_app  # type: ignore  # noqa: E402
from unified.registry import build_agent_registry  # type: ignore  # noqa: E402

app = create_unified_app(agents=build_agent_registry())
