"""writing_form_tools — schema 保存."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

from writing.writing_form_tools import save_writing_form_schema  # type: ignore


class _FakeState(dict):
    pass


class _FakeToolContext:
    def __init__(self) -> None:
        self.state = _FakeState()


def test_save_writing_form_schema_updates_state():
    ctx = _FakeToolContext()
    result = save_writing_form_schema(
        title="補助金申請",
        fields=[
            {
                "key": "company_name",
                "label": "会社名",
                "type": "text",
                "required": True,
            }
        ],
        tool_context=ctx,
    )
    assert result["ok"] is True
    assert ctx.state["writing"]["phase"] == "format_review"
    assert len(ctx.state["writing"]["payload"]["form"]["fields"]) == 1


def test_add_json_document_persists_gcs_artifact_ref():
    from writing.writing_form_tools import add_json_document  # type: ignore

    ctx = _FakeToolContext()
    ctx.state["writing"] = {
        "phase": "filling",
        "payload": {
            "form": {
                "fields": [
                    {
                        "key": "company_name",
                        "label": "会社名",
                        "type": "text",
                        "required": True,
                    }
                ]
            }
        },
    }
    artifact_ref = {
        "filename": "申請書_ab12cd34.json",
        "version": 0,
        "kind": "json_document",
        "mime_type": "application/json; charset=utf-8",
    }
    csv_artifact_ref = {
        "filename": "申請書_ab12cd34.csv",
        "version": 0,
        "kind": "csv_document",
        "mime_type": "text/csv; charset=utf-8",
    }

    async def _run():
        with patch(
            "writing.writing_form_tools.save_text_artifact",
            new_callable=AsyncMock,
            side_effect=[artifact_ref, csv_artifact_ref],
        ):
            return await add_json_document(
                title="申請書",
                payload={"company_name": "株式会社テスト"},
                tool_context=ctx,
            )

    result = asyncio.run(_run())
    assert result["ok"] is True
    assert result["artifact_refs"] == [artifact_ref, csv_artifact_ref]
    assert ctx.state["writing"]["phase"] == "done"
    assert (
        ctx.state["writing"]["payload"]["form"]["fields"][0]["value"]
        == "株式会社テスト"
    )


def test_save_writing_form_schema_rejects_empty_fields():
    ctx = _FakeToolContext()
    result = save_writing_form_schema(
        title=None,
        fields=[],
        tool_context=ctx,
    )
    assert result["ok"] is False
