"""research.json の svg_spec[] を図解アセットに変換.

バックエンド (ENOSTECH_SVG_BACKEND):
    - openai (既定・テスト): gpt-image-2 + BYOK OpenAI API キー → PNG を SVG <image> でラップ
    - gemini: SVG_MODEL (既定 gemini-3.5-flash) + BYOK Gemini API キー → 生 SVG テキスト
"""
from __future__ import annotations

import asyncio
import base64
import sys
import time
from typing import Optional

from .. import config
from ..schemas.research import (
    Research,
    ResearchSection,
    ResearchSvgAsset,
    ResearchSvgSpec,
)
from . import research_writer


# ─── Gemini client ─────────────────────────────────


def _genai_client():
    from google import genai  # type: ignore

    return genai.Client()


def _kind_purpose(kind: str) -> str:
    """svg_spec.kind ごとの構図ヒント (LLM に渡す)."""
    return {
        "concept-diagram": "概念図. 中央に主役要素 + 周辺に派生要素 (hub-and-spoke or layered).",
        "flow": (
            "意思決定フローチャート. **YES/NO の二分岐をカスケード** で並べる. "
            "ひし形 (diamond) で質問ノード、角丸長方形でアクションノード、矢印で接続. "
            "縦方向に質問を 2-4 段並べ、それぞれ YES (右) / NO (下) で枝分かれする. "
            "最終的に 2-4 個のアクション (推奨ルート / 短縮ルート / 中止 など) に行き着く."
        ),
        "comparison": "2 つ以上の対比. 左右並置 / before-vs-after / 2×2 matrix.",
        "list": "並列要素のリスト. カード並列 / アイコン付き bullet.",
        "data-chart": "数値ベース. 棒グラフ / 折れ線 / 比率パイ. 値は spec.key_elements から取る.",
        "timeline": "時系列. 横軸 = 時間軸. 主要イベントをマーカーで配置.",
        "matrix": "2 軸対比 (例: 緊急度×重要度). 4 象限のラベル付け.",
    }.get(kind, "図解")


def _layout_and_color_block() -> str:
    """図解共通: レイアウト厳格化 + ソフト配色."""
    return (
        "## レイアウト (厳守)\n"
        "- **テキストは一切枠外にはみ出さない**. カード・吹き出し・フッター内に必ず収める.\n"
        "- 長文は要約・改行・箇条書きに分割. 小さめフォントでも枠内優先.\n"
        "- 要素間に十分な余白. 1920×1080 (16:9) 全体にバランスよく配置.\n"
        "- 右端・下端ギリギリの配置は禁止 (安全マージン 48px 相当).\n\n"
        "## 配色 (ソフト・ビジネス資料)\n"
        "- **純黒 (#000 / #0f172a) の大面積塗りは禁止**. 濃色は charcoal/navy (#334155, #3d4f66, #475569).\n"
        "- 背景はオフホワイト〜薄グレー (#f8fafc, #f1f5f5, #e8edf2).\n"
        "- アクセントは **控えめな amber** (#d4a574, #e8b86d) — 1 画面 1〜2 箇所.\n"
        "- コントラストは読みやすさを保ちつつ、前後関係が強すぎないトーンで.\n"
        "- グラデ・ネオン・高彩度の原色は避ける.\n"
    )


def _flow_style_block() -> str:
    """kind=flow 専用の追加スタイルガイド."""
    return (
        "\n## kind=flow 専用 (YES/NO 意思決定フローチャート)\n"
        "- 開始ノード (上部, ソフト amber 角丸)\n"
        "- 質問ノード (ひし形, 中間トーン amber ボーダー)\n"
        "- アクションノード (白背景 + charcoal ボーダー)\n"
        "- YES / NO ラベルは小さめ pill. 矢印は charcoal 細め.\n"
    )


def _spec_context_block(
    *,
    spec: ResearchSvgSpec,
    section: ResearchSection,
    theme: str,
    intent: str,
) -> str:
    key_block = "\n".join(f"  - {e}" for e in spec.key_elements) or "  (なし)"
    flow_block = _flow_style_block() if spec.kind == "flow" else ""
    return (
        f"リサーチレポート「{theme}」の 1 章用インフォグラフィック.\n\n"
        "## デッキの目的\n"
        f"{intent}\n\n"
        "## 章\n"
        f"- セクション ID: {section.id}\n"
        f"- 疑問文: {section.question}\n"
        f"- 本文抜粋 (最大 400 字):\n"
        f"  {section.body_md[:400]}\n\n"
        "## svg_spec\n"
        f"- kind: {spec.kind} — {_kind_purpose(spec.kind)}\n"
        f"- intent: {spec.intent}\n"
        f"- 必須要素:\n{key_block}\n"
        f"{flow_block}\n"
        f"{_layout_and_color_block()}\n"
    )


def _build_svg_prompt(
    spec: ResearchSvgSpec,
    section: ResearchSection,
    theme: str,
    intent: str,
) -> str:
    """Gemini 向け: 生 SVG 文字列を生成."""
    return (
        "あなたは情報設計に長けた SVG ダイアグラム作家です.\n"
        f"{_spec_context_block(spec=spec, section=section, theme=theme, intent=intent)}"
        "## 出力\n"
        "**完全な SVG 文字列のみ** (説明・コードフェンス禁止):\n"
        "`<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1920 1080\">...</svg>`\n"
        "- 日本語フォント: font-family=\"Noto Sans JP, sans-serif\".\n"
    )


def _build_openai_image_prompt(
    spec: ResearchSvgSpec,
    section: ResearchSection,
    theme: str,
    intent: str,
) -> str:
    """OpenAI gpt-image 向け: 16:9 インフォグラフィック 1 枚."""
    return (
        "Create a single professional Japanese business infographic slide (16:9 landscape).\n"
        "Flat vector style, clean grid layout, McKinsey-style consulting deck.\n"
        "All visible text must be in Japanese.\n\n"
        f"{_spec_context_block(spec=spec, section=section, theme=theme, intent=intent)}"
        "## Output\n"
        "One polished slide image only. No watermark. No English UI chrome unless in spec.\n"
    )


def _parse_openai_size(size: str) -> tuple[int, int]:
    parts = (size or "1536x1024").lower().split("x")
    if len(parts) != 2:
        return 1536, 1024
    try:
        return int(parts[0]), int(parts[1])
    except ValueError:
        return 1536, 1024


def png_to_embedded_svg(png_bytes: bytes, *, width: int, height: int) -> str:
    """PNG を research.html 互換のインライン SVG ラッパーに包む."""
    b64 = base64.b64encode(png_bytes).decode("ascii")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'viewBox="0 0 {width} {height}" width="{width}" height="{height}">'
        f'<image width="{width}" height="{height}" '
        f'xlink:href="data:image/png;base64,{b64}" href="data:image/png;base64,{b64}"/>'
        f"</svg>"
    )


def _resolve_openai_api_key() -> str:
    try:
        from common.openai_byok_scope import resolve_openai_api_key  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "OpenAI BYOK は unified ADK 環境でのみ利用できます (common 未 import)."
        ) from exc
    api_key = resolve_openai_api_key()
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY_NOT_REGISTERED: 設定 → AI 連携 で OpenAI API キーを登録してください."
        )
    return api_key


def _generate_one_openai(
    spec: ResearchSvgSpec,
    section: ResearchSection,
    theme: str,
    intent: str,
    *,
    model: str,
    size: str,
    quality: str,
) -> str:
    try:
        from image.openai_image_tools import _generate_images_sync  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "image.openai_image_tools が import できません。unified agent で実行してください."
        ) from exc

    api_key = _resolve_openai_api_key()
    prompt = _build_openai_image_prompt(spec, section, theme, intent)
    images = _generate_images_sync(
        api_key=api_key,
        prompt=prompt,
        size=size,
        quality=quality if quality in ("standard", "high") else "high",
        count=1,
        thinking="off",
        model_id=model,
    )
    if not images:
        raise ValueError("OpenAI image generation returned no image bytes")
    w, h = _parse_openai_size(size)
    return png_to_embedded_svg(images[0], width=w, height=h)


def _generate_one_gemini(
    spec: ResearchSvgSpec,
    section: ResearchSection,
    theme: str,
    intent: str,
    *,
    model: str,
) -> str:
    client = _genai_client()
    prompt = _build_svg_prompt(spec, section, theme, intent)

    cfg: dict = {
        "response_mime_type": "text/plain",
        "max_output_tokens": 32768,
        "temperature": 0.4,
    }
    if "pro-preview" not in (model or "").lower():
        cfg["thinking_config"] = {"thinking_budget": 0, "include_thoughts": False}

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=cfg,
    )
    text = (response.text or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    if "<svg" not in text or "</svg>" not in text:
        raise ValueError(f"SVG として読めない出力 (先頭 80 字): {text[:80]}")
    start = text.index("<svg")
    end = text.rindex("</svg>") + len("</svg>")
    return text[start:end]


def _generate_one(
    spec: ResearchSvgSpec,
    section: ResearchSection,
    theme: str,
    intent: str,
    *,
    model: str,
    backend: str,
) -> str:
    if backend == "openai":
        return _generate_one_openai(
            spec,
            section,
            theme,
            intent,
            model=config.OPENAI_SVG_IMAGE_MODEL,
            size=config.OPENAI_SVG_IMAGE_SIZE,
            quality=config.OPENAI_SVG_IMAGE_QUALITY,
        )
    return _generate_one_gemini(
        spec, section, theme, intent, model=model
    )


async def generate_svgs_for_research(
    deck_dir: str,
    *,
    model: Optional[str] = None,
    concurrency: int = 3,
    backend: Optional[str] = None,
) -> dict:
    """research.json を読み、svg_spec のある section + next_action について図解を並列生成."""
    research = research_writer.read_research_json(deck_dir)
    _backend = (backend or config.SVG_BACKEND or "gemini").strip().lower()
    _model = model or (
        config.OPENAI_SVG_IMAGE_MODEL
        if _backend == "openai"
        else config.SVG_MODEL
    )

    section_tasks: list[tuple[int, ResearchSection]] = []
    for idx, section in enumerate(research.sections):
        if section.svg_spec is None:
            continue
        if section.svg_asset is not None:
            continue
        section_tasks.append((idx, section))

    next_action = research.next_action
    next_action_task: bool = (
        next_action is not None
        and not next_action.skipped
        and next_action.svg_spec is not None
        and next_action.svg_asset is None
    )

    if not section_tasks and not next_action_task:
        return {
            "generated": 0,
            "skipped": len(research.sections),
            "next_action_generated": False,
            "errors": [],
            "deck_dir": deck_dir,
            "message": "対象 svg_spec がありません.",
            "backend": _backend,
            "model": _model,
        }

    sem = asyncio.Semaphore(concurrency)
    errors: list[dict] = []
    section_results: dict[int, ResearchSvgAsset] = {}
    next_action_result: Optional[ResearchSvgAsset] = None

    async def _bounded_section(idx: int, section: ResearchSection):
        async with sem:
            try:
                svg_text = await asyncio.to_thread(
                    _generate_one,
                    section.svg_spec,  # type: ignore[arg-type]
                    section,
                    research.theme,
                    research.intent,
                    model=_model,
                    backend=_backend,
                )
                section_results[idx] = ResearchSvgAsset(
                    svg_text=svg_text,
                    alt=section.svg_spec.intent,  # type: ignore[union-attr]
                    generated_at=time.time(),
                )
            except Exception as e:
                print(
                    f"[svg_generator] {section.id} failed ({_backend}): {e}",
                    file=sys.stderr,
                )
                errors.append({"section_id": section.id, "error": str(e)})

    async def _bounded_next_action():
        nonlocal next_action_result
        async with sem:
            try:
                from ..schemas.research import ResearchSection as _Sec

                pseudo = _Sec(
                    id="Q999",
                    question="意思決定フローチャート",
                    kind="decisional",
                    answer=(next_action.summary or "次のアクション")[:170],  # type: ignore[union-attr]
                    body_md=(next_action.summary or "")[:1500] or "意思決定フローチャートを描画します. ",  # type: ignore[union-attr]
                    reference_ids=[],
                    svg_spec=next_action.svg_spec,  # type: ignore[union-attr]
                )
                svg_text = await asyncio.to_thread(
                    _generate_one,
                    next_action.svg_spec,  # type: ignore[union-attr]
                    pseudo,
                    research.theme,
                    research.intent,
                    model=_model,
                    backend=_backend,
                )
                next_action_result = ResearchSvgAsset(
                    svg_text=svg_text,
                    alt=next_action.svg_spec.intent,  # type: ignore[union-attr]
                    generated_at=time.time(),
                )
            except Exception as e:
                print(
                    f"[svg_generator] next_action failed ({_backend}): {e}",
                    file=sys.stderr,
                )
                errors.append({"section_id": "NEXT_ACTION", "error": str(e)})

    coros = [_bounded_section(i, s) for i, s in section_tasks]
    if next_action_task:
        coros.append(_bounded_next_action())
    await asyncio.gather(*coros)

    updated_sections = []
    for idx, section in enumerate(research.sections):
        if idx in section_results:
            updated_sections.append(
                section.model_copy(update={"svg_asset": section_results[idx]})
            )
        else:
            updated_sections.append(section)

    update_payload: dict = {"sections": updated_sections, "svg_done": True}
    if next_action_result and next_action is not None:
        update_payload["next_action"] = next_action.model_copy(
            update={"svg_asset": next_action_result}
        )
    updated_research = research.model_copy(update=update_payload)
    research_writer.update_research_json(deck_dir, updated_research)

    return {
        "generated": len(section_results),
        "skipped": len(research.sections) - len(section_tasks),
        "next_action_generated": next_action_result is not None,
        "errors": errors,
        "deck_dir": deck_dir,
        "backend": _backend,
        "model": _model,
    }
