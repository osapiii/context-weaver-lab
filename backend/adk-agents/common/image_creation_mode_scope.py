"""invoke 中の image_creation_mode — ADK tool が mode_state を読めない場合の fallback."""
from __future__ import annotations

import contextvars

from typing import Literal

ImageCreationMode = Literal["scratch", "reference"]

current_invoke_image_creation_mode: contextvars.ContextVar[ImageCreationMode | None] = (
    contextvars.ContextVar("current_invoke_image_creation_mode", default=None)
)


def activate_invoke_image_creation_mode(
    mode: str | None,
) -> contextvars.Token[ImageCreationMode | None] | None:
    if not mode:
        return None
    value = mode.strip().lower()
    if value not in ("scratch", "reference"):
        return None
    return current_invoke_image_creation_mode.set(value)  # type: ignore[arg-type]


def deactivate_invoke_image_creation_mode(
    token: contextvars.Token[ImageCreationMode | None] | None,
) -> None:
    if token is None:
        return
    current_invoke_image_creation_mode.reset(token)


def get_invoke_image_creation_mode() -> ImageCreationMode | None:
    return current_invoke_image_creation_mode.get()
