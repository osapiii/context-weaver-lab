"""Datadog LLM Observability bootstrap for Cloud Run SDK workers."""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def _truthy_env(name: str, default: str = "") -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes"}


def init_datadog_llmobs() -> None:
    """Enable ddtrace + LLMObs before Google GenAI imports."""
    if not _truthy_env("DD_LLMOBS_ENABLED"):
        return

    try:
        import ddtrace.auto  # noqa: F401
        from ddtrace.llmobs import LLMObs

        LLMObs.enable(
            ml_app=os.environ.get("DD_LLMOBS_ML_APP", "en-aistudio"),
            agentless_enabled=_truthy_env("DD_LLMOBS_AGENTLESS_ENABLED", "true"),
            site=os.environ.get("DD_SITE", "ap1.datadoghq.com"),
            api_key=os.environ.get("DD_API_KEY"),
        )
        logger.info("Datadog LLMObs enabled")
    except Exception as exc:  # pragma: no cover - best effort
        logger.warning("Datadog LLMObs init skipped: %s", exc)
