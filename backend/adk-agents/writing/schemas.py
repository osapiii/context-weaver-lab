"""文書フォーム — Pydantic スキーマ (tool 検証用)."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


WritingFieldType = Literal["text", "textarea", "number", "date", "select"]
WritingPhase = Literal["format_review", "filling", "done"]


class WritingFormFieldModel(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=300)
    type: WritingFieldType = "text"
    required: bool = False
    hint: str | None = None
    custom_instruction: str | None = None
    options: list[str] | None = None
    value: str | None = None

    @field_validator("key")
    @classmethod
    def normalize_key(cls, value: str) -> str:
        cleaned = value.strip().replace(" ", "_")
        if not cleaned:
            raise ValueError("key must not be empty")
        return cleaned


class WritingFormModel(BaseModel):
    title: str | None = None
    fields: list[WritingFormFieldModel] = Field(min_length=1)
    schema_confirmed_at: str | None = None


def writing_form_to_state_dict(form: WritingFormModel) -> dict[str, Any]:
    return {
        "title": (form.title or "").strip() or None,
        "fields": [f.model_dump(exclude_none=True) for f in form.fields],
        "schema_confirmed_at": form.schema_confirmed_at,
    }
