"""ADK Artifact Service への保存・読み出しヘルパ."""
from __future__ import annotations

import base64
import re
import unicodedata
import uuid
from typing import Any

from google.genai import types as gtypes

ARTIFACT_KINDS = frozenset(
    {
        "image",
        "sheet_op",
        "text_block",
        "markdown_document",
        "html_document",
        "json_document",
        "csv_document",
        "citation",
    }
)
_ARTIFACT_KINDS = ARTIFACT_KINDS


def safe_artifact_filename(title: str | None, suffix: str) -> str:
    """GCS artifact 用の安全なファイル名を生成する."""
    base = (title or "artifact").strip()
    normalized = unicodedata.normalize("NFKC", base)
    slug = re.sub(r"[^\w\u3040-\u30ff\u4e00-\u9faf-]+", "_", normalized)
    slug = slug.strip("_") or "artifact"
    slug = slug[:80]
    ext = suffix if suffix.startswith(".") else f".{suffix}"
    return f"{slug}_{uuid.uuid4().hex[:8]}{ext}"


def build_custom_metadata(
    *,
    kind: str,
    title: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    meta: dict[str, Any] = {"kind": kind}
    if title:
        meta["title"] = title
    for key, value in extra.items():
        if value is not None:
            meta[key] = value
    return meta


def artifact_ref_payload(
    *,
    filename: str,
    version: int,
    kind: str,
    title: str | None = None,
    mime_type: str | None = None,
    custom_metadata: dict[str, Any] | None = None,
    **extra: Any,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "filename": filename,
        "version": version,
        "kind": kind,
    }
    if title:
        payload["title"] = title
    if mime_type:
        payload["mime_type"] = mime_type
    if custom_metadata:
        payload["custom_metadata"] = custom_metadata
    for key, value in extra.items():
        if value is not None:
            payload[key] = value
    return payload


async def save_bytes_artifact(
    tool_context: Any,
    *,
    filename: str,
    data: bytes,
    mime_type: str,
    kind: str,
    title: str | None = None,
    custom_metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """tool_context 経由でバイナリ artifact を保存し artifact_ref を返す."""
    if tool_context is None:
        return None
    meta = custom_metadata or build_custom_metadata(kind=kind, title=title)
    part = gtypes.Part(
        inline_data=gtypes.Blob(mime_type=mime_type, data=data),
    )
    version = await tool_context.save_artifact(
        filename=filename,
        artifact=part,
        custom_metadata=meta,
    )
    return artifact_ref_payload(
        filename=filename,
        version=version,
        kind=kind,
        title=title,
        mime_type=mime_type,
        custom_metadata=meta,
    )


async def load_bytes_artifact(
    tool_context: Any,
    *,
    filename: str,
    version: int | None = None,
) -> bytes | None:
    """tool_context 経由で artifact バイナリを読み込む."""
    if tool_context is None:
        return None
    load_fn = getattr(tool_context, "load_artifact", None)
    if not callable(load_fn):
        return None
    try:
        kwargs: dict[str, Any] = {"filename": filename.strip()}
        if version is not None:
            kwargs["version"] = version
        part = await load_fn(**kwargs)
        if part is None:
            return None
        data, _mime = part_to_bytes_and_mime(part)
        return data if data else None
    except Exception:
        return None


async def save_text_artifact(
    tool_context: Any,
    *,
    filename: str,
    body: str,
    mime_type: str,
    kind: str,
    title: str | None = None,
    custom_metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """tool_context 経由でテキスト artifact を保存し artifact_ref を返す."""
    return await save_bytes_artifact(
        tool_context,
        filename=filename,
        data=body.encode("utf-8"),
        mime_type=mime_type,
        kind=kind,
        title=title,
        custom_metadata=custom_metadata,
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
        kind = "text_block"
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


async def resolve_artifact_ref_for_sse(
    *,
    artifact_service: Any,
    app_name: str,
    user_id: str,
    session_id: str,
    bucket_name: str,
    ref: dict[str, Any],
) -> dict[str, Any] | None:
    """ADK artifact ref を dialogue SSE `artifact` ペイロードに変換する."""
    if artifact_service is None or not bucket_name:
        return None
    filename = ref.get("filename")
    if not isinstance(filename, str) or not filename.strip():
        return None
    filename = filename.strip()
    version = ref.get("version")
    version_int: int | None = int(version) if isinstance(version, int) else None

    try:
        if version_int is None:
            version_info = await artifact_service.get_artifact_version(
                app_name=app_name,
                user_id=user_id,
                filename=filename,
                session_id=session_id,
            )
            if version_info is None:
                return None
            version_int = version_info.version
            mime_type = version_info.mime_type
            custom_metadata = dict(version_info.custom_metadata or {})
        else:
            version_info = await artifact_service.get_artifact_version(
                app_name=app_name,
                user_id=user_id,
                filename=filename,
                session_id=session_id,
                version=version_int,
            )
            mime_type = (
                version_info.mime_type if version_info is not None else None
            )
            custom_metadata = (
                dict(version_info.custom_metadata or {})
                if version_info is not None
                else {}
            )

        part: gtypes.Part | None = await artifact_service.load_artifact(
            app_name=app_name,
            user_id=user_id,
            filename=filename,
            session_id=session_id,
            version=version_int,
        )
        if part is None:
            return None

        meta = dict(custom_metadata)
        if isinstance(ref.get("kind"), str):
            meta["kind"] = ref["kind"]
        if isinstance(ref.get("title"), str):
            meta["title"] = ref["title"]
        kind = meta.get("kind")
        if not isinstance(kind, str) or kind not in _ARTIFACT_KINDS:
            kind = "text_block"

        if kind == "image":
            prompt = meta.get("prompt")
            payload: dict[str, Any] = {
                "kind": "image",
                "mime_type": mime_type or "image/png",
                "adk_filename": filename,
                "session_id": session_id,
                "version": version_int,
            }
            if isinstance(prompt, str) and prompt.strip():
                payload["prompt"] = prompt.strip()
            # 期限付き signed URL / data URL は SSE に載せない。
            # FE は /v1/sessions/{id}/artifacts/{filename} で都度取得する。
            return payload

        inline = part_to_json_payload(
            part,
            filename=filename,
            version=version_int,
            custom_metadata=meta,
        )
        title = meta.get("title")
        if isinstance(title, str) and title.strip():
            inline["title"] = title.strip()
        return inline
    except Exception:
        return None


def emit_tool_artifact_events(
    response: dict[str, Any],
) -> list[tuple[str, dict[str, Any]]]:
    """tool response から SSE artifact / artifact_ref イベントを組み立てる."""
    events: list[tuple[str, dict[str, Any]]] = []
    refs = response.get("artifact_refs") or []
    for ref in refs:
        if isinstance(ref, dict) and ref.get("filename"):
            events.append(("artifact_ref", ref))
    arts = response.get("artifacts") or []
    for art in arts:
        if isinstance(art, dict) and art.get("kind"):
            events.append(("artifact", art))
    return events
