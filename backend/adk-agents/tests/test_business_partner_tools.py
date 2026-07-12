"""Tests for business_partner registration tools."""
from __future__ import annotations


class _FakeState(dict):
    pass


class _FakeToolContext:
    def __init__(self) -> None:
        self.state: dict = _FakeState()


def test_update_business_partner_phase():
    from business_partner.tools import update_business_partner_phase  # type: ignore

    ctx = _FakeToolContext()
    result = update_business_partner_phase(
        phase="researching",
        message="Web調査を開始",
        tool_context=ctx,
    )
    assert result["ok"] is True
    assert ctx.state["business_partner"]["phase"] == "researching"


def test_save_business_partner_draft_emits_json_artifact():
    from business_partner.tools import save_business_partner_draft  # type: ignore

    ctx = _FakeToolContext()
    result = save_business_partner_draft(
        comment="公式HPから会社概要を補完",
        fields={
            "name": "テスト株式会社",
            "website": "https://example.co.jp/",
        },
        sources=[{"title": "公式", "uri": "https://example.co.jp/"}],
        tool_context=ctx,
    )
    assert result["ok"] is True
    assert result["artifacts"][0]["kind"] == "json_document"
    assert ctx.state["business_partner"]["draft"]["fields"]["name"] == "テスト株式会社"
