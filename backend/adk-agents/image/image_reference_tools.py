"""画像リファレンス確定ツール."""
from __future__ import annotations

from typing import Any

from common.image_reference import (  # type: ignore
    confirm_image_reference_state,
    empty_image_reference_state,
    get_image_reference_from_state,
    resolve_image_creation_mode,
)
from common.tool_state import get_writable_state, read_tool_state


def _write_image_reference(
    tool_context: Any, image_reference: dict[str, Any]
) -> None:
    writable = get_writable_state(tool_context)
    if writable is None:
        return
    session_state = read_tool_state(tool_context)
    image_raw = session_state.get("image")
    image = dict(image_raw) if isinstance(image_raw, dict) else {}
    setup_raw = image.get("setup")
    setup = dict(setup_raw) if isinstance(setup_raw, dict) else {}
    setup["reference"] = image_reference
    image["setup"] = setup
    writable["image"] = image


def confirm_image_references(tool_context: Any = None) -> dict[str, Any]:
    """session state の references を確定 (status=complete).

    FE の「参照を確定」ボタンから mode_state 経由でも同等の更新が可能.
    本ツールは LLM が確定を認識しやすくするための補助.
    """
    creation_mode = resolve_image_creation_mode(tool_context)
    if creation_mode == "scratch":
        empty = empty_image_reference_state()
        _write_image_reference(tool_context, empty)
        return {
            "ok": True,
            "skipped": True,
            "image_reference": empty,
            "message": (
                "0から新規モードのため参照確定は不要です。"
                "generate_image をそのまま呼び出してください。"
            ),
        }

    session_state = read_tool_state(tool_context)
    result = confirm_image_reference_state(session_state)
    if not result.get("ok"):
        return result

    image_reference = result["image_reference"]
    _write_image_reference(tool_context, image_reference)

    return {
        "ok": True,
        "image_reference": image_reference,
        "message": "リファレンス画像を確定しました。generate_image を実行できます。",
    }


def read_image_reference_status(tool_context: Any = None) -> dict[str, Any]:
    """現在の image_reference ステータスを返す (デバッグ / LLM 用)."""
    session_state = read_tool_state(tool_context)
    image_reference = get_image_reference_from_state(session_state)
    creation_mode = resolve_image_creation_mode(tool_context)
    return {
        "ok": True,
        "image_creation_mode": creation_mode,
        "image_reference": image_reference,
    }
