"""Golden task bucket — read / write (golden shape only)."""
from __future__ import annotations

from typing import Any

from .task_invoke_state import empty_invoke_state, read_task_invoke


def _is_dict(value: Any) -> bool:
    return isinstance(value, dict)


def _preserve_invoke(*, merged: dict[str, Any], existing: dict[str, Any]) -> None:
    if "invoke" in merged:
        return
    invoke = existing.get("invoke")
    if _is_dict(invoke):
        merged["invoke"] = dict(invoke)


def image_flat_to_golden(fragment: dict[str, Any]) -> dict[str, Any]:
    """golden `state.image` patch — 入力は golden 形状または tool flat ビュー."""
    if not fragment:
        return {}
    if _is_dict(fragment.get("setup")) and fragment.get("phase"):
        return {
            k: fragment[k]
            for k in (
                "phase",
                "setup",
                "payload",
                "primary",
                "retouch_regions",
                "artifact",
            )
            if k in fragment
        }

    golden: dict[str, Any] = {}
    phase = fragment.get("phase")
    if isinstance(phase, str) and phase.strip():
        golden["phase"] = phase.strip()

    setup: dict[str, Any] = (
        dict(fragment["setup"]) if _is_dict(fragment.get("setup")) else {}
    )
    if fragment.get("image_mode_selected") is True:
        setup["confirmed"] = True
    elif fragment.get("image_mode_selected") is False:
        setup["confirmed"] = False
    creation = setup.get("creation") or fragment.get("image_creation_mode")
    if creation in ("scratch", "reference"):
        setup["creation"] = creation
    ref = setup.get("reference") or fragment.get("image_reference")
    if _is_dict(ref):
        setup["reference"] = dict(ref)
    if setup:
        golden["setup"] = setup

    primary = fragment.get("primary")
    if primary is None:
        primary = fragment.get("primary_image")
    if primary is not None:
        golden["primary"] = primary

    regions = fragment.get("retouch_regions")
    if isinstance(regions, list):
        golden["retouch_regions"] = list(regions)

    payload = fragment.get("payload")
    if _is_dict(payload):
        golden["payload"] = dict(payload)

    return golden


def image_golden_to_effective_flat(bucket: dict[str, Any]) -> dict[str, Any]:
    """ADK tools 用 — golden `state.image` → flat tool ビュー."""
    out: dict[str, Any] = {}
    phase = bucket.get("phase")
    if isinstance(phase, str) and phase.strip():
        out["image_workflow_phase"] = phase.strip()

    setup = bucket.get("setup") if _is_dict(bucket.get("setup")) else {}
    if setup.get("confirmed") is True:
        out["image_mode_selected"] = True
    elif setup.get("confirmed") is False:
        out["image_mode_selected"] = False
    creation = setup.get("creation")
    if creation in ("scratch", "reference"):
        out["image_creation_mode"] = creation
    ref = setup.get("reference")
    if _is_dict(ref):
        out["image_reference"] = dict(ref)

    primary = bucket.get("primary")
    if _is_dict(primary):
        out["primary_image"] = dict(primary)

    regions = bucket.get("retouch_regions")
    if isinstance(regions, list):
        out["retouch_regions"] = list(regions)

    return out


def writing_flat_to_golden(fragment: dict[str, Any]) -> dict[str, Any]:
    if not fragment:
        return {}
    if fragment.get("phase") and _is_dict(fragment.get("setup")):
        return {
            k: fragment[k]
            for k in ("phase", "setup", "payload", "artifact")
            if k in fragment
        }

    golden: dict[str, Any] = {}
    phase = fragment.get("phase") or fragment.get("writing_phase")
    if isinstance(phase, str) and phase.strip():
        golden["phase"] = phase.strip()

    setup: dict[str, Any] = (
        dict(fragment["setup"]) if _is_dict(fragment.get("setup")) else {}
    )
    ref = setup.get("reference") or fragment.get("writing_reference")
    if _is_dict(ref):
        setup["reference"] = dict(ref)
        if ref.get("status") == "complete":
            setup["confirmed"] = True
    if setup:
        golden["setup"] = setup

    payload: dict[str, Any] = (
        dict(fragment["payload"]) if _is_dict(fragment.get("payload")) else {}
    )
    form = payload.get("form") or fragment.get("writing_form")
    if _is_dict(form):
        payload["form"] = dict(form)
    action = payload.get("action") or fragment.get("writing_action")
    if isinstance(action, str) and action.strip():
        payload["action"] = action.strip()
    if payload:
        golden["payload"] = payload

    return golden


def writing_golden_to_effective_flat(bucket: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    phase = bucket.get("phase")
    if isinstance(phase, str) and phase.strip():
        out["writing_phase"] = phase.strip()

    setup = bucket.get("setup") if _is_dict(bucket.get("setup")) else {}
    ref = setup.get("reference")
    if _is_dict(ref):
        out["writing_reference"] = dict(ref)

    payload = bucket.get("payload") if _is_dict(bucket.get("payload")) else {}
    form = payload.get("form")
    if _is_dict(form):
        out["writing_form"] = dict(form)
    action = payload.get("action")
    if isinstance(action, str) and action.strip():
        out["writing_action"] = action.strip()

    return out


def research_flat_to_golden(fragment: dict[str, Any]) -> dict[str, Any]:
    """golden `state.research` patch — flat / legacy ビューから正規化."""
    if not fragment:
        return {}
    if isinstance(fragment.get("phase"), str) and _is_dict(fragment.get("setup")):
        return {
            k: fragment[k]
            for k in ("phase", "setup", "payload", "artifact", "invoke")
            if k in fragment
        }

    golden: dict[str, Any] = {}
    phase = fragment.get("phase") or fragment.get("current_phase")
    if isinstance(phase, str) and phase.strip():
        golden["phase"] = phase.strip()

    setup: dict[str, Any] = (
        dict(fragment["setup"]) if _is_dict(fragment.get("setup")) else {}
    )
    for key in (
        "theme",
        "auto_mode",
        "pipeline_autonomous",
        "plan_only",
        "briefing_theme",
        "briefing_audience",
        "briefing_use_case",
        "organization_id",
        "organization_name",
        "space_id",
        "space_name",
        "file_space_id",
        "context_status",
        "context_warning",
        "intent",
        "deck_structure",
        "target_slides",
    ):
        if fragment.get(key) is not None:
            setup[key] = fragment[key]
    if setup:
        golden["setup"] = setup

    payload: dict[str, Any] = (
        dict(fragment["payload"]) if _is_dict(fragment.get("payload")) else {}
    )
    for key in (
        "deck_id",
        "deck_dir",
        "research_path",
        "research_html_path",
        "progress",
        "progress_history",
        "job_log",
        "phase_status",
        "plan_draft",
        "workflow_phase",
        "notification_email",
    ):
        if fragment.get(key) is not None:
            payload[key] = fragment[key]
    if payload:
        golden["payload"] = payload

    return golden


def research_golden_to_effective_flat(bucket: dict[str, Any]) -> dict[str, Any]:
    """ADK tools / UI 用 — golden `state.research` → flat ビュー."""
    out: dict[str, Any] = {}
    phase = bucket.get("phase") or bucket.get("current_phase")
    if isinstance(phase, str) and phase.strip():
        out["current_phase"] = phase.strip()

    setup = bucket.get("setup") if _is_dict(bucket.get("setup")) else {}
    for key in (
        "theme",
        "auto_mode",
        "pipeline_autonomous",
        "plan_only",
        "briefing_theme",
        "briefing_audience",
        "briefing_use_case",
        "organization_id",
        "organization_name",
        "space_id",
        "space_name",
        "file_space_id",
        "context_status",
        "context_warning",
        "intent",
        "deck_structure",
        "target_slides",
    ):
        if key in setup:
            out[key] = setup[key]
        elif key in bucket:
            out[key] = bucket[key]

    payload = bucket.get("payload") if _is_dict(bucket.get("payload")) else {}
    for key in (
        "deck_id",
        "deck_dir",
        "research_path",
        "research_html_path",
        "progress",
        "progress_history",
        "job_log",
        "phase_status",
        "plan_draft",
        "workflow_phase",
        "notification_email",
    ):
        if key in payload:
            out[key] = payload[key]
        elif key in bucket:
            out[key] = bucket[key]

    return out


def merge_research_into_session_state(
    state: dict[str, Any], flat_patch: dict[str, Any]
) -> None:
    """ルート flat キーと `state.research` golden バケットを同期."""
    golden_patch = research_flat_to_golden(flat_patch)
    if not golden_patch:
        return
    existing = state.get("research")
    state["research"] = merge_golden_task_bucket(
        existing=existing if _is_dict(existing) else None,
        patch=golden_patch,
    )


def normalize_task_patch_to_golden(task: str, patch: dict[str, Any]) -> dict[str, Any]:
    if task == "image":
        return image_flat_to_golden(patch)
    if task == "writing":
        return writing_flat_to_golden(patch)
    if task == "research":
        return research_flat_to_golden(patch)
    return dict(patch)


def merge_golden_task_bucket(
    *,
    existing: dict[str, Any] | None,
    patch: dict[str, Any],
) -> dict[str, Any]:
    base = dict(existing) if _is_dict(existing) else {}
    _preserve_invoke(merged=patch, existing=base)
    merged = dict(base)
    merged.update(patch)
    if "invoke" not in merged:
        merged["invoke"] = empty_invoke_state()
    else:
        merged["invoke"] = read_task_invoke(merged)
    return merged
