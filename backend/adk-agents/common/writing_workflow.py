"""AI Studio 文書モード invoke 前検証・state patch."""
from __future__ import annotations

from typing import Any

from .workspace_state_buckets import (
    effective_writing_state,
    patch_task_bucket,
    task_bucket_from_mode_state,
    task_bucket_from_session_state,
)


def _mode_state_dict(mode_state: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(mode_state, dict):
        return {}
    return task_bucket_from_mode_state(mode_state, "writing")


def _writing_phase(mode_state: dict[str, Any]) -> str:
    phase = mode_state.get("phase")
    if isinstance(phase, str) and phase.strip():
        return phase.strip()
    return "format_review"


def _writing_action(mode_state: dict[str, Any]) -> str | None:
    payload = mode_state.get("payload")
    if isinstance(payload, dict):
        action = payload.get("action")
        if isinstance(action, str) and action.strip():
            return action.strip()
    return None


def resolve_writing_action_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> str | None:
    """FE flat `writing_action` または golden `writing.payload.action` を解決."""
    if not isinstance(mode_state, dict):
        return None
    flat = mode_state.get("writing_action")
    if isinstance(flat, str) and flat.strip():
        return flat.strip()
    bucket = task_bucket_from_mode_state(mode_state, "writing")
    return _writing_action(bucket)


def _writing_reference(mode_state: dict[str, Any]) -> dict[str, Any]:
    setup = mode_state.get("setup")
    if isinstance(setup, dict) and isinstance(setup.get("reference"), dict):
        return setup["reference"]
    return {}


def _writing_form(mode_state: dict[str, Any]) -> dict[str, Any]:
    payload = mode_state.get("payload")
    if isinstance(payload, dict) and isinstance(payload.get("form"), dict):
        return payload["form"]
    return {}


def _reference_material_count(
    *,
    mode_state: dict[str, Any],
    attachments: list[Any] | None,
    selected_knowledge: list[Any] | None,
) -> int:
    ref = _writing_reference(mode_state)
    att_count = len(ref.get("attachments") or [])
    kn_count = len(ref.get("selected_knowledge") or [])
    attach_len = len(attachments or [])
    sel_len = len(selected_knowledge or [])
    return att_count + kn_count + attach_len + sel_len


def validate_writing_invoke(
    *,
    agent_mode: str,
    mode_state: dict[str, Any] | None,
    attachments: list[Any] | None = None,
    selected_knowledge: list[Any] | None = None,
) -> str | None:
    """文書ワークフロー invoke 前検証。エラーコード文字列 or None."""
    if agent_mode != "writing":
        return None
    ms = _mode_state_dict(mode_state)
    material_count = _reference_material_count(
        mode_state=ms,
        attachments=attachments,
        selected_knowledge=selected_knowledge,
    )
    if material_count < 1:
        return "WRITING_REFERENCE_REQUIRED"

    ref = _writing_reference(ms)
    if ref.get("status") != "complete":
        return "WRITING_REFERENCE_NOT_CONFIRMED"

    action = _writing_action(ms)
    phase = _writing_phase(ms)

    if action == "extract_schema":
        if phase not in ("format_review", "filling", "done"):
            return "WRITING_INVALID_PHASE"
        return None

    if action == "generate_document":
        if phase != "filling":
            return "WRITING_PHASE_NOT_FILLING"
        form = _writing_form(ms)
        fields = form.get("fields")
        if not isinstance(fields, list) or len(fields) < 1:
            return "WRITING_FORM_EMPTY"
        schema_confirmed = form.get("schema_confirmed_at")
        if isinstance(schema_confirmed, str) and schema_confirmed.strip():
            return None
        for field in fields:
            if not isinstance(field, dict):
                continue
            if field.get("required") is True:
                value = field.get("value")
                if not isinstance(value, str) or not value.strip():
                    return "WRITING_REQUIRED_VALUES_MISSING"
        return None

    return "WRITING_ACTION_REQUIRED"


def writing_turn_context_summary(*, mode_state: dict[str, Any] | None) -> str | None:
    """LLM 向けに文書フォームフェーズと入力値の要約を返す."""
    if not isinstance(mode_state, dict):
        return None
    ms = _mode_state_dict(mode_state)
    phase = _writing_phase(ms)
    action = _writing_action(ms)
    form = _writing_form(ms)
    fields = form.get("fields") if isinstance(form.get("fields"), list) else []
    title = form.get("title") if isinstance(form.get("title"), str) else ""

    lines = [
        f"- **writing_phase**: `{phase}`",
    ]
    if action:
        lines.append(f"- **writing_action**: `{action}`")
    if title and title.strip():
        lines.append(f"- **フォームタイトル**: {title.strip()}")

    if action == "extract_schema":
        lines.append(
            "- 添付・ナレッジから **入力項目の定義のみ** を抽出し、"
            "`save_writing_form_schema` を必ず 1 回呼び出してください。"
        )
        lines.append("- ユーザーの値の推測や本文生成は行わないでください。")
        return "\n".join(lines)

    if action == "generate_document":
        lines.append("- 各項目について `search_knowledge` で社内ナレッジを参照し、空の value を埋めて JSON 成果物を生成してください。")
        for field in fields:
            if not isinstance(field, dict):
                continue
            key = field.get("key")
            label = field.get("label")
            value = field.get("value")
            if not isinstance(key, str):
                continue
            label_s = label if isinstance(label, str) else key
            value_s = value if isinstance(value, str) else ""
            lines.append(f"  - `{key}` ({label_s}): {value_s[:500]}")
        lines.append(
            "- 完了時は `add_json_document` を 1 回呼び、フィールド key をトップレベルキーとした JSON を返してください。"
        )
        return "\n".join(lines)

    return "\n".join(lines) if lines else None


_WRITING_PHASE_ORDER = {"format_review": 0, "filling": 1, "done": 2}


def _form_field_count(form: dict[str, Any]) -> int:
    fields = form.get("fields")
    return len(fields) if isinstance(fields, list) else 0


def writing_patch_from_session_state(
    session_state: dict[str, Any],
) -> dict[str, Any]:
    """ADK session.state.writing golden バケットから patch を構築."""
    bucket = task_bucket_from_session_state(session_state, "writing")
    patch: dict[str, Any] = {}
    patch_task_bucket(patch, "writing", bucket)
    return patch


def merge_writing_invoke_mode_state(
    *,
    session_state: dict[str, Any],
    request_mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    """session / request の golden writing バケットをマージ."""
    merged = dict(request_mode_state or {})
    session_bucket = task_bucket_from_session_state(session_state, "writing")
    request_bucket = task_bucket_from_mode_state(merged, "writing")
    golden: dict[str, Any] = {**session_bucket, **request_bucket}

    stored_form = _writing_form(session_bucket)
    request_form = _writing_form(request_bucket)
    if isinstance(stored_form, dict) and _form_field_count(stored_form) > _form_field_count(
        request_form if isinstance(request_form, dict) else {}
    ):
        payload = golden.get("payload") if isinstance(golden.get("payload"), dict) else {}
        payload = dict(payload)
        payload["form"] = stored_form
        golden["payload"] = payload
    elif isinstance(stored_form, dict) and _form_field_count(stored_form) > 0:
        if not isinstance(request_form, dict) or _form_field_count(request_form) < 1:
            payload = golden.get("payload") if isinstance(golden.get("payload"), dict) else {}
            payload = dict(payload)
            payload["form"] = stored_form
            golden["payload"] = payload

    stored_phase = _writing_phase(session_bucket)
    request_phase = _writing_phase(request_bucket)
    if _WRITING_PHASE_ORDER.get(stored_phase, 0) > _WRITING_PHASE_ORDER.get(
        request_phase, 0
    ):
        golden["phase"] = stored_phase

    stored_ref = _writing_reference(session_bucket)
    if isinstance(stored_ref, dict) and stored_ref.get("status") == "complete":
        setup = golden.get("setup") if isinstance(golden.get("setup"), dict) else {}
        setup = dict(setup)
        setup["reference"] = stored_ref
        setup["confirmed"] = True
        golden["setup"] = setup

    action = _writing_action(request_bucket)
    if action:
        payload = golden.get("payload") if isinstance(golden.get("payload"), dict) else {}
        payload = dict(payload)
        payload["action"] = action
        golden["payload"] = payload

    patch = writing_state_patch_from_mode_state({"writing": golden})
    writing_bucket = patch.get("writing")
    if isinstance(writing_bucket, dict):
        merged["writing"] = dict(writing_bucket)
    merged["active_mode"] = "writing"
    return merged


def writing_state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    """state.writing / mode_state.writing バケット patch."""
    if not isinstance(mode_state, dict):
        return {}
    bucket_ms = task_bucket_from_mode_state(mode_state, "writing")
    golden: dict[str, Any] = {"phase": _writing_phase(bucket_ms)}
    setup: dict[str, Any] = {}
    ref = _writing_reference(bucket_ms)
    if ref:
        setup["reference"] = ref
        if ref.get("status") == "complete":
            setup["confirmed"] = True
    if setup:
        golden["setup"] = setup
    payload: dict[str, Any] = {}
    form = _writing_form(bucket_ms)
    if form:
        payload["form"] = form
    action = _writing_action(bucket_ms)
    if action:
        payload["action"] = action
    if payload:
        golden["payload"] = payload
    patch: dict[str, Any] = {}
    patch_task_bucket(patch, "writing", golden, active_task="writing")
    return patch
