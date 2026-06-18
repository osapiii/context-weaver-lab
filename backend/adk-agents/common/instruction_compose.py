"""LlmAgent instruction の合成ヘルパー."""
from __future__ import annotations

GLOBAL_PROMPT_SECTION_HEADER = "## ユーザー固有のグローバル指示"


def compose_instruction(base_instruction: str, global_prompt: str | None) -> str:
    if isinstance(global_prompt, str) and global_prompt.strip():
        return (
            f"{base_instruction}\n\n"
            f"{GLOBAL_PROMPT_SECTION_HEADER}\n"
            f"{global_prompt.strip()}\n"
        )
    return base_instruction
