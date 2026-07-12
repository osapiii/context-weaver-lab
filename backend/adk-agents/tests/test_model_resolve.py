"""Tests for dynamic LLM model resolution."""
from __future__ import annotations

from common.model_resolve import (
    default_model_api_name_for_mode,
    normalize_model_override,
    resolve_model_for_invoke,
)


def test_normalize_selection_key():
    assert normalize_model_override("2.5-flash-lite") == "gemini-2.5-flash-lite"
    assert normalize_model_override("3.5-flash") == "gemini-3.5-flash"


def test_normalize_api_name_passthrough():
    assert normalize_model_override("gemini-2.5-flash") == "gemini-2.5-flash"


def test_resolve_guide_default(monkeypatch):
    monkeypatch.delenv("GUIDE_MODEL_ID", raising=False)
    assert resolve_model_for_invoke("guide", None) == "gemini-2.5-flash-lite"


def test_resolve_consultation_default(monkeypatch):
    monkeypatch.setenv("MODEL_ID", "gemini-2.5-flash")
    assert resolve_model_for_invoke("consultation", None) == "gemini-3.1-flash-lite"


def test_resolve_consultation_with_selection_override():
    assert (
        resolve_model_for_invoke("consultation", "3.1-flash-lite")
        == "gemini-3.1-flash-lite"
    )


def test_resolve_request_override():
    assert (
        resolve_model_for_invoke("consultation", "3.1-flash-lite")
        == "gemini-3.1-flash-lite"
    )


def test_default_model_api_name_for_mode_guide(monkeypatch):
    monkeypatch.setenv("GUIDE_MODEL_ID", "gemini-2.0-flash")
    assert default_model_api_name_for_mode("guide") == "gemini-2.0-flash"
