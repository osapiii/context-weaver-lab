"""research.json から research.html (Notion 風読み物) を生成.

- Jinja2 template (`adk/templates/research_html.j2`) を使う.
- SVG は inline で埋め込み (base64 不要 / そのまま XML として張れる).
- CSS は inline `<style>` (1 ファイル完結).
- 出力は **deck_dir/research.html** に保存し、Research.html_path を更新.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Union

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

from .. import config
from ..schemas.research import Research
from . import research_writer
from .citation_render import build_reference_map, make_cite_text_filter, make_mdcite_filter

JST = timezone(timedelta(hours=9))

# ─── markdown-it (body_md → HTML) ──────────────────

_md: Any = None


def _get_md() -> Any:
    global _md
    if _md is None:
        import markdown_it  # type: ignore

        md = markdown_it.MarkdownIt("commonmark", {"breaks": True, "linkify": True})
        md.enable("table")
        _md = md
    return _md


# ─── Jinja2 環境 ──────────────────────────────────


_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _jinja_env(research: Research) -> Environment:
    ref_map = build_reference_map(research.references)
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(
            disabled_extensions=("j2",),
            default_for_string=False,
            default=False,
        ),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["md"] = _filter_md
    env.filters["safe_svg"] = _filter_safe_svg
    env.filters["cite_text"] = make_cite_text_filter(ref_map)
    env.filters["mdcite"] = make_mdcite_filter(ref_map, _get_md())
    return env


def _filter_md(text: str) -> Markup:
    """body_md を HTML に変換して `| safe` 相当で返す."""
    if not text:
        return Markup("")
    return Markup(_get_md().render(text))


def _filter_safe_svg(svg_text: str) -> Markup:
    """SVG 文字列をそのまま埋め込む (autoescape=False の保険)."""
    return Markup(svg_text or "")


def _format_generated_at_str(research: Research) -> str:
    if research.deck.date:
        return research.deck.date
    return datetime.fromtimestamp(research.generated_at, tz=JST).strftime("%Y-%m-%d")


# ─── public API ───────────────────────────────────


def _resolve_deck_dir(deck_dir: Union[str, Path]) -> Path:
    p = Path(deck_dir)
    if not p.is_absolute():
        p = (config.DECK_OUT_DIR / p).resolve()
    return p


def build_research_html(deck_dir: Union[str, Path]) -> dict:
    """deck_dir/research.json を読み、research.html を書き出す.

    Returns:
        {"path": absolute, "bytes": size, "filename": "research.html"}
    """
    research = research_writer.read_research_json(deck_dir)

    env = _jinja_env(research)
    template = env.get_template("research_html.j2")
    html_str = template.render(
        research=research,
        generated_at_str=_format_generated_at_str(research),
        research_json=research.model_dump_json(by_alias=True),
    )

    d = _resolve_deck_dir(deck_dir)
    d.mkdir(parents=True, exist_ok=True)
    p = d / "research.html"
    p.write_text(html_str, encoding="utf-8")

    updated = research.model_copy(update={"html_path": str(p.resolve())})
    research_writer.update_research_json(deck_dir, updated)

    return {
        "path": str(p.resolve()),
        "bytes": len(html_str.encode("utf-8")),
        "filename": "research.html",
    }
