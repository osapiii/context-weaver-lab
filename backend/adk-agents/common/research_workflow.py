"""Research session state — invoke 前 patch / turn context / validation."""
from __future__ import annotations

from typing import Any

from .golden_task_bucket_io import (
    research_flat_to_golden,
    research_golden_to_effective_flat,
)

# キオスク一気通貫: 1 回の invoke 内でサーバーが ADK ターンを継続する
RESEARCH_AUTONOMOUS_CONTINUE_MESSAGE = (
    "はい、承認します。承認済みプランに沿って次のステップを実行してください。"
)
RESEARCH_AUTONOMOUS_MAX_TURNS = 15

_RESEARCH_PHASES = frozenset(
    {
        "plan_review",
        "phase1_hearing",
        "phase1_8_research",
        "phase2_svg",
        "phase3_html",
    }
)

_RESEARCH_FLAT_KEYS = (
    "current_phase",
    "theme",
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
    "auto_mode",
    "pipeline_autonomous",
    "plan_only",
    "plan_draft",
    "workflow_phase",
    "notification_email",
    "deck_id",
    "deck_dir",
    "research_path",
    "research_html_path",
)


def _effective_research_flat(mode_state: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(mode_state, dict):
        return {}
    bucket = mode_state.get("research")
    flat = (
        research_golden_to_effective_flat(bucket)
        if isinstance(bucket, dict)
        else {}
    )
    for key in _RESEARCH_FLAT_KEYS:
        if key not in flat and mode_state.get(key) is not None:
            flat[key] = mode_state[key]
    return flat


def research_state_patch_from_mode_state(
    mode_state: dict[str, Any] | None,
) -> dict[str, Any]:
    """invoke 用 mode_state → golden `state.research` patch."""
    if not isinstance(mode_state, dict):
        return {}
    bucket = mode_state.get("research")
    flat: dict[str, Any] = dict(bucket) if isinstance(bucket, dict) else {}
    for key in _RESEARCH_FLAT_KEYS:
        if key not in flat and mode_state.get(key) is not None:
            flat[key] = mode_state[key]
    return research_flat_to_golden(flat)


def research_turn_context_summary(*, mode_state: dict[str, Any] | None) -> str:
    if not isinstance(mode_state, dict):
        return ""
    flat = _effective_research_flat(mode_state)
    lines: list[str] = []
    phase = flat.get("current_phase")
    if isinstance(phase, str) and phase.strip():
        lines.append(f"- 現在フェーズ: {phase.strip()}")
    theme = flat.get("theme") or flat.get("briefing_theme")
    if isinstance(theme, str) and theme.strip():
        lines.append(f"- テーマ: {theme.strip()}")
    audience = flat.get("briefing_audience")
    if isinstance(audience, str) and audience.strip():
        lines.append(f"- 活用者: {audience.strip()}")
    use_case = flat.get("briefing_use_case")
    if isinstance(use_case, str) and use_case.strip():
        lines.append(f"- 活用方法: {use_case.strip()}")
    org_name = flat.get("organization_name")
    if isinstance(org_name, str) and org_name.strip():
        lines.append(f"- 組織: {org_name.strip()}")
    space_name = flat.get("space_name")
    if isinstance(space_name, str) and space_name.strip():
        lines.append(f"- スペース: {space_name.strip()}")
    file_space = flat.get("file_space_id")
    if isinstance(file_space, str) and file_space.strip():
        lines.append(f"- Agent Search fileSpaceId: {file_space.strip()}")
    context_status = flat.get("context_status")
    if context_status == "ready":
        lines.append("- コンテキスト状態: 企業コンテキストあり")
    elif context_status == "limited":
        lines.append("- コンテキスト状態: 企業コンテキスト不足 (一般論寄りになる可能性)")
    context_warning = flat.get("context_warning")
    if isinstance(context_warning, str) and context_warning.strip():
        lines.append(f"- 注意: {context_warning.strip()}")
    if flat.get("plan_only") is True:
        lines.append("- 実行モード: プラン素案のみ (plan_only)")
    elif flat.get("pipeline_autonomous") is True:
        lines.append("- 実行モード: 一気通貫パイプライン (中間承認なし)")
    elif flat.get("auto_mode") is True:
        lines.append("- 自動進行モード: ON (legacy)")
    return "\n".join(lines)


def is_research_plan_only(mode_state: dict[str, Any] | None) -> bool:
    if not isinstance(mode_state, dict):
        return False
    flat = _effective_research_flat(mode_state)
    return flat.get("plan_only") is True


def research_plan_only_instruction_text() -> str:
    return (
        "# リサーチプラン素案生成 (plan_only)\n\n"
        "ユーザーは Briefing を送信済みです。**フルパイプラインは実行しない**でください。\n\n"
        "1. Briefing 内容から research-v13 整合のプラン素案 "
        "(deck + sections[] + concerns[]) を組み立てる\n"
        "2. **`save_research_plan_draft(plan_json=...)` を 1 回呼ぶ** — "
        "JSON 文字列で渡す (sections は口語の疑問文、最低 2 件推奨)\n"
        "3. tool が ok=true になったら **text-only で完了報告して終了** "
        "(save_research_tool / generate_svgs / build_research_html は呼ばない)\n"
    )


def is_research_pipeline_autonomous(mode_state: dict[str, Any] | None) -> bool:
    if not isinstance(mode_state, dict):
        return False
    flat = _effective_research_flat(mode_state)
    return flat.get("pipeline_autonomous") is True


def is_research_pipeline_terminal(session_state: dict[str, Any] | None) -> bool:
    """research.html まで生成済みか (session.state.research payload)."""
    if not isinstance(session_state, dict):
        return False
    bucket = session_state.get("research")
    flat = (
        research_golden_to_effective_flat(bucket)
        if isinstance(bucket, dict)
        else {}
    )
    html_path = flat.get("research_html_path")
    return isinstance(html_path, str) and bool(html_path.strip())


def research_autonomous_instruction_text() -> str:
    return (
        "# 一気通貫リサーチパイプライン (pipeline_autonomous)\n\n"
        "ユーザーは Briefing でプランを承認済みです。**この invoke 内で完走**してください。\n\n"
        "1. `phase1_hearing` → `phase1_8_research` で research.json を "
        "`save_research_tool` まで確定 (schema 違反時は修正して再保存)\n"
        "2. `generate_svgs_tool` で図解 SVG を生成\n"
        "3. `build_research_html_tool` で research.html を生成\n\n"
        "**都度ユーザー承認は不要**。text-only で止まらず、可能な限り "
        "text + function_call で tool を連続実行してください。"
        "完了報告は research_html_path が state に入ってから 1 回だけ。"
    )


def validate_research_invoke(
    *,
    agent_mode: str,
    mode_state: dict[str, Any] | None,
) -> str | None:
    if agent_mode != "research":
        return None
    if not isinstance(mode_state, dict):
        return None
    flat = _effective_research_flat(mode_state)
    phase = flat.get("current_phase")
    if phase is not None and str(phase).strip() and str(phase) not in _RESEARCH_PHASES:
        return f"INVALID_RESEARCH_PHASE:{phase}"
    return None
