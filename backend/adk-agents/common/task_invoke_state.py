"""task.invoke — status / logs SSOT helpers."""
from __future__ import annotations

import time
from typing import Any

INVOKE_LOG_CAP = 50


def empty_invoke_state() -> dict[str, Any]:
    return {"status": "idle", "logs": []}


def read_task_invoke(bucket: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(bucket, dict):
        return empty_invoke_state()
    invoke = bucket.get("invoke")
    if not isinstance(invoke, dict):
        return empty_invoke_state()
    logs = invoke.get("logs")
    if not isinstance(logs, list):
        logs = []
    status = invoke.get("status")
    if status not in ("idle", "pending", "running", "completed", "error"):
        status = "idle"
    out: dict[str, Any] = {"status": status, "logs": list(logs)}
    for key in ("request_id", "linked_response_id", "error_message"):
        val = invoke.get(key)
        if isinstance(val, str) and val.strip():
            out[key] = val.strip()
    return out


def append_invoke_log(
    *,
    bucket: dict[str, Any],
    message: str,
    log_type: str = "info",
) -> dict[str, Any]:
    invoke = read_task_invoke(bucket)
    logs = list(invoke.get("logs") or [])
    logs.append(
        {
            "ts": int(time.time() * 1000),
            "message": message.strip(),
            "type": "error" if log_type == "error" else "info",
        }
    )
    invoke["logs"] = logs[-INVOKE_LOG_CAP:]
    bucket["invoke"] = invoke
    return bucket


def set_invoke_status(
    *,
    bucket: dict[str, Any],
    status: str,
    request_id: str | None = None,
    linked_response_id: str | None = None,
    error_message: str | None = None,
) -> dict[str, Any]:
    invoke = read_task_invoke(bucket)
    invoke["status"] = status
    if request_id:
        invoke["request_id"] = request_id.strip()
    if linked_response_id:
        invoke["linked_response_id"] = linked_response_id.strip()
    if error_message:
        invoke["error_message"] = error_message.strip()
    bucket["invoke"] = invoke
    return bucket
