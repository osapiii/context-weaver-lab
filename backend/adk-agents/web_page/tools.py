"""Tools for the AI Studio web page builder."""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Literal

from common.adk_artifact_io import (  # type: ignore
    build_custom_metadata,
    safe_artifact_filename,
    save_bytes_artifact,
    save_text_artifact,
)
from common.tool_state import read_tool_state  # type: ignore


def _web_page_bucket(tool_context: Any) -> dict[str, Any]:
    state = read_tool_state(tool_context)
    bucket = state.get("web_page")
    return dict(bucket) if isinstance(bucket, dict) else {}


def _setup_from_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    setup = bucket.get("setup")
    return dict(setup) if isinstance(setup, dict) else {}


def _reference_urls(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value[:3]:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def _patch_web_page_state(
    tool_context: Any,
    patch: dict[str, Any],
) -> None:
    writable = getattr(tool_context, "state", None)
    if writable is None or not hasattr(writable, "__setitem__"):
        return
    current = _web_page_bucket(tool_context)
    merged = {**current, **patch}
    writable["web_page"] = merged


def read_web_page_brief(tool_context: Any = None) -> dict[str, Any]:
    """Read the system-provided web page setup from session state."""
    bucket = _web_page_bucket(tool_context)
    setup = _setup_from_bucket(bucket)
    purpose = str(setup.get("purpose") or "").strip()
    page_type = str(setup.get("page_type") or "").strip()
    reference_urls = _reference_urls(setup.get("reference_urls"))
    missing = [
        label
        for label, value in (
            ("purpose", purpose),
            ("page_type", page_type),
        )
        if not value
    ]
    return {
        "ok": len(missing) == 0,
        "purpose": purpose,
        "page_type": page_type,
        "reference_urls": reference_urls,
        "missing": missing,
        "phase": bucket.get("phase") or "requirements",
    }


async def save_web_page_requirements(
    title: str,
    body_markdown: str,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Save the requirements definition as Markdown Artifact."""
    body = (body_markdown or "").strip()
    if not body:
        return {"ok": False, "error": "requirements body is empty"}
    filename = safe_artifact_filename(title or "web_page_requirements", ".md")
    ref = await save_text_artifact(
        tool_context,
        filename=filename,
        body=body,
        mime_type="text/markdown; charset=utf-8",
        kind="markdown_document",
        title=title or "WEBページ要件定義",
        custom_metadata=build_custom_metadata(
            kind="markdown_document",
            title=title or "WEBページ要件定義",
            phase="requirements",
        ),
    )
    _patch_web_page_state(
        tool_context,
        {
            "phase": "wireframe",
            "requirements": {"title": title, "body": body},
        },
    )
    return {
        "ok": True,
        "web_page": {"phase": "wireframe"},
        "artifact_refs": [ref] if ref else [],
    }


async def save_web_page_wireframe(
    title: str,
    body_markdown: str,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Save the page wireframe as Markdown Artifact."""
    body = (body_markdown or "").strip()
    if not body:
        return {"ok": False, "error": "wireframe body is empty"}
    filename = safe_artifact_filename(title or "web_page_wireframe", ".md")
    ref = await save_text_artifact(
        tool_context,
        filename=filename,
        body=body,
        mime_type="text/markdown; charset=utf-8",
        kind="markdown_document",
        title=title or "WEBページ ワイヤーフレーム",
        custom_metadata=build_custom_metadata(
            kind="markdown_document",
            title=title or "WEBページ ワイヤーフレーム",
            phase="wireframe",
        ),
    )
    _patch_web_page_state(
        tool_context,
        {
            "phase": "coding",
            "wireframe": {"title": title, "body": body},
        },
    )
    return {
        "ok": True,
        "web_page": {"phase": "coding"},
        "artifact_refs": [ref] if ref else [],
    }


async def save_landing_page_html(
    title: str,
    html: str,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Save the completed single-page LP HTML file."""
    body = (html or "").strip()
    if not body:
        return {"ok": False, "error": "html is empty"}
    if "<html" not in body.lower() or "</html>" not in body.lower():
        return {"ok": False, "error": "完全な HTML ドキュメントを渡してください"}
    filename = safe_artifact_filename(title or "landing_page", ".html")
    ref = await save_text_artifact(
        tool_context,
        filename=filename,
        body=body,
        mime_type="text/html; charset=utf-8",
        kind="html_document",
        title=title or "landing_page.html",
        custom_metadata=build_custom_metadata(
            kind="html_document",
            title=title or "landing_page.html",
            phase="coding",
        ),
    )
    _patch_web_page_state(
        tool_context,
        {
            "phase": "asset_generation",
            "artifact": {"html_filename": filename},
        },
    )
    return {
        "ok": True,
        "web_page": {"phase": "asset_generation"},
        "artifact_refs": [ref] if ref else [],
    }


def _resolve_openai_key() -> str | None:
    try:
        from common.openai_byok_scope import resolve_openai_api_key  # type: ignore

        return resolve_openai_api_key()
    except Exception:
        return os.environ.get("OPENAI_API_KEY")


async def generate_web_page_asset_image(
    name: str,
    prompt: str,
    aspect_ratio: str = "16:9",
    quality: Literal["standard", "high"] = "high",
    tool_context: Any = None,
) -> dict[str, Any]:
    """Generate one PNG asset for the landing page and save it as an Artifact."""
    api_key = _resolve_openai_key()
    if not api_key:
        return {
            "ok": False,
            "error": "OpenAI API キーが未登録です。設定 → AI 連携で登録してください。",
            "artifact_refs": [],
        }
    from image.openai_image_tools import (  # type: ignore
        _default_thinking,
        _generate_images_sync,
        _image_model,
        aspect_ratio_to_size,
    )

    clean_prompt = (prompt or "").strip()
    if not clean_prompt:
        return {"ok": False, "error": "image prompt is empty", "artifact_refs": []}
    try:
        image_bytes_list = await asyncio.to_thread(
            _generate_images_sync,
            api_key=api_key,
            prompt=clean_prompt,
            size=aspect_ratio_to_size(aspect_ratio),
            quality=quality if quality in ("standard", "high") else "high",
            count=1,
            thinking=_default_thinking(),
            model_id=_image_model(),
        )
    except Exception as exc:
        return {
            "ok": False,
            "error": f"画像素材の生成に失敗しました: {str(exc)[:300]}",
            "artifact_refs": [],
        }
    if not image_bytes_list:
        return {"ok": False, "error": "画像生成結果が空でした", "artifact_refs": []}
    filename = safe_artifact_filename(name or "web_page_asset", ".png")
    ref = await save_bytes_artifact(
        tool_context,
        filename=filename,
        data=image_bytes_list[0],
        mime_type="image/png",
        kind="image",
        title=name or "WEBページ素材",
        custom_metadata=build_custom_metadata(
            kind="image",
            title=name or "WEBページ素材",
            prompt=clean_prompt,
            phase="asset_generation",
        ),
    )
    return {
        "ok": True,
        "asset": {"name": name, "filename": filename, "prompt": clean_prompt},
        "artifact_refs": [ref] if ref else [],
    }


async def save_web_page_asset_manifest(
    title: str,
    assets: list[dict[str, Any]],
    tool_context: Any = None,
) -> dict[str, Any]:
    """Save a JSON manifest describing generated page assets."""
    clean_assets = [asset for asset in assets if isinstance(asset, dict)]
    body = json.dumps({"assets": clean_assets}, ensure_ascii=False, indent=2)
    filename = safe_artifact_filename(title or "web_page_assets", ".json")
    ref = await save_text_artifact(
        tool_context,
        filename=filename,
        body=body,
        mime_type="application/json; charset=utf-8",
        kind="json_document",
        title=title or "WEBページ素材マニフェスト",
        custom_metadata=build_custom_metadata(
            kind="json_document",
            title=title or "WEBページ素材マニフェスト",
            phase="asset_generation",
        ),
    )
    _patch_web_page_state(
        tool_context,
        {
            "phase": "done",
            "asset_manifest": {"assets": clean_assets},
        },
    )
    return {
        "ok": True,
        "web_page": {"phase": "done"},
        "artifact_refs": [ref] if ref else [],
    }
