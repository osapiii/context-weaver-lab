"""本文中の (N) 引用を HTML cite リンクへ変換するユーティリティ (research-v13)."""
from __future__ import annotations

import html
import re
from typing import Any, Mapping, Protocol

from markupsafe import Markup, escape

CITE_PATTERN = re.compile(r"[（(](\d+)[）)]")
CODE_BLOCK_PATTERN = re.compile(r"(```[\s\S]*?```|`[^`\n]+`)")
PLACEHOLDER_PATTERN = re.compile(r"⟦CITE:(\d+)⟧")


class _MdRenderer(Protocol):
    def render(self, text: str) -> str: ...


def build_reference_map(
    references: list[Any],
) -> dict[str, dict[str, str]]:
    """references[] から id → {url, title} マップを構築."""
    ref_map: dict[str, dict[str, str]] = {}
    for ref in references:
        if hasattr(ref, "id"):
            ref_id = str(ref.id)
            url = str(ref.url)
            title = str(ref.title)
        elif isinstance(ref, Mapping):
            ref_id = str(ref["id"])
            url = str(ref["url"])
            title = str(ref["title"])
        else:
            continue
        ref_map[ref_id] = {"url": url, "title": title}
    return ref_map


def _cite_link_html(params: dict[str, str]) -> str:
    """(N) を #ref-N アンカー付き cite リンク HTML に変換."""
    ref_id = params["ref_id"]
    ref = params.get("ref")
    if not ref:
        return f"({ref_id})"
    title = html.escape(ref["title"], quote=True)
    return (
        f'<a class="cite" href="#ref-{ref_id}" title="{title}">({ref_id})</a>'
    )


def cite_text(text: str, ref_map: Mapping[str, Mapping[str, str]]) -> str:
    """プレーンテキスト中の (N) / （N） を cite リンクに変換."""
    if not text:
        return ""

    escaped = str(escape(text))

    def repl(match: re.Match[str]) -> str:
        ref_id = match.group(1)
        return _cite_link_html(
            {"ref_id": ref_id, "ref": ref_map.get(ref_id)}
        )

    return CITE_PATTERN.sub(repl, escaped)


def _apply_cite_placeholders(
    text: str,
    ref_map: Mapping[str, Mapping[str, str]],
) -> str:
    """コードブロック外の (N) をプレースホルダ ⟦CITE:n⟧ に置換."""

    def process_segment(segment: str) -> str:
        def repl(match: re.Match[str]) -> str:
            return f"⟦CITE:{match.group(1)}⟧"

        return CITE_PATTERN.sub(repl, segment)

    parts = CODE_BLOCK_PATTERN.split(text)
    for i in range(0, len(parts), 2):
        parts[i] = process_segment(parts[i])
    return "".join(parts)


def _restore_cite_placeholders(html_out: str, ref_map: Mapping[str, Mapping[str, str]]) -> str:
    def repl(match: re.Match[str]) -> str:
        ref_id = match.group(1)
        return _cite_link_html(
            {"ref_id": ref_id, "ref": ref_map.get(ref_id)}
        )

    return PLACEHOLDER_PATTERN.sub(repl, html_out)


def mdcite(
    text: str,
    ref_map: Mapping[str, Mapping[str, str]],
    md_renderer: _MdRenderer,
) -> str:
    """markdown 変換前に (N) をプレースホルダ化し、変換後に cite リンクへ復元."""
    if not text:
        return ""
    with_placeholders = _apply_cite_placeholders(text, ref_map)
    rendered = md_renderer.render(with_placeholders)
    return _restore_cite_placeholders(rendered, ref_map)


def make_cite_text_filter(
    ref_map: Mapping[str, Mapping[str, str]],
):
    def _filter(text: str) -> Markup:
        return Markup(cite_text(text, ref_map))

    return _filter


def make_mdcite_filter(
    ref_map: Mapping[str, Mapping[str, str]],
    md_renderer: _MdRenderer,
):
    def _filter(text: str) -> Markup:
        return Markup(mdcite(text, ref_map, md_renderer))

    return _filter
