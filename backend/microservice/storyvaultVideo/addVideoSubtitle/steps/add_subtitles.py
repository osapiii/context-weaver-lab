"""
Subtitle rendering step.

Generates SRT and ASS subtitle files, then burns the ASS subtitles into a video
with FFmpeg/libass. The implementation intentionally avoids MoviePy and
ImageMagick so Cloud Run only depends on FFmpeg and Noto CJK fonts.
"""

import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from localPackages.common.logger import logger


DEFAULT_FONT_NAME = "Noto Sans CJK JP"
DEFAULT_FONT_DIR = "/usr/share/fonts/opentype/noto"
FFMPEG_BINARY = os.getenv("FFMPEG_BINARY", "ffmpeg")


PRESET_STYLES: Dict[str, Dict[str, Any]] = {
    "clear_standard": {
        "font_scale": 1.0,
        "font_color": "#FFFFFF",
        "outline_color": "#111827",
        "back_color": "rgba(0,0,0,0.35)",
        "bold": True,
        "position": "bottom",
        "outline": 4,
        "shadow": 1,
        "border_style": 1,
    },
    "business_emphasis": {
        "font_scale": 1.02,
        "font_color": "#FFFFFF",
        "outline_color": "#020617",
        "back_color": "rgba(15,23,42,0.82)",
        "bold": True,
        "position": "bottom",
        "outline": 2,
        "shadow": 0,
        "border_style": 3,
    },
    "cinema_bottom": {
        "font_scale": 0.92,
        "font_color": "#FFF7ED",
        "outline_color": "#000000",
        "back_color": "rgba(0,0,0,0.15)",
        "bold": False,
        "position": "bottom",
        "outline": 3,
        "shadow": 1,
        "border_style": 1,
    },
    "shorts_pop": {
        "font_scale": 1.18,
        "font_color": "#FEF3C7",
        "outline_color": "#0F172A",
        "back_color": "rgba(0,0,0,0)",
        "bold": True,
        "position": "bottom",
        "outline": 6,
        "shadow": 1,
        "border_style": 1,
    },
    "soft_gray_panel": {
        "font_scale": 1.0,
        "font_color": "#111827",
        "outline_color": "#F8FAFC",
        "back_color": "rgba(248,250,252,0.88)",
        "bold": True,
        "position": "bottom",
        "outline": 1,
        "shadow": 0,
        "border_style": 3,
    },
}


def format_srt_timestamp(milliseconds: int) -> str:
    total_seconds = milliseconds // 1000
    ms = milliseconds % 1000
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{ms:03d}"


def format_ass_timestamp(milliseconds: int) -> str:
    total_seconds = milliseconds // 1000
    centiseconds = (milliseconds % 1000) // 10
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:d}:{minutes:02d}:{seconds:02d}.{centiseconds:02d}"


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, mode=0o755, exist_ok=True)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _find_wrap_index(text: str, max_chars: int) -> int:
    search_end = min(max_chars, len(text) - 1)
    search_start = max(8, search_end - 10)
    soft_break_chars = set("、，,・／/ ")
    particle_break_chars = set("はがをにでともへや")
    for index in range(search_end, search_start - 1, -1):
        if text[index] in soft_break_chars:
            return index + 1
    for index in range(search_end, search_start - 1, -1):
        if text[index] in particle_break_chars:
            return index + 1
    return min(max_chars, len(text))


def _wrap_japanese_text(text: str, max_chars: int = 24) -> str:
    normalized = _normalize_text(text)
    if len(normalized) <= max_chars:
        return normalized
    lines: List[str] = []
    remaining = normalized
    while len(remaining) > max_chars:
        sentence_match = re.search(r"[。！？!?]", remaining[: max_chars + 1])
        break_index = sentence_match.end() if sentence_match else _find_wrap_index(remaining, max_chars)
        line = remaining[:break_index].strip()
        if line:
            lines.append(line)
        remaining = remaining[break_index:].strip()
    if remaining:
        lines.append(remaining)
    return "\n".join(lines)


def _escape_ass_text(text: str) -> str:
    escaped = _wrap_japanese_text(text).replace("{", "").replace("}", "")
    return escaped.replace("\n", r"\N")


def _parse_hex_color(color: str, fallback: str) -> tuple[int, int, int, int]:
    value = color or fallback
    rgba_match = re.match(r"rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)", value)
    if rgba_match:
        r = int(rgba_match.group(1))
        g = int(rgba_match.group(2))
        b = int(rgba_match.group(3))
        alpha = float(rgba_match.group(4)) if rgba_match.group(4) else 1.0
        return r, g, b, max(0, min(255, int((1.0 - alpha) * 255)))

    hex_match = re.match(r"#?([0-9a-fA-F]{6})", value)
    if hex_match:
        raw = hex_match.group(1)
        return int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16), 0

    named_colors = {
        "white": (255, 255, 255, 0),
        "black": (0, 0, 0, 0),
        "yellow": (254, 243, 199, 0),
    }
    return named_colors.get(value.lower(), _parse_hex_color(fallback, "#FFFFFF"))


def _to_ass_color(color: str, fallback: str) -> str:
    r, g, b, alpha = _parse_hex_color(color, fallback)
    return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"


def _resolve_style(caption_style: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    caption_style = caption_style or {}
    preset_key = str(caption_style.get("preset") or "clear_standard")
    style = dict(PRESET_STYLES.get(preset_key, PRESET_STYLES["clear_standard"]))
    if "position" in caption_style:
        style["position"] = caption_style["position"]
    if "fontScale" in caption_style:
        style["font_scale"] = float(caption_style["fontScale"] or style["font_scale"])
    if "fontColor" in caption_style:
        style["font_color"] = caption_style["fontColor"]
    if "outlineColor" in caption_style:
        style["outline_color"] = caption_style["outlineColor"]
    if "backColor" in caption_style:
        style["back_color"] = caption_style["backColor"]
    if "bold" in caption_style:
        style["bold"] = bool(caption_style["bold"])
    style["preset"] = preset_key
    return style


def generate_srt_file(params: dict) -> dict:
    caption_segments = params["caption_segments"]
    output_path = params["output_path"]

    logger.info(f"SRT file generation start: {output_path}")
    _ensure_parent_dir(output_path)
    srt_lines: List[str] = []

    subtitle_count = 0
    for segment in caption_segments:
        start_ms = int(segment["startMs"])
        end_ms = int(segment["endMs"])
        text = _normalize_text(segment.get("text", ""))
        if not text or end_ms <= start_ms:
            continue
        subtitle_count += 1
        srt_lines.extend(
            [
                str(subtitle_count),
                f"{format_srt_timestamp(start_ms)} --> {format_srt_timestamp(end_ms)}",
                _wrap_japanese_text(text),
                "",
            ]
        )

    with open(output_path, "w", encoding="utf-8-sig") as file:
        file.write("\n".join(srt_lines))

    return {"output_path": output_path, "subtitle_count": subtitle_count}


def generate_ass_file(params: dict) -> dict:
    caption_segments = params["caption_segments"]
    output_path = params["output_path"]
    style = _resolve_style(params.get("caption_style"))

    logger.info(f"ASS file generation start: {output_path}")
    _ensure_parent_dir(output_path)

    font_size = int(58 * float(style["font_scale"]))
    alignment = 8 if style["position"] == "top" else 2
    margin_v = 80 if style["position"] == "bottom" else 70
    primary_color = _to_ass_color(style["font_color"], "#FFFFFF")
    outline_color = _to_ass_color(style["outline_color"], "#000000")
    back_color = _to_ass_color(style["back_color"], "rgba(0,0,0,0.35)")
    bold = -1 if style["bold"] else 0

    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "PlayResX: 1920",
        "PlayResY: 1080",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Default,{DEFAULT_FONT_NAME},{font_size},{primary_color},&H000000FF,{outline_color},{back_color},{bold},0,0,0,100,100,0,0,{style['border_style']},{style['outline']},{style['shadow']},{alignment},110,110,{margin_v},1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    subtitle_count = 0
    for segment in caption_segments:
        start_ms = int(segment["startMs"])
        end_ms = int(segment["endMs"])
        text = _normalize_text(segment.get("text", ""))
        if not text or end_ms <= start_ms:
            continue
        subtitle_count += 1
        lines.append(
            f"Dialogue: 0,{format_ass_timestamp(start_ms)},{format_ass_timestamp(end_ms)},Default,,0,0,0,,{_escape_ass_text(text)}"
        )

    with open(output_path, "w", encoding="utf-8") as file:
        file.write("\n".join(lines) + "\n")

    return {
        "output_path": output_path,
        "subtitle_count": subtitle_count,
        "style": style,
    }


def _escape_filter_path(path: str) -> str:
    return (
        path.replace("\\", "/")
        .replace(":", r"\:")
        .replace(",", r"\,")
        .replace("[", r"\[")
        .replace("]", r"\]")
        .replace("'", r"\'")
    )


def _build_subtitles_filter(ass_path: str) -> str:
    filter_value = f"subtitles=filename={_escape_filter_path(ass_path)}"
    if Path(DEFAULT_FONT_DIR).exists():
        filter_value += f":fontsdir={_escape_filter_path(DEFAULT_FONT_DIR)}"
    return filter_value


def _run_ffmpeg(command: List[str]) -> subprocess.CompletedProcess[str]:
    logger.info("Running FFmpeg: " + " ".join(command))
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        logger.error(f"FFmpeg stderr: {result.stderr[-4000:]}")
        raise RuntimeError(f"FFmpeg failed with exit code {result.returncode}: {result.stderr[-1200:]}")
    return result


def render_subtitled_video(params: dict) -> dict:
    video_path = params["video_path"]
    ass_path = params["ass_path"]
    output_path = params["output_path"]
    _ensure_parent_dir(output_path)

    if not Path(video_path).exists():
        raise FileNotFoundError(f"Video not found: {video_path}")
    if not Path(ass_path).exists():
        raise FileNotFoundError(f"ASS subtitle not found: {ass_path}")

    filter_value = _build_subtitles_filter(ass_path)
    command = [
        FFMPEG_BINARY,
        "-y",
        "-i",
        video_path,
        "-vf",
        filter_value,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        output_path,
    ]
    try:
        _run_ffmpeg(command)
    except RuntimeError:
        logger.warning("FFmpeg stream copy failed. Retrying with AAC audio encoding.")
        command = [
            FFMPEG_BINARY,
            "-y",
            "-i",
            video_path,
            "-vf",
            filter_value,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            output_path,
        ]
        _run_ffmpeg(command)

    file_size = os.path.getsize(output_path)
    logger.success(f"Subtitled video generated: {output_path} ({file_size} bytes)")
    return {
        "output_path": output_path,
        "file_size": file_size,
    }
