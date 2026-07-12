"""Research coordinator — slides-generator ADK を unified ADK から再利用."""
from __future__ import annotations

import sys
from pathlib import Path

def _slides_generator_root() -> Path:
    """Cloud Run: /app/slides-generator. ローカル: backend/agent/slides-generator."""
    here = Path(__file__).resolve().parent
    docker_layout = here.parent / "slides-generator"
    if docker_layout.is_dir():
        return docker_layout
    repo_layout = here.parent.parent / "agent" / "slides-generator"
    if repo_layout.is_dir():
        return repo_layout
    raise RuntimeError(
        "slides-generator not found "
        f"(checked {docker_layout} and {repo_layout})"
    )


def _ensure_slides_generator_path() -> None:
    root = str(_slides_generator_root())
    if root not in sys.path:
        sys.path.insert(0, root)


def build_root_agent(*, datastore_path: str | None = None):
    """ENOSTECH research coordinator (phase hearing → research → SVG → HTML)."""
    _ensure_slides_generator_path()
    from adk.agent import _make_root_agent

    return _make_root_agent(datastore_path=datastore_path)


root_agent = build_root_agent()
