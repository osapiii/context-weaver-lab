"""全テナント共通の操作ガイド用 Agent Search datastore 識別子."""
from __future__ import annotations

import os

DEFAULT_PLATFORM_GUIDE_STORE_ID = "en-aistudio-platform-guide"

# 操作ガイドは応答速度優先 (他 ADK モードの MODEL_ID とは独立)
DEFAULT_GUIDE_MODEL_ID = "gemini-2.5-flash-lite"

# GCS 上のマニュアル配置プレフィックス (sync スクリプトと一致)
PLATFORM_GUIDE_GCS_VERSION = "v1"


def guide_model_id() -> str:
    raw = os.environ.get("GUIDE_MODEL_ID", DEFAULT_GUIDE_MODEL_ID)
    stripped = (raw or "").strip()
    return stripped or DEFAULT_GUIDE_MODEL_ID


def platform_guide_store_id() -> str:
    raw = os.environ.get("EN_AISTUDIO_PLATFORM_GUIDE_STORE_ID", DEFAULT_PLATFORM_GUIDE_STORE_ID)
    stripped = (raw or "").strip()
    return stripped or DEFAULT_PLATFORM_GUIDE_STORE_ID


def platform_guide_bucket_name(project_id: str | None = None) -> str:
    """`{PROJECT}-platform-guide` — 操作ガイド用マニュアルの単一バケット."""
    project = (project_id or os.environ.get("GOOGLE_CLOUD_PROJECT") or "").strip()
    if not project:
        raise ValueError("GOOGLE_CLOUD_PROJECT is required for platform guide bucket")
    return f"{project}-platform-guide"
