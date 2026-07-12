"""invoke 中の image workflow phase — ADK tool が session state を読めない場合の fallback."""
from __future__ import annotations

import contextvars

from typing import Literal

ImageWorkflowPhase = Literal["create", "retouch"]

current_invoke_image_workflow_phase: contextvars.ContextVar[
    ImageWorkflowPhase | None
] = contextvars.ContextVar("current_invoke_image_workflow_phase", default=None)


def activate_invoke_image_workflow_phase(
    phase: str | None,
) -> contextvars.Token[ImageWorkflowPhase | None] | None:
    if not phase:
        return None
    value = phase.strip().lower()
    if value not in ("create", "retouch"):
        return None
    return current_invoke_image_workflow_phase.set(value)  # type: ignore[arg-type]


def deactivate_invoke_image_workflow_phase(
    token: contextvars.Token[ImageWorkflowPhase | None] | None,
) -> None:
    if token is None:
        return
    current_invoke_image_workflow_phase.reset(token)


def get_invoke_image_workflow_phase() -> ImageWorkflowPhase | None:
    return current_invoke_image_workflow_phase.get()
