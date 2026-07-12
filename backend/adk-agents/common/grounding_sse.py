"""Serialize ADK grounding_metadata for SSE."""
from __future__ import annotations

from typing import Any


def _serialize_proto(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [_serialize_proto(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_proto(v) for k, v in value.items()}
    if hasattr(value, "model_dump"):
        try:
            return value.model_dump(mode="json")
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        out: dict[str, Any] = {}
        for k, v in value.__dict__.items():
            if not k.startswith("_"):
                out[k] = _serialize_proto(v)
        return out
    return str(value)


def grounding_event_payload(metadata: Any) -> dict[str, Any] | None:
    if metadata is None:
        return None
    serialized = _serialize_proto(metadata)
    if not isinstance(serialized, dict):
        return {"raw": serialized}
    return serialized
