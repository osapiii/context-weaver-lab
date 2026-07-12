"""research-v13 HTML builder の fixture 検証."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from adk.agent_tools.html_builder import build_research_html
from adk.schemas.research import Research

_FIXTURE = (
    Path(__file__).resolve().parent / "fixtures" / "research.sample.json"
)


def test_build_research_html_from_fixture() -> None:
    data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    research = Research.model_validate(data)

    with tempfile.TemporaryDirectory() as tmp:
        deck_dir = Path(tmp) / "2026-06-03_github-releases"
        deck_dir.mkdir()
        (deck_dir / "research.json").write_text(
            research.model_dump_json(indent=2, by_alias=True),
            encoding="utf-8",
        )

        with patch("adk.agent_tools.html_builder.config.DECK_OUT_DIR", Path(tmp)):
            result = build_research_html(deck_dir.name)

        html_path = Path(result["path"])
        html = html_path.read_text(encoding="utf-8")

        assert result["filename"] == "research.html"
        assert "qa-overview" in html
        assert "panel-goal" in html
        assert 'class="cite"' in html
        assert 'id="research-json"' in html
        assert "research-v13" in html
