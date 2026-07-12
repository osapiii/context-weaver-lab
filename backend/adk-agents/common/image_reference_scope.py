"""invoke 中の image_reference — ADK tool が session state を読めない場合の fallback."""
from __future__ import annotations

import contextvars
from typing import Any

current_invoke_image_reference: contextvars.ContextVar[dict[str, Any] | None] = (
    contextvars.ContextVar("current_invoke_image_reference", default=None)
)


def activate_invoke_image_reference(
    image_reference: dict[str, Any] | None,
) -> contextvars.Token[dict[str, Any] | None] | None:
    if not image_reference:
        return None
    return current_invoke_image_reference.set(image_reference)


def deactivate_invoke_image_reference(
    token: contextvars.Token[dict[str, Any] | None] | None,
) -> None:
    if token is None:
        return
    current_invoke_image_reference.reset(token)


def get_invoke_image_reference() -> dict[str, Any] | None:
    return current_invoke_image_reference.get()
