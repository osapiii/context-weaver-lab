"""文書フォーム state 更新 tools."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any

from common.adk_artifact_io import (
    build_custom_metadata,
    safe_artifact_filename,
    save_text_artifact,
)
from common.tool_state import get_writable_state, read_tool_state
from common.workspace_state_buckets import (
    effective_writing_state,
    task_bucket_from_session_state,
)

from .schemas import WritingFormFieldModel, WritingFormModel, writing_form_to_state_dict


def _read_writing_golden_bucket(tool_context: Any) -> dict[str, Any]:
    session_state = read_tool_state(tool_context)
    return task_bucket_from_session_state(session_state, "writing")


def _writing_flat(tool_context: Any) -> dict[str, Any]:
    return effective_writing_state(read_tool_state(tool_context))


def _write_writing_golden_bucket(
    tool_context: Any, patch: dict[str, Any]
) -> dict[str, Any]:
    """golden state.writing をマージして ADK State に書き戻す."""
    writable = get_writable_state(tool_context)
    session_state = read_tool_state(tool_context)
    bucket = dict(_read_writing_golden_bucket(tool_context))
    bucket.update(patch)
    if writable is not None:
        writable["writing"] = bucket
    return bucket


def save_writing_form_schema(
    title: str | None,
    fields: list[dict[str, Any]],
    tool_context: Any = None,
) -> dict[str, Any]:
    """参考資料から抽出した入力項目定義を session.state に保存する.

    Args:
        title: フォーム全体のタイトル (任意).
        fields: 項目定義の配列 (key, label, type, required, hint, options).
    """
    try:
        parsed_fields = [WritingFormFieldModel.model_validate(f) for f in fields]
        form = WritingFormModel(title=title, fields=parsed_fields)
    except Exception as exc:
        return {"ok": False, "error": f"invalid_schema: {exc}"}

    form_dict = writing_form_to_state_dict(form)
    bucket = _read_writing_golden_bucket(tool_context)
    payload = bucket.get("payload") if isinstance(bucket.get("payload"), dict) else {}
    payload = dict(payload)
    payload["form"] = form_dict
    _write_writing_golden_bucket(
        tool_context,
        {"phase": "format_review", "payload": payload},
    )

    return {
        "ok": True,
        "writing_form": form_dict,
        "writing_phase": "format_review",
        "field_count": len(parsed_fields),
        "message": f"{len(parsed_fields)} 件の入力項目を保存しました。",
    }


def confirm_writing_schema(tool_context: Any = None) -> dict[str, Any]:
    """スキーマ確定 — schema_confirmed_at を設定 (FE 確定の補助)."""
    bucket = _read_writing_golden_bucket(tool_context)
    payload = bucket.get("payload") if isinstance(bucket.get("payload"), dict) else {}
    form = payload.get("form")
    if not isinstance(form, dict):
        return {"ok": False, "error": "writing_form_missing"}
    fields = form.get("fields")
    if not isinstance(fields, list) or len(fields) < 1:
        return {"ok": False, "error": "writing_form_empty"}

    confirmed_at = datetime.now(timezone.utc).isoformat()
    form = dict(form)
    form["schema_confirmed_at"] = confirmed_at
    payload = dict(payload)
    payload["form"] = form
    _write_writing_golden_bucket(
        tool_context,
        {"phase": "filling", "payload": payload},
    )

    return {
        "ok": True,
        "writing_phase": "filling",
        "schema_confirmed_at": confirmed_at,
        "message": "入力フォーマットを確定しました。各項目の値を入力してください。",
    }


def read_writing_form_status(tool_context: Any = None) -> dict[str, Any]:
    """現在の writing_form / writing_phase を返す."""
    flat = _writing_flat(tool_context)
    return {
        "ok": True,
        "writing_phase": flat.get("writing_phase", "format_review"),
        "writing_form": flat.get("writing_form"),
        "writing_reference": flat.get("writing_reference"),
    }


def _merge_payload_into_form_fields(
    form: dict[str, Any],
    payload: dict[str, Any],
) -> dict[str, Any]:
    form = dict(form)
    fields = form.get("fields")
    if not isinstance(fields, list):
        return form
    merged_fields: list[dict[str, Any]] = []
    for field in fields:
        if not isinstance(field, dict):
            continue
        item = dict(field)
        key = item.get("key")
        if isinstance(key, str) and key in payload:
            raw = payload[key]
            item["value"] = raw if isinstance(raw, str) else str(raw)
        merged_fields.append(item)
    form["fields"] = merged_fields
    return form


def _build_writing_csv_body(form: dict[str, Any], payload: dict[str, Any]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["項目名", "キー", "値"])
    fields = form.get("fields")
    if isinstance(fields, list):
        for field in fields:
            if not isinstance(field, dict):
                continue
            key = field.get("key")
            label = field.get("label")
            label_s = label if isinstance(label, str) and label.strip() else key
            key_s = key if isinstance(key, str) else ""
            raw = payload.get(key_s) if key_s else ""
            value_s = raw if isinstance(raw, str) else str(raw) if raw is not None else ""
            writer.writerow(
                [
                    label_s if isinstance(label_s, str) else "",
                    key_s,
                    value_s,
                ]
            )
    return buf.getvalue()


async def add_json_document(
    title: str,
    payload: dict[str, Any],
    tool_context: Any = None,
) -> dict[str, Any]:
    """JSON 成果物を ADK GCS Artifact として保存し UI ref を返す.

    Args:
        title: 成果物タイトル.
        payload: フィールド key をトップレベルキーとしたオブジェクト.
    """
    payload_json = json.dumps(payload, ensure_ascii=False)
    doc_title = (title or "").strip() or "writing_filled"
    form_for_csv: dict[str, Any] = {}
    if tool_context is not None:
        bucket = _read_writing_golden_bucket(tool_context)
        payload_bucket = (
            bucket.get("payload") if isinstance(bucket.get("payload"), dict) else {}
        )
        payload_bucket = dict(payload_bucket)
        form = payload_bucket.get("form")
        if isinstance(form, dict):
            form_for_csv = dict(form)
            payload_bucket["form"] = _merge_payload_into_form_fields(form, payload)
        _write_writing_golden_bucket(
            tool_context,
            {"phase": "done", "payload": payload_bucket},
        )

    csv_body = _build_writing_csv_body(form_for_csv, payload)

    result: dict[str, Any] = {
        "ok": True,
        "title": doc_title,
        "payload": payload,
        "payload_json": payload_json,
        "writing_phase": "done",
    }

    artifact_refs: list[dict[str, Any]] = []
    json_ref = await save_text_artifact(
        tool_context,
        filename=safe_artifact_filename(doc_title, ".json"),
        body=payload_json,
        mime_type="application/json; charset=utf-8",
        kind="json_document",
        title=f"{doc_title}.json",
        custom_metadata=build_custom_metadata(
            kind="json_document",
            title=f"{doc_title}.json",
        ),
    )
    if json_ref:
        artifact_refs.append(json_ref)

    csv_ref = await save_text_artifact(
        tool_context,
        filename=safe_artifact_filename(doc_title, ".csv"),
        body=csv_body,
        mime_type="text/csv; charset=utf-8",
        kind="csv_document",
        title=f"{doc_title}.csv",
        custom_metadata=build_custom_metadata(
            kind="csv_document",
            title=f"{doc_title}.csv",
        ),
    )
    if csv_ref:
        artifact_refs.append(csv_ref)

    if artifact_refs:
        result["artifact_refs"] = artifact_refs
        return result

    result["artifacts"] = [
        {
            "kind": "json_document",
            "title": f"{doc_title}.json",
            "body": payload_json,
        },
        {
            "kind": "csv_document",
            "title": f"{doc_title}.csv",
            "body": csv_body,
        },
    ]
    return result
