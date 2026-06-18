"""AI Studio 画像スタジオ — create / retouch フェーズ (golden state.image のみ)."""
from __future__ import annotations

from typing import Any, Literal

from .tool_state import read_tool_state
from .workspace_state_buckets import (
    effective_image_mode_state,
    merge_task_buckets,
    patch_task_bucket,
    task_bucket_from_mode_state,
    task_bucket_from_session_state,
)

ImageWorkflowPhase = Literal["create", "retouch"]


def mode_state_from_tool_context(tool_context: Any) -> dict[str, Any]:
    """ADK tool — session.state.image を flat tool ビューに正規化."""
    session_state = read_tool_state(tool_context)
    return effective_image_mode_state(session_state=session_state)


def _phase_from_golden_bucket(bucket: dict[str, Any]) -> ImageWorkflowPhase | None:
    raw = bucket.get("phase")
    if raw in ("create", "retouch"):
        return raw  # type: ignore[return-value]
    return None


def resolve_image_workflow_phase(
    *,
    mode_state: dict[str, Any] | None = None,
    session_state: dict[str, Any] | None = None,
) -> ImageWorkflowPhase:
    from .image_workflow_phase_scope import get_invoke_image_workflow_phase

    scoped = get_invoke_image_workflow_phase()
    if scoped in ("create", "retouch"):
        return scoped

    session_bucket = task_bucket_from_session_state(session_state, "image")
    request_bucket = task_bucket_from_mode_state(mode_state, "image")
    session_phase = _phase_from_golden_bucket(session_bucket)
    request_phase = _phase_from_golden_bucket(request_bucket)
    if session_phase == "retouch" and request_phase == "create":
        return "retouch"

    bucket = merge_task_buckets(
        session_state=session_state,
        mode_state=mode_state,
        task="image",
    )
    phase = _phase_from_golden_bucket(bucket)
    if phase:
        return phase

    if isinstance(mode_state, dict):
        effective = effective_image_mode_state(mode_state=mode_state)
        flat_phase = effective.get("image_workflow_phase")
        if flat_phase in ("create", "retouch"):
            return flat_phase  # type: ignore[return-value]

    return "create"


def _primary_from_golden_bucket(bucket: dict[str, Any]) -> dict[str, Any] | None:
    raw = bucket.get("primary")
    if isinstance(raw, dict) and raw.get("adk_filename"):
        return raw
    return None


def _primary_image_from_mode_state(mode_state: dict[str, Any]) -> dict[str, Any] | None:
    """flat tool ビュー (primary_image) または golden primary."""
    raw = mode_state.get("primary_image")
    if raw is None:
        raw = mode_state.get("primary")
    if isinstance(raw, dict) and raw.get("adk_filename"):
        return raw
    return None


def _retouch_regions_from_mode_state(mode_state: dict[str, Any]) -> list[dict[str, Any]]:
    raw = mode_state.get("retouch_regions")
    if isinstance(raw, list):
        return [r for r in raw if isinstance(r, dict)]
    return []


def validate_image_studio_invoke(
    *,
    agent_mode: str,
    mode_state: dict[str, Any] | None,
) -> str | None:
    if agent_mode != "image":
        return None
    if not isinstance(mode_state, dict):
        return None
    effective = effective_image_mode_state(mode_state=mode_state)
    phase = resolve_image_workflow_phase(mode_state=mode_state)
    if phase == "retouch":
        primary = _primary_image_from_mode_state(effective)
        if not primary:
            return "IMAGE_PRIMARY_NOT_SET"
    return None


def _image_studio_golden_bucket_from_sources(
    *,
    mode_state: dict[str, Any] | None,
    session_state: dict[str, Any] | None,
) -> dict[str, Any]:
    bucket = merge_task_buckets(
        session_state=session_state,
        mode_state=mode_state,
        task="image",
    )
    effective = effective_image_mode_state(
        mode_state=mode_state,
        session_state=session_state,
    )
    phase = resolve_image_workflow_phase(
        mode_state=mode_state,
        session_state=session_state,
    )
    golden: dict[str, Any] = {"phase": phase}
    primary = _primary_from_golden_bucket(bucket) or _primary_image_from_mode_state(
        effective
    )
    if primary:
        golden["primary"] = primary
    regions = bucket.get("retouch_regions")
    if isinstance(regions, list) and regions:
        golden["retouch_regions"] = list(regions)
    creation = effective.get("image_creation_mode")
    if creation in ("scratch", "reference"):
        setup: dict[str, Any] = {
            "confirmed": effective.get("image_mode_selected") is True
        }
        setup["creation"] = creation
        ref = effective.get("image_reference")
        if isinstance(ref, dict):
            setup["reference"] = ref
        golden["setup"] = setup
    return golden


def image_studio_state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    if not isinstance(mode_state, dict):
        return {}
    golden = _image_studio_golden_bucket_from_sources(
        mode_state=mode_state,
        session_state=None,
    )
    patch: dict[str, Any] = {}
    patch_task_bucket(patch, "image", golden, active_task="image")
    return patch


def image_studio_patch_from_session_state(
    session_state: dict[str, Any],
) -> dict[str, Any]:
    golden = _image_studio_golden_bucket_from_sources(
        session_state=session_state,
        mode_state=None,
    )
    patch: dict[str, Any] = {}
    patch_task_bucket(patch, "image", golden, active_task="image")
    return patch


def merge_image_invoke_mode_state(
    *,
    session_state: dict[str, Any],
    request_mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    """invoke request の golden image を session 上にマージ."""
    merged = dict(request_mode_state or {})
    golden = _image_studio_golden_bucket_from_sources(
        session_state=session_state,
        mode_state=merged,
    )
    if golden:
        merged["image"] = golden
    merged["active_mode"] = "image"
    return merged


def image_studio_turn_context_summary(
    *,
    mode_state: dict[str, Any] | None,
) -> str | None:
    if not isinstance(mode_state, dict):
        return None
    effective = effective_image_mode_state(mode_state=mode_state)
    phase = resolve_image_workflow_phase(mode_state=mode_state)
    lines = [
        f"- **現在のフェーズ**: `{phase}`",
    ]
    if phase == "create":
        lines.extend(
            [
                "- **使用ツール**: `generate_image` のみ（OpenAI gpt-image-2）。",
                "- `retouch_image` はこのフェーズでは呼ばない。",
            ]
        )
        creation = effective.get("image_creation_mode")
        if creation in ("scratch", "reference"):
            lines.append(f"- **作成方法**: `{creation}`")
        return "\n".join(lines)

    primary = _primary_image_from_mode_state(effective)
    if not primary:
        return (
            "フェーズは retouch ですが primary が未設定です。"
            "ユーザーに初稿生成を促してください。"
        )
    filename = primary.get("adk_filename")
    version = primary.get("version")
    lines.extend(
        [
            "- **使用ツール**: `retouch_image`（OpenAI gpt-image-2 images.edit）。",
            "- `generate_image` はこのフェーズでは呼ばない。",
            f"- **編集対象 (primary)**: `{filename}`"
            + (f" version={version}" if version is not None else ""),
            "- 住所・社名・商品仕様など **事実の差し替え** がある場合: "
            "先に Agent Search → 根拠は `add_citation` → その後 `retouch_image`。",
            "- 見た目のみの調整で事実確認が不要なら、質問せず `retouch_image` を実行する。",
        ]
    )
    regions = _retouch_regions_from_mode_state(effective)
    if regions:
        lines.append(f"- **指定範囲**: {len(regions)} 件")
        for idx, region in enumerate(regions[:5], start=1):
            instr = str(region.get("instruction") or "").strip()
            bbox = region.get("bbox")
            lines.append(
                f"  {idx}. bbox={bbox} — {instr[:120]}"
                if instr
                else f"  {idx}. bbox={bbox}"
            )
    else:
        lines.append(
            "- 範囲指定なし: プロンプト全体を retouch の変更指示として扱う。"
        )
    return "\n".join(lines)
