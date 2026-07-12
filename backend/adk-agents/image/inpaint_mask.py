"""OpenAI images.edit 用インペイントマスク (RGBA PNG) を生成する."""
from __future__ import annotations

import io
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _parse_normalized_bbox(
    raw: Any,
) -> tuple[float, float, float, float] | None:
    if not isinstance(raw, dict):
        return None
    try:
        x = float(raw.get("x", 0))
        y = float(raw.get("y", 0))
        w = float(raw.get("w", 0))
        h = float(raw.get("h", 0))
    except (TypeError, ValueError):
        return None
    if w <= 0 or h <= 0:
        return None
    x = max(0.0, min(1.0, x))
    y = max(0.0, min(1.0, y))
    w = max(0.0, min(1.0 - x, w))
    h = max(0.0, min(1.0 - y, h))
    if w <= 0 or h <= 0:
        return None
    return x, y, w, h


def image_pixel_dimensions(image_bytes: bytes) -> tuple[int, int] | None:
    """PNG / JPEG / Pillow で画像のピクセル幅・高さを取得する."""
    if len(image_bytes) >= 24 and image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        width = int.from_bytes(image_bytes[16:20], "big")
        height = int.from_bytes(image_bytes[20:24], "big")
        if width > 0 and height > 0:
            return width, height

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

    try:
        from PIL import Image

        with Image.open(io.BytesIO(image_bytes)) as im:
            return im.size
    except Exception as exc:
        logger.warning("image_pixel_dimensions failed: %s", exc)
        return None


def build_inpaint_mask_png(
    *,
    width: int,
    height: int,
    regions: list[dict[str, Any]],
) -> bytes | None:
    """
    OpenAI mask: alpha=0 (透明) = 編集対象, alpha=255 (不透明) = 維持.

    regions[].bbox は 0-1 正規化座標 {x,y,w,h}.
    有効な bbox が 1 件も無い場合は None.
    """
    if width <= 0 or height <= 0:
        return None

    from PIL import Image, ImageDraw

    # 全面不透明 = 維持領域
    mask = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    draw = ImageDraw.Draw(mask)
    applied = 0

    for region in regions:
        bbox = _parse_normalized_bbox(region.get("bbox"))
        if not bbox:
            continue
        x, y, w, h = bbox
        x0 = int(x * width)
        y0 = int(y * height)
        x1 = int(round((x + w) * width))
        y1 = int(round((y + h) * height))
        x0 = max(0, min(width - 1, x0))
        y0 = max(0, min(height - 1, y0))
        x1 = max(x0 + 1, min(width, x1))
        y1 = max(y0 + 1, min(height, y1))
        draw.rectangle([x0, y0, x1, y1], fill=(0, 0, 0, 0))
        applied += 1

    if applied == 0:
        return None

    out = io.BytesIO()
    mask.save(out, format="PNG")
    return out.getvalue()


def build_inpaint_mask_for_image(
    *,
    image_bytes: bytes,
    regions: list[dict[str, Any]],
) -> bytes | None:
    """primary 画像と retouch regions からマスク PNG を構築する."""
    dims = image_pixel_dimensions(image_bytes)
    if not dims:
        return None
    width, height = dims
    return build_inpaint_mask_png(width=width, height=height, regions=regions)
