"""decks/{slug}/ ディレクトリの確保 + plan.json の読み書き.

Cloud Run では `ENOSTECH_DECK_OUT=/tmp/decks` 等を指定する.
"""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Optional

from .. import config


_SLUG_RE = re.compile(r"[^a-z0-9\-]+")


def slugify(text: str, max_len: int = 32) -> str:
    """日本語含む title から ASCII slug を作る (簡易).

    内部 deck_id は LLM が決めるのを尊重するので、ここは fallback 専用.
    """
    s = text.lower().strip()
    # 日本語が含まれる場合、ascii 化できないので date prefix のみ返す
    if not s.isascii():
        return date.today().strftime("%Y%m%d")
    s = _SLUG_RE.sub("-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:max_len] or "deck"


def _resolve_deck_dir(deck_dir: str | Path) -> Path:
    """deck_dir を絶対パスに正規化する.

    LLM がしばしば `deck_dir="2025-05-24_my_topic"` のような **相対パス**
    (実は deck_id) を渡してくるので、絶対パスでなければ DECK_OUT_DIR を
    基準にして resolve する. これで cwd 依存の "No such file or directory"
    エラーを防ぐ.
    """
    p = Path(deck_dir)
    if not p.is_absolute():
        p = (config.DECK_OUT_DIR / p).resolve()
    return p


def ensure_deck_dir(deck_id: str, *, root: Optional[Path] = None) -> dict:
    """decks/{deck_id}/ を作って絶対パスを返す.

    Returns:
        {"deck_id": ..., "deck_dir": absolute path str, "created": bool}
    """
    root = root or config.DECK_OUT_DIR
    deck_dir = (root / deck_id).resolve()
    created = not deck_dir.exists()
    deck_dir.mkdir(parents=True, exist_ok=True)
    return {
        "deck_id": deck_id,
        "deck_dir": str(deck_dir),
        "created": created,
    }


def _drop_none(node):
    """build-deck.js (Zod) は `optional` フィールドに null を許容しない (undefined のみ).

    Pydantic dump 由来の null を再帰的に除去する.
    """
    if isinstance(node, dict):
        return {k: _drop_none(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [_drop_none(v) for v in node]
    return node


def write_plan_json(deck_dir: str | Path, plan_dict: dict, *, filename: str = "plan.json") -> dict:
    """plan_dict を deck_dir/{filename} に書き出す.

    Zod renderer 互換のため null フィールドを再帰除去してから書く.
    deck_dir が相対パスなら DECK_OUT_DIR 基準で絶対化する.

    Returns:
        {"path": absolute path, "bytes": size}
    """
    d = _resolve_deck_dir(deck_dir)
    d.mkdir(parents=True, exist_ok=True)
    p = d / filename
    cleaned = _drop_none(plan_dict)
    raw = json.dumps(cleaned, ensure_ascii=False, indent=2)
    p.write_text(raw, encoding="utf-8")
    return {
        "path": str(p.resolve()),
        "bytes": len(raw.encode("utf-8")),
        "filename": filename,
    }


def read_plan_json(deck_dir: str | Path, *, filename: str = "plan.json") -> dict:
    """deck_dir/{filename} を読んで dict を返す.

    deck_dir が相対パスなら DECK_OUT_DIR 基準で絶対化する.
    存在しない場合は FileNotFoundError.
    """
    d = _resolve_deck_dir(deck_dir)
    p = d / filename
    if not p.exists():
        raise FileNotFoundError(f"{filename} が見つかりません: {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def list_deck_artifacts(deck_dir: str | Path) -> dict:
    """decks/{deck_id}/ 配下の主要ファイルを列挙する (artifact 登録用).

    deck_dir が相対パスなら DECK_OUT_DIR 基準で絶対化する.
    """
    d = _resolve_deck_dir(deck_dir)
    artifacts: list[dict] = []
    if not d.exists():
        return {"deck_dir": str(d), "artifacts": []}
    # 主要成果物.
    candidates = [
        "資料.pptx", "draft.pptx",
        "plan.json", "plan.html",
        "outline.json", "outline.html",
        "レポート.html", "ナレーション台本.md",
        "qa_report.json", "qa-self-report-phase2.md", "qa-self-report-phase4.md",
        "スライドQA.csv", "braindump.md",
    ]
    for name in candidates:
        p = d / name
        if p.exists():
            artifacts.append({
                "name": name,
                "path": str(p.resolve()),
                "bytes": p.stat().st_size,
            })
    # preview ディレクトリ.
    preview_dir = d / "preview"
    if preview_dir.exists():
        for p in sorted(preview_dir.glob("slide-*.png")):
            artifacts.append({
                "name": f"preview/{p.name}",
                "path": str(p.resolve()),
                "bytes": p.stat().st_size,
            })
    contact_sheet = d / "contact-sheet.png"
    if contact_sheet.exists():
        artifacts.append({
            "name": "contact-sheet.png",
            "path": str(contact_sheet.resolve()),
            "bytes": contact_sheet.stat().st_size,
        })
    return {"deck_dir": str(d.resolve()), "artifacts": artifacts}
