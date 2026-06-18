"""取引先登録 — phase 更新と構造化ドラフト保存."""
from __future__ import annotations

import json
from typing import Any

from common.task_invoke_state import append_invoke_log

from .schemas import (
    BusinessPartnerDraftModel,
    BusinessPartnerFieldsModel,
    BusinessPartnerSourceRef,
    fields_to_camel_dict,
)


def _session_state(tool_context: Any) -> dict[str, Any]:
    state = getattr(tool_context, "state", None)
    return state if isinstance(state, dict) else {}


def _business_partner_bucket(tool_context: Any) -> dict[str, Any]:
    state = _session_state(tool_context)
    bucket = state.get("business_partner")
    if not isinstance(bucket, dict):
        bucket = {}
        state["business_partner"] = bucket
    return bucket


def update_business_partner_phase(
    phase: str,
    message: str = "",
    tool_context: Any = None,
) -> dict[str, Any]:
    """UI / RequestDoc 向けに進捗フェーズを session.state に記録する.

    Args:
        phase: url_submitted | lookup_done | researching | structuring | done | error
        message: ユーザー向け短い進捗メッセージ.
    """
    allowed = {
        "url_submitted",
        "lookup_done",
        "researching",
        "structuring",
        "done",
        "error",
    }
    normalized = (phase or "").strip().lower()
    if normalized not in allowed:
        return {"ok": False, "error": f"invalid_phase: {phase}"}

    bucket = _business_partner_bucket(tool_context)
    bucket["phase"] = normalized
    if message.strip():
        append_invoke_log(
            bucket=bucket,
            message=f"[{normalized}] {message.strip()}",
        )

    return {
        "ok": True,
        "phase": normalized,
        "message": message.strip() or normalized,
    }


def save_business_partner_draft(
    comment: str,
    fields: dict[str, Any],
    sources: list[dict[str, Any]] | None = None,
    tool_context: Any = None,
) -> dict[str, Any]:
    """調査結果を構造化ドラフトとして保存し json_document 成果物を返す.

    Args:
        comment: ユーザー向け短い説明.
        fields: 取引先フィールド (snake_case / camelCase 混在可).
        sources: 参考 URL 一覧 [{title, uri}].
    """
    try:
        parsed_fields = BusinessPartnerFieldsModel.model_validate(fields or {})
    except Exception as exc:
        return {"ok": False, "error": f"invalid_fields: {exc}"}

    source_models: list[BusinessPartnerSourceRef] = []
    for item in sources or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        uri = str(item.get("uri") or item.get("url") or "").strip()
        if title or uri:
            source_models.append(BusinessPartnerSourceRef(title=title, uri=uri))

    draft = BusinessPartnerDraftModel(
        comment=(comment or "").strip(),
        fields=parsed_fields,
        sources=source_models,
    )
    camel_fields = fields_to_camel_dict(parsed_fields)
    payload = {
        "comment": draft.comment,
        "fields": camel_fields,
        "sources": [s.model_dump() for s in source_models],
    }

    bucket = _business_partner_bucket(tool_context)
    bucket["phase"] = "done"
    bucket["artifact"] = payload
    bucket["draft"] = payload

    payload_json = json.dumps(payload, ensure_ascii=False)
    return {
        "ok": True,
        "phase": "done",
        "comment": draft.comment,
        "field_count": len(camel_fields),
        "business_partner": {
            "phase": "done",
            "draft": payload,
        },
        "artifacts": [
            {
                "kind": "json_document",
                "title": "business_partner_draft",
                "body": payload_json,
            }
        ],
        "message": draft.comment or "取引先ドラフトを保存しました。",
    }
