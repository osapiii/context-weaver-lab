"""ADK artifact service factory (delegates to services.create_artifact_service)."""
from __future__ import annotations

from .services import create_artifact_service

__all__ = ["create_artifact_service"]
