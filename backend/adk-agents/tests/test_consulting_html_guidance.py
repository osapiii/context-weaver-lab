"""Tests for consulting HTML guidance module."""
from __future__ import annotations

from common.consulting_html_guidance import CONSULTING_HTML_OUTPUT_RULES


def test_consulting_html_rules_mention_add_html_document():
    assert "add_html_document" in CONSULTING_HTML_OUTPUT_RULES
    assert "マッキンゼー" in CONSULTING_HTML_OUTPUT_RULES or "コンサル" in CONSULTING_HTML_OUTPUT_RULES
