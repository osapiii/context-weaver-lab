"""Tests for OpenAI inpainting mask generation."""
from __future__ import annotations

from image.inpaint_mask import (
    build_inpaint_mask_for_image,
    build_inpaint_mask_png,
    image_pixel_dimensions,
)


def _minimal_png(width: int, height: int) -> bytes:
    from PIL import Image
    import io

    img = Image.new("RGB", (width, height), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_image_pixel_dimensions_from_png_header():
    png = _minimal_png(640, 480)
    assert image_pixel_dimensions(png) == (640, 480)


def test_build_inpaint_mask_png_transparent_edit_region():
    mask = build_inpaint_mask_png(
        width=100,
        height=100,
        regions=[
            {
                "id": "r1",
                "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.25},
                "instruction": "logo",
            }
        ],
    )
    assert mask is not None

    from PIL import Image
    import io

    with Image.open(io.BytesIO(mask)) as im:
        assert im.size == (100, 100)
        assert im.mode == "RGBA"
        # outside region: opaque
        assert im.getpixel((0, 0))[3] == 255
        # inside region (~10-40%, 20-45%): transparent
        assert im.getpixel((25, 30))[3] == 0


def test_build_inpaint_mask_for_image_returns_none_without_bbox():
    png = _minimal_png(80, 60)
    assert (
        build_inpaint_mask_for_image(
            image_bytes=png,
            regions=[{"id": "r1", "instruction": "no bbox"}],
        )
        is None
    )


def test_build_inpaint_mask_for_image_from_primary():
    png = _minimal_png(120, 90)
    mask = build_inpaint_mask_for_image(
        image_bytes=png,
        regions=[
            {
                "id": "r1",
                "bbox": {"x": 0.0, "y": 0.0, "w": 0.5, "h": 0.5},
                "instruction": "top-left",
            }
        ],
    )
    assert mask is not None
    assert len(mask) > 100
