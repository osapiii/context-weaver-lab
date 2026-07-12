"""
Workflow ステップ間の ExecutionContext 引き継ぎ (GCS)

GCP Workflow は crawl / uploadToGcs / registerToFileSpace を別 HTTP で呼ぶため、
メモリ上の context はリクエストをまたげない。input.folder_path 配下に state JSON を置く。
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from common import ExecutionContext, FatalStepError
from common.gcs_storage import blob_exists, download_blob_as_text, upload_string_to_gcs

STATE_RELATIVE_PATH = ".web-crawl/workflow-state.json"
STATE_VERSION = 1


def _state_location(context: ExecutionContext) -> tuple[str, str]:
    input_data = context.input_data
    bucket_name = input_data.bucket_name.strip()
    folder_path = input_data.folder_path.strip().rstrip("/")
    if not bucket_name or not folder_path:
        raise FatalStepError(
            step_name="workflow_step_state",
            message="bucket_name and folder_path are required for workflow state",
            error_code="WORKFLOW_STATE_PATH_MISSING",
        )
    return bucket_name, f"{folder_path}/{STATE_RELATIVE_PATH}"


def load_workflow_state(context: ExecutionContext) -> Dict[str, Any]:
    bucket_name, object_path = _state_location(context)
    if not blob_exists(bucket_name, object_path):
        return {}
    try:
        raw = download_blob_as_text(bucket_name, object_path)
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception as exc:
        raise FatalStepError(
            step_name="workflow_step_state",
            message=f"failed to load workflow state: {exc}",
            error_code="WORKFLOW_STATE_LOAD_FAILED",
        ) from exc


def save_workflow_state(context: ExecutionContext, patch: Dict[str, Any]) -> None:
    bucket_name, object_path = _state_location(context)
    current: Dict[str, Any] = {}
    if blob_exists(bucket_name, object_path):
        current = load_workflow_state(context)
    merged = {**current, **patch, "version": STATE_VERSION}
    upload_string_to_gcs(
        content=json.dumps(merged, ensure_ascii=False),
        bucket_name=bucket_name,
        gcs_path=object_path,
        content_type="application/json; charset=utf-8",
    )


def _context_value_missing(context: ExecutionContext, key: str) -> bool:
    value = context.get(key)
    if value is None:
        return True
    if value == "":
        return True
    if isinstance(value, (list, dict)) and len(value) == 0:
        return True
    return False


def restore_context_keys(
    context: ExecutionContext,
    keys: List[str],
    *,
    step_name: str,
) -> None:
    """GCS workflow-state から不足している context キーを復元する。"""
    missing_keys = [key for key in keys if _context_value_missing(context, key)]
    if not missing_keys:
        return

    state = load_workflow_state(context)
    still_missing: List[str] = []
    for key in missing_keys:
        if key not in state or state[key] in (None, "", [], {}):
            still_missing.append(key)
            continue
        context.set(key, state[key])

    if still_missing:
        raise FatalStepError(
            step_name=step_name,
            message=(
                "workflow state missing required context: "
                + ", ".join(still_missing)
            ),
            error_code="WORKFLOW_STATE_MISSING",
        )


def persist_context_keys(context: ExecutionContext, keys: List[str]) -> None:
    patch: Dict[str, Any] = {}
    for key in keys:
        value = context.get(key)
        if value is not None and value != "" and value != [] and value != {}:
            patch[key] = value
    if patch:
        save_workflow_state(context, patch)
