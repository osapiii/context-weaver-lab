from __future__ import annotations

import json
import math
import re
import subprocess
from pathlib import Path
from typing import Any


SILENCE_START_RE = re.compile(r"silence_start:\s*([0-9.]+)")
SILENCE_END_RE = re.compile(r"silence_end:\s*([0-9.]+)")


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def _probe_json(video_path: str, args: list[str]) -> dict[str, Any]:
    result = _run(["ffprobe", "-v", "error", *args, "-of", "json", video_path])
    return json.loads(result.stdout or "{}")


def probe_duration(video_path: str) -> float:
    data = _probe_json(video_path, ["-show_entries", "format=duration"])
    duration = float(data.get("format", {}).get("duration") or 0)
    if not math.isfinite(duration) or duration <= 0:
        raise RuntimeError("Could not read video duration with ffprobe")
    return duration


def has_audio_stream(video_path: str) -> bool:
    data = _probe_json(
        video_path,
        ["-select_streams", "a:0", "-show_entries", "stream=codec_type"],
    )
    return bool(data.get("streams"))


def detect_silence_ranges(
    video_path: str,
    *,
    duration_seconds: float,
    threshold_db: float,
    min_silence_seconds: float,
) -> list[dict[str, float]]:
    command = [
        "ffmpeg",
        "-hide_banner",
        "-nostdin",
        "-i",
        video_path,
        "-af",
        f"silencedetect=noise={threshold_db}dB:d={min_silence_seconds}",
        "-f",
        "null",
        "-",
    ]
    result = subprocess.run(
        command,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg silencedetect failed: {result.stderr[-1200:]}")

    silence_ranges: list[dict[str, float]] = []
    open_start: float | None = None
    for line in result.stderr.splitlines():
        start_match = SILENCE_START_RE.search(line)
        if start_match:
            open_start = float(start_match.group(1))
            continue
        end_match = SILENCE_END_RE.search(line)
        if end_match and open_start is not None:
            silence_ranges.append(
                {
                    "start": max(0.0, open_start),
                    "end": min(duration_seconds, float(end_match.group(1))),
                }
            )
            open_start = None
    if open_start is not None:
        silence_ranges.append({"start": max(0.0, open_start), "end": duration_seconds})
    return [item for item in silence_ranges if item["end"] > item["start"]]


def compute_kept_ranges(
    *,
    duration_seconds: float,
    silence_ranges: list[dict[str, float]],
    keep_padding_seconds: float,
    min_segment_seconds: float,
) -> list[dict[str, float]]:
    cut_ranges: list[dict[str, float]] = []
    for silence in silence_ranges:
        cut_start = max(0.0, silence["start"] + keep_padding_seconds)
        cut_end = min(duration_seconds, silence["end"] - keep_padding_seconds)
        if cut_end > cut_start:
            cut_ranges.append({"start": cut_start, "end": cut_end})

    if not cut_ranges:
        return [{"start": 0.0, "end": duration_seconds}]

    kept_ranges: list[dict[str, float]] = []
    cursor = 0.0
    for cut in cut_ranges:
        if cut["start"] > cursor:
            kept_ranges.append({"start": cursor, "end": cut["start"]})
        cursor = max(cursor, cut["end"])
    if cursor < duration_seconds:
        kept_ranges.append({"start": cursor, "end": duration_seconds})

    # Keep short edge padding ranges as-is. Merging across a cut would silently
    # reintroduce the silence that was just detected.
    return [item for item in kept_ranges if item["end"] - item["start"] > 0.05] or [
        {"start": 0.0, "end": duration_seconds}
    ]


def build_timeline_map(kept_ranges: list[dict[str, float]]) -> list[dict[str, float]]:
    cursor = 0.0
    timeline_map: list[dict[str, float]] = []
    for kept in kept_ranges:
        length = kept["end"] - kept["start"]
        timeline_map.append(
            {
                "sourceStart": kept["start"],
                "sourceEnd": kept["end"],
                "outputStart": cursor,
                "outputEnd": cursor + length,
            }
        )
        cursor += length
    return timeline_map


def render_trimmed_video(
    *,
    input_path: str,
    output_path: str,
    kept_ranges: list[dict[str, float]],
    no_audio_stream: bool,
    original_duration_seconds: float,
) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    cut_count = max(0, len(kept_ranges) - 1)
    almost_uncut = (
        cut_count == 0
        and kept_ranges
        and kept_ranges[0]["start"] <= 0.02
        and abs(kept_ranges[0]["end"] - original_duration_seconds) <= 0.02
    )
    if almost_uncut:
        _run(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-nostdin",
                "-i",
                input_path,
                "-map",
                "0",
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                output_path,
            ]
        )
        return

    if len(kept_ranges) > 180:
        raise RuntimeError("Too many kept ranges. Relax silence settings and retry.")

    filter_parts: list[str] = []
    concat_inputs: list[str] = []
    for index, kept in enumerate(kept_ranges):
        start = f"{kept['start']:.6f}"
        end = f"{kept['end']:.6f}"
        filter_parts.append(f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{index}]")
        concat_inputs.append(f"[v{index}]")
        if not no_audio_stream:
            filter_parts.append(
                f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{index}]"
            )
            concat_inputs.append(f"[a{index}]")

    if no_audio_stream:
        filter_parts.append("".join(concat_inputs) + f"concat=n={len(kept_ranges)}:v=1:a=0[vout]")
        command = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-nostdin",
            "-i",
            input_path,
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            "[vout]",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            output_path,
        ]
    else:
        filter_parts.append("".join(concat_inputs) + f"concat=n={len(kept_ranges)}:v=1:a=1[vout][aout]")
        command = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-nostdin",
            "-i",
            input_path,
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            "[vout]",
            "-map",
            "[aout]",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            output_path,
        ]
    try:
        _run(command)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"ffmpeg trim failed: {exc.stderr[-1600:]}") from exc


def trim_silence_video(params: dict[str, Any]) -> dict[str, Any]:
    input_path = str(params["input_path"])
    output_path = str(params["output_path"])
    manifest_path = str(params["manifest_path"])
    settings = params.get("settings") or {}
    threshold_db = float(settings.get("thresholdDb", -38))
    min_silence_seconds = max(0.1, float(settings.get("minSilenceMs", 700)) / 1000)
    keep_padding_seconds = max(0.0, float(settings.get("keepPaddingMs", 180)) / 1000)
    min_segment_seconds = max(0.1, float(settings.get("minSegmentMs", 450)) / 1000)

    original_duration = probe_duration(input_path)
    no_audio_stream = not has_audio_stream(input_path)
    silence_ranges: list[dict[str, float]] = []
    if not no_audio_stream:
        silence_ranges = detect_silence_ranges(
            input_path,
            duration_seconds=original_duration,
            threshold_db=threshold_db,
            min_silence_seconds=min_silence_seconds,
        )
    kept_ranges = compute_kept_ranges(
        duration_seconds=original_duration,
        silence_ranges=silence_ranges,
        keep_padding_seconds=keep_padding_seconds,
        min_segment_seconds=min_segment_seconds,
    )
    fallback_reason = None
    kept_total_seconds = sum(item["end"] - item["start"] for item in kept_ranges)
    minimum_useful_duration = max(min_segment_seconds, min(2.0, original_duration * 0.2))
    if silence_ranges and kept_total_seconds < minimum_useful_duration:
        fallback_reason = "remaining_duration_too_short"
        kept_ranges = [{"start": 0.0, "end": original_duration}]
    render_trimmed_video(
        input_path=input_path,
        output_path=output_path,
        kept_ranges=kept_ranges,
        no_audio_stream=no_audio_stream,
        original_duration_seconds=original_duration,
    )
    trimmed_duration = probe_duration(output_path)
    manifest = {
        "originalDurationSeconds": original_duration,
        "trimmedDurationSeconds": trimmed_duration,
        "removedDurationSeconds": max(0.0, original_duration - trimmed_duration),
        "cutCount": max(0, len(kept_ranges) - 1),
        "silenceRanges": silence_ranges,
        "keptRanges": kept_ranges,
        "timelineMap": build_timeline_map(kept_ranges),
        "fallbackReason": fallback_reason,
        "settings": {
            "thresholdDb": threshold_db,
            "minSilenceMs": int(min_silence_seconds * 1000),
            "keepPaddingMs": int(keep_padding_seconds * 1000),
            "minSegmentMs": int(min_segment_seconds * 1000),
        },
        "noAudioStream": no_audio_stream,
    }
    Path(manifest_path).parent.mkdir(parents=True, exist_ok=True)
    Path(manifest_path).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "output_path": output_path,
        "manifest_path": manifest_path,
        "manifest": manifest,
    }
