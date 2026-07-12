"""Tests for workspace mode tool."""
from __future__ import annotations

from common.mode_tools import convert_mode, set_workspace_mode


def test_convert_mode_returns_sse_payload():
    result = convert_mode("image", "画像生成依頼")
    assert result["ok"] is True
    assert result["workspace_mode"] == "image"
    assert result["reason"] == "画像生成依頼"


def test_set_workspace_mode_returns_sse_payload():
    result = set_workspace_mode("image", "画像生成依頼")
    assert result["ok"] is True
    assert result["workspace_mode"] == "image"
    assert result["reason"] == "画像生成依頼"


def test_set_workspace_mode_accepts_research():
    result = set_workspace_mode("research", "リサーチ依頼")
    assert result["ok"] is True
    assert result["workspace_mode"] == "research"


def test_set_workspace_mode_accepts_storyvault():
    result = set_workspace_mode("storyvault", "SSOT構築")
    assert result["ok"] is True
    assert result["workspace_mode"] == "storyvault"


def test_set_workspace_mode_accepts_zapping_analysis():
    result = set_workspace_mode("storyvault_zapping_analysis", "ザッピング解析")
    assert result["ok"] is True
    assert result["workspace_mode"] == "storyvault_zapping_analysis"


def test_set_workspace_mode_rejects_invalid():
    result = set_workspace_mode("bogus", "invalid")
    assert result["ok"] is False
