"""Datadog LLM Observability bootstrap for ADK Cloud Run agents."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def _enabled(value: str | None) -> bool:
    return (value or "").lower() in {"1", "true", "yes"}


def init_datadog_llmobs() -> None:
    """Enable ddtrace LLM Observability when Datadog env is configured."""
    if not _enabled(os.environ.get("DD_LLMOBS_ENABLED")):
        return

    try:
        import ddtrace.auto  # noqa: F401
        from ddtrace.llmobs import LLMObs

        LLMObs.enable(
            ml_app=os.environ.get("DD_LLMOBS_ML_APP", "storyvault"),
            agentless_enabled=_enabled(
                os.environ.get("DD_LLMOBS_AGENTLESS_ENABLED", "true")
            ),
            site=os.environ.get("DD_SITE", "ap1.datadoghq.com"),
            api_key=os.environ.get("DD_API_KEY"),
        )
        logger.info("Datadog LLM Observability enabled")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Datadog LLM Observability init skipped: %s", exc)
