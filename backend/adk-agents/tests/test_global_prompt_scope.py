"""Tests for global prompt scope + instruction composition."""
from __future__ import annotations

from common.agent_builder import _instruction_with_global_prompt
from common.global_prompt_scope import (
    activate_global_prompt,
    current_user_global_prompt,
    deactivate_global_prompt,
    resolve_global_prompt,
)
from common.instruction_compose import compose_instruction


def test_compose_instruction_appends_global_prompt():
    result = compose_instruction("BASE", "私はシーライフの社長です")
    assert result.startswith("BASE")
    assert "私はシーライフの社長です" in result


def test_instruction_provider_reads_request_contextvar():
    provider = _instruction_with_global_prompt("BASE")
    token = activate_global_prompt("私は事業会社の経営企画です")
    try:
        instruction = provider(None)
        assert "私は事業会社の経営企画です" in instruction
    finally:
        deactivate_global_prompt(token)
    assert current_user_global_prompt.get() is None


def test_instruction_provider_without_global_prompt():
    provider = _instruction_with_global_prompt("BASE ONLY")
    assert provider(None) == "BASE ONLY"


def test_resolve_global_prompt_prefers_request_override():
    resolved = resolve_global_prompt(
        firestore_prompt="Firestore",
        request_override="Override",
    )
    assert resolved == "Override"
