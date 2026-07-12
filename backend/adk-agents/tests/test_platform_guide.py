"""Tests for platform guide constants."""
from __future__ import annotations

from common.platform_guide import (
    DEFAULT_GUIDE_MODEL_ID,
    DEFAULT_PLATFORM_GUIDE_STORE_ID,
    guide_model_id,
    platform_guide_bucket_name,
    platform_guide_store_id,
)


def test_default_store_id():
    assert DEFAULT_PLATFORM_GUIDE_STORE_ID == "en-aistudio-platform-guide"
    assert platform_guide_store_id() == "en-aistudio-platform-guide"


def test_store_id_env_override(monkeypatch):
    monkeypatch.setenv("EN_AISTUDIO_PLATFORM_GUIDE_STORE_ID", "custom-guide-store")
    assert platform_guide_store_id() == "custom-guide-store"


def test_platform_guide_bucket_name():
    assert platform_guide_bucket_name("my-proj") == "my-proj-platform-guide"


def test_default_guide_model_is_flash_lite():
    assert DEFAULT_GUIDE_MODEL_ID == "gemini-2.5-flash-lite"
    assert guide_model_id() == "gemini-2.5-flash-lite"


def test_guide_model_id_env_override(monkeypatch):
    monkeypatch.setenv("GUIDE_MODEL_ID", "gemini-2.0-flash")
    assert guide_model_id() == "gemini-2.0-flash"
