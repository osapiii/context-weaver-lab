"""research-v13 Pydantic schema の fixture 検証."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from adk.schemas.research import Research

_FIXTURE = (
    Path(__file__).resolve().parent / "fixtures" / "research.sample.json"
)


def test_fixture_validates_as_research_v13() -> None:
    data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    research = Research.model_validate(data)
    assert research.schema_ == "research-v13"
    assert research.meta.schema_version == "13"
    assert research.references[0].id == "1"
    assert research.deck.title == research.theme


def test_invalid_reference_id_raises() -> None:
    data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    data["sections"][0]["reference_ids"] = ["999"]
    with pytest.raises(ValidationError, match="存在しない id"):
        Research.model_validate(data)


def test_deck_theme_mismatch_raises() -> None:
    data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    data["theme"] = "不一致タイトル"
    with pytest.raises(ValidationError, match="deck.title と theme"):
        Research.model_validate(data)
