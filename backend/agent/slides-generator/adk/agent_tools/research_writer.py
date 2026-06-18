"""research.json の永続化 + Pydantic validation.

新パイプラインの SoT (Single Source of Truth).
phase1_8_research sub_agent が Gemini structured output で生成した json を
受け取り、Research schema で validate → deck_dir/research.json として保存する.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Union

from pydantic import ValidationError

from .. import config
from ..schemas.research import (
    RESEARCH_SCHEMA_ID,
    Research,
    ResearchMeta,
)

_RESEARCH_FILENAME = "research.json"
JST = timezone(timedelta(hours=9))


def _resolve_deck_dir(deck_dir: Union[str, Path]) -> Path:
    p = Path(deck_dir)
    if not p.is_absolute():
        p = (config.DECK_OUT_DIR / p).resolve()
    return p


def stamp_research_v13(
    research: Research,
    deck_dir: Union[str, Path],
) -> Research:
    """v13 必須フィールドを未設定なら自動付与 ($schema / meta / deck_id / deck.date)."""
    dname = _resolve_deck_dir(deck_dir).name
    today = datetime.now(JST).strftime("%Y-%m-%d")

    updates: dict = {}
    if research.schema_ != RESEARCH_SCHEMA_ID:
        updates["schema_"] = RESEARCH_SCHEMA_ID
    if research.meta.schema_version != "13":
        updates["meta"] = ResearchMeta(schema_version="13")
    if not research.deck_id:
        updates["deck_id"] = dname

    deck_updates: dict = {}
    if not research.deck.date:
        deck_updates["date"] = today
    if deck_updates:
        updates["deck"] = research.deck.model_copy(update=deck_updates)

    if not updates:
        return research
    return research.model_copy(update=updates)


def parse_and_validate(payload: Union[str, dict]) -> Research:
    """LLM 出力 (str or dict) を Pydantic Research に変換 + validate."""
    if isinstance(payload, str):
        data = json.loads(payload)
    else:
        data = payload
    return Research.model_validate(data)


def write_research_json(
    deck_dir: Union[str, Path],
    research: Research,
) -> dict:
    """deck_dir/research.json として永続化.

    Returns:
        {"path": absolute, "bytes": size, "filename": "research.json"}
    """
    d = _resolve_deck_dir(deck_dir)
    d.mkdir(parents=True, exist_ok=True)
    p = d / _RESEARCH_FILENAME

    research_with_ts = research.model_copy(update={"generated_at": time.time()})
    stamped = stamp_research_v13(research_with_ts, deck_dir)
    raw = stamped.model_dump_json(indent=2, by_alias=True)
    p.write_text(raw, encoding="utf-8")
    return {
        "path": str(p.resolve()),
        "bytes": len(raw.encode("utf-8")),
        "filename": _RESEARCH_FILENAME,
    }


def read_research_json(deck_dir: Union[str, Path]) -> Research:
    """deck_dir/research.json を読んで Research を返す."""
    d = _resolve_deck_dir(deck_dir)
    p = d / _RESEARCH_FILENAME
    if not p.exists():
        raise FileNotFoundError(f"{_RESEARCH_FILENAME} が見つかりません: {p}")
    data = json.loads(p.read_text(encoding="utf-8"))
    return Research.model_validate(data)


def update_research_json(
    deck_dir: Union[str, Path],
    research: Research,
) -> dict:
    """既存 research.json を上書き. svg_done / svg_asset / html_path 更新用."""
    d = _resolve_deck_dir(deck_dir)
    p = d / _RESEARCH_FILENAME
    if not p.exists():
        raise FileNotFoundError(f"{_RESEARCH_FILENAME} が見つかりません: {p}")
    raw = research.model_dump_json(indent=2, by_alias=True)
    p.write_text(raw, encoding="utf-8")
    return {
        "path": str(p.resolve()),
        "bytes": len(raw.encode("utf-8")),
        "filename": _RESEARCH_FILENAME,
    }


def format_validation_error(e: ValidationError) -> str:
    """Pydantic ValidationError を LLM に再出力依頼するための短い説明に整形."""
    lines = []
    for err in e.errors():
        loc = ".".join(str(x) for x in err["loc"])
        lines.append(f"- {loc}: {err['msg']} (type={err['type']})")
    return "\n".join(lines)
