"""Tests for research diagram backend (OpenAI image wrap / routing)."""
from __future__ import annotations

from adk.agent_tools.svg_generator import png_to_embedded_svg


def test_png_to_embedded_svg_wraps_base64():
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    svg = png_to_embedded_svg(png, width=1536, height=1024)
    assert svg.startswith("<svg ")
    assert 'viewBox="0 0 1536 1024"' in svg
    assert "data:image/png;base64," in svg
    assert svg.endswith("</svg>")
