"""OpenAI gpt-image-2 画像生成 tool — ADK GcsArtifactService 経由で保存."""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
from typing import Any, Literal

from common.adk_artifact_io import (  # type: ignore
    build_custom_metadata,
    save_bytes_artifact,
    safe_artifact_filename,
)
from common.image_reference import (  # type: ignore
    load_reference_images_bytes,
    resolve_image_creation_mode,
    resolve_image_reference_for_tool,
)
from common.openai_byok_scope import resolve_openai_api_key  # type: ignore
from common.tool_state import read_tool_state  # type: ignore

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "gpt-image-2"
_VALID_QUALITY = frozenset({"standard", "high"})
_VALID_THINKING = frozenset({"off", "low", "medium", "high"})

_ASPECT_TO_SIZE: dict[str, str] = {
    "1:1": "1024x1024",
    "16:9": "1536x1024",
    "9:16": "1024x1536",
    "4:3": "1536x1024",
    "3:4": "1024x1536",
}


def _image_model() -> str:
    return (os.environ.get("OPENAI_IMAGE_MODEL") or _DEFAULT_MODEL).strip()


def _default_thinking() -> str:
    raw = (os.environ.get("OPENAI_IMAGE_THINKING") or "off").strip().lower()
    return raw if raw in _VALID_THINKING else "off"


def aspect_ratio_to_size(aspect_ratio: str) -> str:
    normalized = (aspect_ratio or "1:1").strip()
    return _ASPECT_TO_SIZE.get(normalized, "1024x1024")


def _png_dimensions(image_bytes: bytes) -> tuple[int, int] | None:
    if len(image_bytes) < 24 or image_bytes[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    width = int.from_bytes(image_bytes[16:20], "big")
    height = int.from_bytes(image_bytes[20:24], "big")
    if width <= 0 or height <= 0:
        return None
    return width, height


def _jpeg_dimensions(image_bytes: bytes) -> tuple[int, int] | None:
    index = 2
    length = len(image_bytes)
    while index < length - 8:
        if image_bytes[index] != 0xFF:
            index += 1
            continue
        marker = image_bytes[index + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            height = int.from_bytes(image_bytes[index + 5 : index + 7], "big")
            width = int.from_bytes(image_bytes[index + 7 : index + 9], "big")
            if width > 0 and height > 0:
                return width, height
            return None
        if marker in (0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0x01):
            index += 2
            continue
        segment_length = int.from_bytes(image_bytes[index + 2 : index + 4], "big")
        if segment_length < 2:
            break
        index += 2 + segment_length
    return None


def image_bytes_to_openai_size(
    image_bytes: bytes,
    *,
    fallback: str = "1024x1024",
) -> str:
    """参照画像の縦横比に最も近い OpenAI size を選ぶ (edit 時のレイアウト維持)."""
    dims = _png_dimensions(image_bytes) or _jpeg_dimensions(image_bytes)
    if not dims:
        return fallback
    width, height = dims
    ratio = width / height
    if ratio >= 1.2:
        return "1536x1024"
    if ratio <= 0.83:
        return "1024x1536"
    return "1024x1024"


def build_retouch_edit_prompt(
    *,
    change_instructions: str,
    regions: list[dict[str, Any]],
    primary_filename: str,
    mask_applied: bool = False,
) -> str:
    """images.edit 用 — primary 初稿の部分修正（create と同じ gpt-image-2 edit）."""
    instructions = (change_instructions or "").strip()
    label = (primary_filename or "primary").strip() or "primary"
    region_lines: list[str] = []
    for idx, region in enumerate(regions[:8], start=1):
        instr = str(region.get("instruction") or "").strip()
        bbox = region.get("bbox")
        if instr:
            region_lines.append(f"{idx}. Region bbox={bbox}: {instr}")
        elif bbox:
            region_lines.append(f"{idx}. Region bbox={bbox}")
    region_block = "\n".join(region_lines) if region_lines else "(no explicit regions)"

    mask_block = (
        "MASK:\n"
        "- An inpainting mask PNG is attached.\n"
        "- Fully transparent pixels = apply CHANGE ONLY inside these areas.\n"
        "- Opaque pixels = preserve pixels from the primary image.\n\n"
        if mask_applied
        else ""
    )

    return (
        f'Edit the attached primary image "{label}". '
        "This is an IMAGE EDIT of the provided file, NOT a brand-new composition.\n\n"
        f"{mask_block}"
        "CHANGE ONLY:\n"
        f"{instructions}\n\n"
        "REGION HINTS (normalized 0-1 bbox on the full image):\n"
        f"{region_block}\n\n"
        "PRESERVE EXACTLY from the primary image:\n"
        "- Overall layout, margins, photo placement, color bands, badges\n"
        "- All text and graphics outside the requested change\n"
        "- Typography hierarchy and section proportions\n\n"
        "DO NOT:\n"
        "- Recompose the entire design or replace unrelated photos\n"
        "- Generate an unrelated scene from scratch\n"
        "- Ask the user which region — apply the edit now\n\n"
        "Japanese copy in CHANGE ONLY must appear accurately in the output."
    )


def build_reference_edit_prompt(
    *,
    change_instructions: str,
    reference_name: str,
) -> str:
    """images.edit 用 — ゼロベース生成ではなく参照レイアウトを維持する."""
    instructions = (change_instructions or "").strip()
    label = (reference_name or "reference").strip() or "reference"
    return (
        f'Edit the attached reference image "{label}". '
        "This is an IMAGE EDIT of the provided file, NOT a brand-new composition.\n\n"
        "CHANGE ONLY:\n"
        f"{instructions}\n\n"
        "PRESERVE EXACTLY from the reference image:\n"
        "- Overall page layout: header band, hero photo area, body columns, footer bar\n"
        "- Section proportions, margins, alignment, and white space\n"
        "- Typography hierarchy (title vs subcopy vs bullets), text block positions\n"
        "- Color bands, borders, badges, circular callouts, and decorative frames\n"
        "- Flyer/poster structure — swap content in-place; do not invent a new collage layout\n\n"
        "DO NOT:\n"
        "- Generate an unrelated scene (random people, ocean, product montage) "
        "unless the user explicitly asked to replace a photo region with that subject\n"
        "- Ignore the reference and create a generic promotional poster from scratch\n"
        "- Add watermarks or extra English text unless requested\n\n"
        "Japanese copy in CHANGE ONLY must appear accurately in the output."
    )


def _is_quota_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    return "429" in text or "quota" in text or "rate_limit" in text


def _is_gpt_image_model(model_id: str) -> bool:
    normalized = (model_id or "").strip().lower()
    return normalized.startswith("gpt-image")


def _image_bytes_from_item(item: Any) -> bytes | None:
    b64 = getattr(item, "b64_json", None)
    if isinstance(b64, str) and b64.strip():
        return base64.b64decode(b64)

    url = getattr(item, "url", None)
    if isinstance(url, str) and url.strip():
        import requests

        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        return resp.content
    return None


def _user_facing_error(exc: BaseException, *, model_id: str) -> str:
    text = str(exc).lower()
    if "invalid_api_key" in text or "incorrect api key" in text:
        return (
            "OpenAI API キーが無効です。設定 → AI 連携 で正しいキーを登録してください。"
        )
    if _is_quota_error(exc):
        return (
            "OpenAI API の利用上限に達しました。しばらく待つか、"
            "platform.openai.com でクォータを確認してください。"
        )
    if "billing" in text or "insufficient" in text:
        return "OpenAI の課金設定を確認してください (クレジット不足の可能性があります)。"
    return f"画像生成に失敗しました ({model_id}): {str(exc)[:300]}"


def build_image_generate_kwargs(
    *,
    model_id: str,
    prompt: str,
    size: str,
    quality: str,
    count: int,
) -> dict[str, Any]:
    """OpenAI images.generate 用 kwargs (GPT Image は response_format 非対応)."""
    kwargs: dict[str, Any] = {
        "model": model_id,
        "prompt": prompt,
        "size": size,
        "quality": quality,
        "n": count,
        "output_format": "png",
    }
    if not _is_gpt_image_model(model_id):
        kwargs["response_format"] = "b64_json"
    return kwargs


def _edit_images_sync(
    *,
    api_key: str,
    prompt: str,
    size: str,
    quality: str,
    count: int,
    thinking: str,
    model_id: str,
    reference_images: list[tuple[bytes, str]],
    mask_bytes: bytes | None = None,
) -> list[bytes]:
    from openai import APIStatusError, OpenAI

    if not reference_images:
        return []

    client = OpenAI(api_key=api_key)
    primary_bytes, primary_mime = reference_images[0]
    ext = "png" if "png" in primary_mime else "jpeg"
    image_file = io.BytesIO(primary_bytes)
    image_file.name = f"reference.{ext}"

    kwargs: dict[str, Any] = {
        "model": model_id,
        "image": image_file,
        "prompt": prompt,
        "size": size,
        "n": count,
    }
    if mask_bytes:
        mask_file = io.BytesIO(mask_bytes)
        mask_file.name = "mask.png"
        kwargs["mask"] = mask_file
        logger.info(
            "images.edit with inpaint mask bytes=%s primary_bytes=%s",
            len(mask_bytes),
            len(primary_bytes),
        )
    if _is_gpt_image_model(model_id):
        kwargs["quality"] = quality
    else:
        kwargs["response_format"] = "b64_json"

    extra_body: dict[str, Any] | None = None
    if thinking and thinking != "off":
        extra_body = {"thinking": thinking}

    def _call(body_extra: dict[str, Any] | None) -> Any:
        call_kwargs = dict(kwargs)
        if body_extra:
            call_kwargs["extra_body"] = body_extra
        return client.images.edit(**call_kwargs)

    try:
        response = _call(extra_body)
    except APIStatusError as exc:
        text = str(exc).lower()
        if extra_body and ("unknown parameter" in text or "thinking" in text):
            logger.info("retrying edit without thinking extra_body model=%s", model_id)
            response = _call(None)
        else:
            raise
    except TypeError:
        response = _call(None)

    out: list[bytes] = []
    for item in response.data or []:
        image_bytes = _image_bytes_from_item(item)
        if image_bytes:
            out.append(image_bytes)
    return out


def _generate_images_sync(
    *,
    api_key: str,
    prompt: str,
    size: str,
    quality: str,
    count: int,
    thinking: str,
    model_id: str,
) -> list[bytes]:
    from openai import APIStatusError, OpenAI

    client = OpenAI(api_key=api_key)
    kwargs = build_image_generate_kwargs(
        model_id=model_id,
        prompt=prompt,
        size=size,
        quality=quality,
        count=count,
    )

    extra_body: dict[str, Any] | None = None
    if thinking and thinking != "off":
        extra_body = {"thinking": thinking}

    def _call(body_extra: dict[str, Any] | None) -> Any:
        call_kwargs = dict(kwargs)
        if body_extra:
            call_kwargs["extra_body"] = body_extra
        return client.images.generate(**call_kwargs)

    try:
        response = _call(extra_body)
    except APIStatusError as exc:
        text = str(exc).lower()
        if extra_body and ("unknown parameter" in text or "thinking" in text):
            logger.info("retrying without thinking extra_body model=%s", model_id)
            response = _call(None)
        else:
            raise
    except TypeError:
        response = _call(None)

    out: list[bytes] = []
    for item in response.data or []:
        image_bytes = _image_bytes_from_item(item)
        if image_bytes:
            out.append(image_bytes)
    return out


async def _save_generated_images(
    *,
    tool_context: Any,
    image_bytes_list: list[bytes],
    full_prompt: str,
) -> dict[str, Any]:
    artifact_refs: list[dict[str, Any]] = []
    save_errors: list[str] = []
    for idx, image_bytes in enumerate(image_bytes_list):
        try:
            if not image_bytes:
                save_errors.append(f"empty image bytes at index {idx}")
                continue
            filename = safe_artifact_filename(
                f"generated_image_{idx + 1}", ".png"
            )
            ref = await save_bytes_artifact(
                tool_context,
                filename=filename,
                data=image_bytes,
                mime_type="image/png",
                kind="image",
                custom_metadata=build_custom_metadata(
                    kind="image",
                    prompt=full_prompt,
                ),
            )
            if ref:
                artifact_refs.append(ref)
            else:
                save_errors.append(f"save_artifact returned None ({filename})")
        except Exception as save_exc:
            logger.warning("image artifact save failed: %s", save_exc)
            save_errors.append(str(save_exc))

    if artifact_refs:
        return {"ok": True, "artifact_refs": artifact_refs}

    detail = "; ".join(save_errors[:3]) if save_errors else "no images to save"
    return {
        "ok": False,
        "error": (
            "画像は生成されましたが、ADK Artifact（GCS）への保存に失敗しました。"
            f" 詳細: {detail}"
        ),
        "artifact_refs": [],
    }


async def generate_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    style: str | None = None,
    count: int = 1,
    quality: Literal["standard", "high"] = "high",
    thinking: str | None = None,
    tool_context: Any = None,
) -> dict[str, Any]:
    """OpenAI gpt-image-2 で画像を 1-4 枚生成し、ADK Artifact Service (GCS) に保存する."""
    if tool_context is None:
        return {
            "ok": False,
            "error": "artifact service が利用できません (tool_context 未設定).",
            "artifact_refs": [],
        }

    api_key = resolve_openai_api_key()
    if not api_key:
        return {
            "ok": False,
            "error": (
                "OpenAI API キーが未登録です。"
                "設定 → AI 連携 で OpenAI API キーを登録してください。"
            ),
            "artifact_refs": [],
        }

    from common.image_studio_workflow import (  # type: ignore
        mode_state_from_tool_context,
        resolve_image_workflow_phase,
    )

    session_state = read_tool_state(tool_context)
    mode_state = mode_state_from_tool_context(tool_context)
    phase = resolve_image_workflow_phase(
        mode_state=mode_state,
        session_state=session_state,
    )
    if phase == "retouch":
        return {
            "ok": False,
            "error": (
                "レタッチ段階では retouch_image を使用してください。"
                "初稿生成は generate_image です。"
            ),
            "artifact_refs": [],
        }

    creation_mode = resolve_image_creation_mode(tool_context)
    logger.info(
        "generate_image creation_mode=%s phase=%s (scratch=generate / reference=edit)",
        creation_mode,
        phase,
    )
    count = max(1, min(4, int(count)))
    normalized_quality = (quality or "high").strip().lower()
    if normalized_quality not in _VALID_QUALITY:
        normalized_quality = "high"

    thinking_value = (thinking or _default_thinking()).strip().lower()
    if thinking_value not in _VALID_THINKING:
        thinking_value = "off"

    model_id = _image_model()

    if creation_mode == "scratch":
        full_prompt = prompt.strip()
        if style:
            full_prompt = f"{full_prompt}\nVisual style: {style}."
        if not full_prompt:
            return {
                "ok": False,
                "error": "プロンプトが空です。",
                "artifact_refs": [],
            }
        size = aspect_ratio_to_size(aspect_ratio)
        try:
            image_bytes_list = await asyncio.to_thread(
                _generate_images_sync,
                api_key=api_key,
                prompt=full_prompt,
                size=size,
                quality=normalized_quality,
                count=count,
                thinking=thinking_value,
                model_id=model_id,
            )
        except Exception as exc:
            logger.warning(
                "OpenAI scratch image generation failed model=%s: %s",
                model_id,
                exc,
            )
            return {
                "ok": False,
                "error": _user_facing_error(exc, model_id=model_id),
                "artifact_refs": [],
            }
        if not image_bytes_list:
            return {
                "ok": False,
                "error": (
                    f"OpenAI から画像が返りませんでした (model={model_id}). "
                    "プロンプトを変えて再試行してください。"
                ),
                "artifact_refs": [],
            }
        return await _save_generated_images(
            tool_context=tool_context,
            image_bytes_list=image_bytes_list,
            full_prompt=full_prompt,
        )

    image_reference = resolve_image_reference_for_tool(tool_context)
    logger.info(
        "generate_image reference status=%s count=%s",
        image_reference.get("status"),
        len(image_reference.get("references") or []),
    )
    if image_reference.get("status") != "complete":
        return {
            "ok": False,
            "error": (
                "参照画像が未確定です。UIで参照を追加し「参照を確定」を押してください。"
            ),
            "artifact_refs": [],
        }

    reference_bytes_list = load_reference_images_bytes(image_reference)
    if not reference_bytes_list:
        return {
            "ok": False,
            "error": (
                "確定済み参照画像を取得できませんでした。"
                "GCS / Storage URL を確認し、参照を再設定してください。"
            ),
            "artifact_refs": [],
        }

    primary_name = "reference"
    refs_meta = image_reference.get("references") or []
    if refs_meta and isinstance(refs_meta[0], dict):
        primary_name = str(refs_meta[0].get("name") or primary_name)

    change_instructions = prompt.strip()
    if style:
        change_instructions = f"{change_instructions}\nVisual tone: {style} (apply within existing layout only)."

    full_prompt = build_reference_edit_prompt(
        change_instructions=change_instructions,
        reference_name=primary_name,
    )

    primary_bytes = reference_bytes_list[0][0]
    size = image_bytes_to_openai_size(
        primary_bytes,
        fallback=aspect_ratio_to_size(aspect_ratio),
    )

    if len(reference_bytes_list) > 1:
        names = ", ".join(
            str(r.get("name", "ref"))
            for r in refs_meta[:3]
            if isinstance(r, dict)
        )
        full_prompt = (
            f"{full_prompt}\n\nAdditional reference files for in-place swaps only: {names}."
        )

    try:
        image_bytes_list = await asyncio.to_thread(
            _edit_images_sync,
            api_key=api_key,
            prompt=full_prompt,
            size=size,
            quality=normalized_quality,
            count=count,
            thinking=thinking_value,
            model_id=model_id,
            reference_images=reference_bytes_list,
        )
    except Exception as exc:
        logger.warning("OpenAI image generation failed model=%s: %s", model_id, exc)
        return {
            "ok": False,
            "error": _user_facing_error(exc, model_id=model_id),
            "artifact_refs": [],
        }

    if not image_bytes_list:
        return {
            "ok": False,
            "error": (
                f"OpenAI から画像が返りませんでした (model={model_id}). "
                "プロンプトを変えて再試行してください。"
            ),
            "artifact_refs": [],
        }

    return await _save_generated_images(
        tool_context=tool_context,
        image_bytes_list=image_bytes_list,
        full_prompt=full_prompt,
    )


async def retouch_image(
    prompt: str,
    quality: Literal["standard", "high"] = "high",
    thinking: str | None = None,
    tool_context: Any = None,
) -> dict[str, Any]:
    """OpenAI gpt-image-2 images.edit で primary 初稿を部分修正する（create reference と同 API）."""
    if tool_context is None:
        return {
            "ok": False,
            "error": "artifact service が利用できません (tool_context 未設定).",
            "artifact_refs": [],
        }

    api_key = resolve_openai_api_key()
    if not api_key:
        return {
            "ok": False,
            "error": (
                "OpenAI API キーが未登録です。"
                "設定 → AI 連携 で OpenAI API キーを登録してください。"
            ),
            "artifact_refs": [],
        }

    from common.adk_artifact_io import load_bytes_artifact  # type: ignore
    from common.image_studio_workflow import (  # type: ignore
        _primary_image_from_mode_state,
        _retouch_regions_from_mode_state,
        mode_state_from_tool_context,
        resolve_image_workflow_phase,
    )

    session_state = read_tool_state(tool_context)
    mode_state = mode_state_from_tool_context(tool_context)
    phase = resolve_image_workflow_phase(
        mode_state=mode_state,
        session_state=session_state,
    )
    if phase != "retouch":
        return {
            "ok": False,
            "error": (
                "レタッチ段階では retouch_image を使用してください。"
                "初稿は generate_image です。"
            ),
            "artifact_refs": [],
        }

    primary = _primary_image_from_mode_state(mode_state)
    if not primary:
        return {
            "ok": False,
            "error": "primary_image が未設定です。初稿を生成してからレタッチしてください。",
            "artifact_refs": [],
        }

    filename = str(primary.get("adk_filename") or "").strip()
    if not filename:
        return {
            "ok": False,
            "error": "primary_image.adk_filename が空です。",
            "artifact_refs": [],
        }

    version_raw = primary.get("version")
    version = int(version_raw) if isinstance(version_raw, int) else None

    primary_bytes = await load_bytes_artifact(
        tool_context,
        filename=filename,
        version=version,
    )
    if not primary_bytes:
        return {
            "ok": False,
            "error": f"編集対象画像を読み込めませんでした: {filename}",
            "artifact_refs": [],
        }

    regions = _retouch_regions_from_mode_state(mode_state)

    from image.inpaint_mask import build_inpaint_mask_for_image  # type: ignore

    mask_bytes = build_inpaint_mask_for_image(
        image_bytes=primary_bytes,
        regions=regions,
    )
    if mask_bytes:
        logger.info(
            "retouch_image inpaint mask built regions=%s bytes=%s",
            len(regions),
            len(mask_bytes),
        )
    else:
        logger.info(
            "retouch_image without mask (no valid bbox regions=%s)",
            len(regions),
        )

    full_prompt = build_retouch_edit_prompt(
        change_instructions=prompt,
        regions=regions,
        primary_filename=filename,
        mask_applied=mask_bytes is not None,
    )

    normalized_quality = (quality or "high").strip().lower()
    if normalized_quality not in _VALID_QUALITY:
        normalized_quality = "high"

    thinking_value = (thinking or _default_thinking()).strip().lower()
    if thinking_value not in _VALID_THINKING:
        thinking_value = "off"

    model_id = _image_model()
    size = image_bytes_to_openai_size(primary_bytes)

    try:
        image_bytes_list = await asyncio.to_thread(
            _edit_images_sync,
            api_key=api_key,
            prompt=full_prompt,
            size=size,
            quality=normalized_quality,
            count=1,
            thinking=thinking_value,
            model_id=model_id,
            reference_images=[(primary_bytes, "image/png")],
            mask_bytes=mask_bytes,
        )
    except Exception as exc:
        logger.warning("OpenAI retouch edit failed model=%s: %s", model_id, exc)
        return {
            "ok": False,
            "error": _user_facing_error(exc, model_id=model_id),
            "artifact_refs": [],
        }

    if not image_bytes_list:
        return {
            "ok": False,
            "error": (
                f"OpenAI から画像が返りませんでした (model={model_id}). "
                "指示を変えて再試行してください。"
            ),
            "artifact_refs": [],
        }

    return await _save_generated_images(
        tool_context=tool_context,
        image_bytes_list=image_bytes_list,
        full_prompt=full_prompt,
    )
