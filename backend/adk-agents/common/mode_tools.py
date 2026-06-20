"""Workspace mode 切替 tool — ADK session state + SSE mode_change 用."""
from __future__ import annotations

from typing import Any, Literal

WorkspaceMode = Literal[
    "writing",
    "sheet",
    "image",
    "consultation",
    "research",
    "data_analysis",
    "web_page",
    "application_scan",
    "vibe_control",
]

_VALID_MODES = frozenset(
    {
        "writing",
        "sheet",
        "image",
        "consultation",
        "research",
        "data_analysis",
        "web_page",
        "application_scan",
        "vibe_control",
    }
)


def convert_mode(
    mode: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """AI Studio の workspace mode を切り替える (専用ツール実行の前に呼ぶ).

    画像生成・文書作成・シート編集など、現在の mode では対応できない依頼を
    受けたとき、**他の tool を呼ぶ前** に本ツールで mode を切り替える.
    サーバーは同一 HTTP リクエスト内で切替先エージェントへハンドオフする.

    Args:
        mode: 切り替え先 ("writing" | "sheet" | "image" | "consultation" | "research" | "data_analysis" | "web_page" | "application_scan" | "vibe_control")
        reason: 切替理由 (1 行、UI 表示用)

    Returns:
        workspace_mode キーで SSE mode_change が frontend に伝播する.
    """
    normalized = (mode or "").strip().lower()
    if normalized not in _VALID_MODES:
        return {
            "ok": False,
            "error": f"invalid mode: {mode}",
        }
    return {
        "ok": True,
        "workspace_mode": normalized,
        "reason": (reason or "").strip() or None,
    }


def set_workspace_mode(
    mode: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """非推奨: `convert_mode` を使用してください."""
    return convert_mode(mode, reason)
