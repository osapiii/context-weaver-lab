"""ADK session service factory (delegates to services.create_session_service)."""
from __future__ import annotations

from .services import create_session_service

__all__ = ["create_session_service"]
