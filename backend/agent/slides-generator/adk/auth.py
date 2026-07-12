"""adk.auth — Gemini / Vertex AI / Mock backend の自動判定.

優先順:
    1. ENOSTECH_FORCE_MOCK=1  → Mock 強制 (CI / オフラインテスト用)
    2. GEMINI_API_KEY / GOOGLE_API_KEY → Gemini API
    3. ADC (gcloud auth application-default login) + GOOGLE_CLOUD_PROJECT → Vertex AI
    4. それ以外 → Mock fallback (UI を hang させないため)

ADK の LlmAgent は GEMINI_API_KEY または GOOGLE_GENAI_USE_VERTEXAI=true を
見て自動で backend を選ぶので、ここではフラグ判定 + 状況サマリだけ返す。
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any


def _adc_path() -> Path:
    return Path.home() / ".config" / "gcloud" / "application_default_credentials.json"


def detect_backend(model: str = "gemini-3.5-flash") -> dict[str, Any]:
    """環境を見て利用可能な Gemini backend を判定する。API は叩かない."""
    if os.environ.get("ENOSTECH_FORCE_MOCK", "").strip() in ("1", "true", "yes", "on"):
        return {
            "backend": "mock",
            "model": model,
            "reason": "ENOSTECH_FORCE_MOCK が有効",
        }

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        return {
            "backend": "gemini_api",
            "model": model,
            "reason": "GEMINI_API_KEY / GOOGLE_API_KEY を検出",
        }

    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
    sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    if project and (sa_path or _adc_path().exists()):
        return {
            "backend": "vertex",
            "model": model,
            "project": project,
            "location": location,
            "reason": "ADC + GOOGLE_CLOUD_PROJECT を検出",
        }

    return {
        "backend": "mock",
        "model": model,
        "reason": "GEMINI_API_KEY も ADC も見当たらない (mock fallback)",
    }


def is_real_backend() -> bool:
    """実 Gemini が叩ける環境か (mock でなければ True)."""
    return detect_backend()["backend"] != "mock"


def describe_backend() -> str:
    info = detect_backend()
    if info["backend"] == "vertex":
        return f"vertex ({info.get('project')}/{info.get('location')}, {info['model']})"
    if info["backend"] == "gemini_api":
        return f"gemini_api ({info['model']})"
    return f"mock ({info['reason']})"
