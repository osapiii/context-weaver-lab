"""ADK Artifact Service 読み出しヘルパ."""
from __future__ import annotations

import base64
from typing import Any

from google.genai import types as gtypes

_ARTIFACT_KINDS = frozenset(
    {
        "image",
        "sheet_op",
        "text_block",
        "markdown_document",
        "html_document",
        "csv_document",
        "citation",
        "pptx",
        "plan_json",
        "narration",
        "html",
        "package",
        "other",
    }
)


def part_to_bytes_and_mime(part: gtypes.Part) -> tuple[bytes, str]:
    if part.text:
        return part.text.encode("utf-8"), "text/plain; charset=utf-8"
    inline = part.inline_data
    if inline and inline.data is not None:
        mime = inline.mime_type or "application/octet-stream"
        return inline.data, mime
    return b"", "application/octet-stream"


def part_to_json_payload(
    part: gtypes.Part,
    *,
    filename: str,
    version: int,
    custom_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta = dict(custom_metadata or {})
    kind = meta.get("kind")
    if not isinstance(kind, str) or kind not in _ARTIFACT_KINDS:
        kind = "other"
    title = meta.get("title") if isinstance(meta.get("title"), str) else None

    payload: dict[str, Any] = {
        "filename": filename,
        "version": version,
        "kind": kind,
    }
    if title:
        payload["title"] = title
    if meta:
        payload["custom_metadata"] = meta

    if part.text:
        payload["mime_type"] = "text/plain; charset=utf-8"
        payload["body"] = part.text
        return payload

    data, mime = part_to_bytes_and_mime(part)
    payload["mime_type"] = mime
    if mime.startswith("text/") or mime in {"application/json", "application/xml"}:
        payload["body"] = data.decode("utf-8", errors="replace")
    else:
        payload["data_base64"] = base64.b64encode(data).decode("ascii")
    return payload
