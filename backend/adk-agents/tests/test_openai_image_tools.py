"""Tests for OpenAI image generation tool."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from google.adk.sessions.state import State

from common.openai_byok_scope import activate_openai_byok, deactivate_openai_byok
from common.image_reference import empty_image_reference_state
from image.openai_image_tools import (
    _is_gpt_image_model,
    aspect_ratio_to_size,
    build_image_generate_kwargs,
    build_reference_edit_prompt,
    build_retouch_edit_prompt,
    generate_image,
    image_bytes_to_openai_size,
    retouch_image,
)


def test_build_retouch_edit_prompt_includes_regions():
    prompt = build_retouch_edit_prompt(
        change_instructions="Replace headline with NEW",
        regions=[
            {
                "instruction": "Top title only",
                "bbox": {"x": 0.1, "y": 0.05, "w": 0.8, "h": 0.15},
            }
        ],
        primary_filename="poster.png",
        mask_applied=True,
    )
    assert "Replace headline" in prompt
    assert "PRESERVE EXACTLY" in prompt
    assert "Top title only" in prompt
    assert "IMAGE EDIT" in prompt
    assert "MASK:" in prompt
    assert "transparent pixels" in prompt.lower()


def test_build_reference_edit_prompt_preserves_layout():
    wrapped = build_reference_edit_prompt(
        change_instructions="Replace title with みりん干しジャム",
        reference_name="flyer.png",
    )
    assert "IMAGE EDIT" in wrapped
    assert "PRESERVE EXACTLY" in wrapped
    assert "CHANGE ONLY" in wrapped
    assert "みりん干しジャム" in wrapped
    assert "NOT a brand-new" in wrapped


def test_image_bytes_to_openai_size_landscape_png():
    # minimal PNG header: 800x600
    png = (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00" * 8
        + (800).to_bytes(4, "big")
        + (600).to_bytes(4, "big")
    )
    assert image_bytes_to_openai_size(png) == "1536x1024"


def test_aspect_ratio_to_size():
    assert aspect_ratio_to_size("16:9") == "1536x1024"
    assert aspect_ratio_to_size("unknown") == "1024x1024"


def test_gpt_image_model_omits_response_format():
    assert _is_gpt_image_model("gpt-image-2")
    assert not _is_gpt_image_model("dall-e-3")


def test_build_image_generate_kwargs_gpt_image_omits_response_format():
    kwargs = build_image_generate_kwargs(
        model_id="gpt-image-2",
        prompt="flyer",
        size="1024x1024",
        quality="high",
        count=1,
    )
    assert "response_format" not in kwargs
    assert kwargs["output_format"] == "png"


def test_build_image_generate_kwargs_dalle_includes_response_format():
    kwargs = build_image_generate_kwargs(
        model_id="dall-e-3",
        prompt="flyer",
        size="1024x1024",
        quality="standard",
        count=1,
    )
    assert kwargs["response_format"] == "b64_json"


def test_generate_image_requires_api_key():
    result = asyncio.run(
        generate_image(
            prompt="a cat",
            tool_context=MagicMock(),
        )
    )
    assert result["ok"] is False
    assert "OpenAI API キー" in result["error"]


def test_generate_image_uses_contextvar_when_tool_state_empty():
    from common.image_reference_scope import (
        activate_invoke_image_reference,
        deactivate_invoke_image_reference,
    )

    fake_png = b"\x89PNG\r\n\x1a\n"
    token = activate_invoke_image_reference(
        {
            "status": "complete",
            "references": [
                {
                    "id": "1",
                    "source": "upload",
                    "name": "ref.png",
                    "mime_type": "image/png",
                    "url": "https://example.com/ref.png",
                }
            ],
            "min_count": 1,
            "confirmed_at": "2026-01-01T00:00:00+00:00",
        }
    )
    tool_context = MagicMock()
    tool_context.state = {
        "image": {"setup": {"creation": "reference", "confirmed": True}},
    }
    artifact_ref = {"filename": "generated_image_1.png", "version": 0}
    byok = activate_openai_byok("sk-test-key")
    try:
        with patch(
            "image.openai_image_tools.load_reference_images_bytes",
            return_value=[(fake_png, "image/png")],
        ):
            with patch(
                "image.openai_image_tools._edit_images_sync",
                return_value=[fake_png],
            ):
                with patch(
                    "image.openai_image_tools.save_bytes_artifact",
                    return_value=artifact_ref,
                ):
                    with patch(
                        "image.openai_image_tools._edit_images_sync",
                        return_value=[fake_png],
                    ) as edit_mock:
                        result = asyncio.run(
                            generate_image(
                                prompt="Replace headline with みりん干しジャム",
                                tool_context=tool_context,
                            )
                        )
                        edit_mock.assert_called_once()
                        assert "PRESERVE EXACTLY" in edit_mock.call_args.kwargs["prompt"]
        assert result["ok"] is True
    finally:
        deactivate_invoke_image_reference(token)
        deactivate_openai_byok(byok)


def test_generate_image_blocks_when_reference_not_complete():
    ctx = MagicMock()
    ctx.state = {
        "image": {
            "setup": {
                "creation": "reference",
                "confirmed": True,
                "reference": {
                    "status": "draft",
                    "references": [
                        {
                            "id": "1",
                            "source": "upload",
                            "name": "a.png",
                            "mime_type": "image/png",
                            "url": "https://example.com/a.png",
                        }
                    ],
                },
            }
        },
    }
    token = activate_openai_byok("sk-test-key")
    try:
        result = asyncio.run(
            generate_image(
                prompt="a cat",
                tool_context=ctx,
            )
        )
        assert result["ok"] is False
        assert "未確定" in result["error"]
    finally:
        deactivate_openai_byok(token)


def test_retouch_image_uses_openai_edit():
    token = activate_openai_byok("sk-test-key")
    from tests.test_inpaint_mask import _minimal_png as make_png

    fake_png = make_png(64, 48)
    adk_state = State(
        value={
            "image": {
                "phase": "retouch",
                "primary": {"adk_filename": "img.png", "version": 1},
            }
        },
        delta={},
    )
    tool_context = MagicMock()
    tool_context.state = adk_state

    try:
        with patch(
            "common.adk_artifact_io.load_bytes_artifact",
            new=AsyncMock(return_value=fake_png),
        ):
            with patch(
                "image.openai_image_tools._edit_images_sync",
                return_value=[fake_png],
            ) as edit_mock:
                with patch(
                    "image.openai_image_tools.save_bytes_artifact",
                    return_value={"filename": "generated_image_1.png", "version": 0},
                ):
                    result = asyncio.run(
                        retouch_image(
                            prompt="Change headline",
                            tool_context=tool_context,
                        )
                    )
        assert result["ok"] is True
        edit_mock.assert_called_once()
        assert edit_mock.call_args.kwargs["model_id"] == "gpt-image-2"
        assert "PRESERVE EXACTLY" in edit_mock.call_args.kwargs["prompt"]
        assert edit_mock.call_args.kwargs["mask_bytes"] is None
    finally:
        deactivate_openai_byok(token)


def test_retouch_image_passes_inpaint_mask_when_regions_have_bbox():
    token = activate_openai_byok("sk-test-key")
    from tests.test_inpaint_mask import _minimal_png as make_png

    fake_png = make_png(100, 80)
    adk_state = State(
        value={
            "image": {
                "phase": "retouch",
                "primary": {"adk_filename": "img.png", "version": 1},
                "retouch_regions": [
                    {
                        "id": "r1",
                        "bbox": {"x": 0.1, "y": 0.1, "w": 0.4, "h": 0.2},
                        "instruction": "Replace logo",
                    }
                ],
            }
        },
        delta={},
    )
    tool_context = MagicMock()
    tool_context.state = adk_state

    try:
        with patch(
            "common.adk_artifact_io.load_bytes_artifact",
            new=AsyncMock(return_value=fake_png),
        ):
            with patch(
                "image.openai_image_tools._edit_images_sync",
                return_value=[fake_png],
            ) as edit_mock:
                with patch(
                    "image.openai_image_tools.save_bytes_artifact",
                    return_value={"filename": "generated_image_1.png", "version": 0},
                ):
                    result = asyncio.run(
                        retouch_image(
                            prompt="Change headline",
                            tool_context=tool_context,
                        )
                    )
        assert result["ok"] is True
        mask_bytes = edit_mock.call_args.kwargs["mask_bytes"]
        assert mask_bytes is not None
        assert len(mask_bytes) > 50
        assert "MASK:" in edit_mock.call_args.kwargs["prompt"]
    finally:
        deactivate_openai_byok(token)


def test_generate_image_rejected_in_retouch_phase():
    token = activate_openai_byok("sk-test-key")
    tool_context = MagicMock()
    tool_context.state = State(
        value={
            "image": {
                "phase": "retouch",
                "primary": {"adk_filename": "img.png", "version": 1},
            }
        },
        delta={},
    )
    try:
        result = asyncio.run(
            generate_image(
                prompt="change text",
                tool_context=tool_context,
            )
        )
        assert result["ok"] is False
        assert "retouch_image" in result["error"]
    finally:
        deactivate_openai_byok(token)


def test_generate_image_scratch_uses_generate_sync():
    token = activate_openai_byok("sk-test-key")
    fake_png = b"\x89PNG\r\n\x1a\n"
    tool_context = MagicMock()
    tool_context.state = {
        "image": {"setup": {"creation": "scratch", "confirmed": True}},
    }
    artifact_ref = {"filename": "generated_image_1.png", "version": 0}

    try:
        with patch(
            "image.openai_image_tools._generate_images_sync",
            return_value=[fake_png],
        ) as generate_mock:
            with patch(
                "image.openai_image_tools.save_bytes_artifact",
                return_value=artifact_ref,
            ):
                result = asyncio.run(
                    generate_image(
                        prompt="A minimalist product photo of jam jar",
                        tool_context=tool_context,
                    )
                )
                generate_mock.assert_called_once()
        assert result["ok"] is True
    finally:
        deactivate_openai_byok(token)


def test_generate_image_saves_artifact():
    token = activate_openai_byok("sk-test-key")
    fake_png = b"\x89PNG\r\n\x1a\n"
    mock_item = MagicMock()
    mock_item.b64_json = __import__("base64").b64encode(fake_png).decode("ascii")
    mock_response = MagicMock()
    mock_response.data = [mock_item]

    tool_context = MagicMock()
    tool_context.state = {
        "image": {
            "setup": {
                "creation": "reference",
                "confirmed": True,
                "reference": {
                    "status": "complete",
                    "references": [
                        {
                            "id": "1",
                            "source": "upload",
                            "name": "ref.png",
                            "mime_type": "image/png",
                            "url": "https://example.com/ref.png",
                        }
                    ],
                    "confirmed_at": "2026-01-01T00:00:00+00:00",
                },
            }
        },
    }
    artifact_ref = {"filename": "generated_image_1.png", "version": 0}

    try:
        with patch(
            "image.openai_image_tools.load_reference_images_bytes",
            return_value=[(fake_png, "image/png")],
        ):
            with patch(
                "image.openai_image_tools._edit_images_sync",
                return_value=[fake_png],
            ):
                with patch(
                    "image.openai_image_tools.save_bytes_artifact",
                    return_value=artifact_ref,
                ) as save_mock:
                    result = asyncio.run(
                        generate_image(
                            prompt="toast with jam",
                            aspect_ratio="1:1",
                            quality="high",
                            tool_context=tool_context,
                        )
                    )
        assert result["ok"] is True
        assert result["artifact_refs"] == [artifact_ref]
        save_mock.assert_called_once()
    finally:
        deactivate_openai_byok(token)
