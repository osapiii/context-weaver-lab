"""citation_render: (N) → cite リンク変換."""
from __future__ import annotations

import re

from adk.agent_tools.citation_render import build_reference_map, cite_text, mdcite


_REF_MAP = build_reference_map(
    [
        {"id": "1", "url": "https://example.com/1", "title": "Source One"},
        {"id": "2", "url": "https://example.com/2", "title": "Source Two"},
    ]
)


class _FakeMd:
    def render(self, text: str) -> str:
        return f"<p>{text}</p>"


def test_cite_text_converts_parenthetical_to_link() -> None:
    out = cite_text("結論です(1)と(2)です。", _REF_MAP)
    assert 'class="cite"' in out
    assert 'href="#ref-1"' in out
    assert 'href="#ref-2"' in out
    assert "(1)" in out


def test_cite_text_fullwidth_parentheses() -> None:
    out = cite_text("根拠（1）", _REF_MAP)
    assert 'href="#ref-1"' in out


def test_mdcite_skips_code_blocks() -> None:
    text = "本文(1)と `code(2)` と ```\nblock(3)\n```"
    out = mdcite(text, _REF_MAP, _FakeMd())
    assert 'href="#ref-1"' in out
    assert "code(2)" in out
    assert "block(3)" in out
    assert out.count('class="cite"') == 1


def test_unknown_ref_keeps_plain_text() -> None:
    out = cite_text("不明(9)", _REF_MAP)
    assert "(9)" in out
    assert "cite" not in out
