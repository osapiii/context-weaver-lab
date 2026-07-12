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


def _finite_positive(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number > 0 else None


def probe_duration(video_path: str) -> float:
    data = _probe_json(
        video_path,
        ["-show_entries", "format=duration:stream=duration"],
    )
    candidates = [data.get("format", {}).get("duration")]
    candidates.extend(
        stream.get("duration")
        for stream in data.get("streams", [])
        if isinstance(stream, dict)
    )
    durations = [duration for value in candidates if (duration := _finite_positive(value))]
    if durations:
        return max(durations)

    # Chrome MediaRecorder WebM files commonly omit container/stream duration.
    # The packet timeline is still complete and is the authoritative fallback.
    packet_data = _probe_json(
        video_path,
        ["-show_entries", "packet=pts_time,dts_time,duration_time"],
    )
    packet_ends: list[float] = []
    for packet in packet_data.get("packets", []):
        if not isinstance(packet, dict):
            continue
        timestamp = _finite_positive(packet.get("pts_time"))
        if timestamp is None:
            timestamp = _finite_positive(packet.get("dts_time"))
        if timestamp is None:
            continue
        packet_duration = _finite_positive(packet.get("duration_time")) or 0.0
        packet_ends.append(timestamp + packet_duration)
    if packet_ends:
        return max(packet_ends)
    raise RuntimeError(
        "Could not read video duration with ffprobe "
        "(format, streams, and packet timestamps were unavailable)"
    )


def probe_video_canvas(video_path: str) -> tuple[int, int]:
    data = _probe_json(
        video_path,
        [
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height:frame=width,height",
        ],
    )
    dimensions: list[tuple[int, int]] = []
    for item in [*data.get("streams", []), *data.get("frames", [])]:
        if not isinstance(item, dict):
            continue
        try:
            width = int(item.get("width") or 0)
            height = int(item.get("height") or 0)
        except (TypeError, ValueError):
            continue
        if width > 0 and height > 0:
            dimensions.append((width, height))
    if not dimensions:
        raise RuntimeError("Could not read video dimensions with ffprobe")
    width = max(item[0] for item in dimensions)
    height = max(item[1] for item in dimensions)
    return (width + width % 2, height + height % 2)


def has_audio_stream(video_path: str) -> bool:
    data = _probe_json(
        video_path,
        ["-select_streams", "a:0", "-show_entries", "stream=codec_type"],
    )
    return bool(data.get("streams"))


def build_noise_reduction_filter(
    *,
    strength_db: float,
    noise_floor_db: float,
) -> str:
    strength = max(0.0, min(30.0, float(strength_db)))
    noise_floor = max(-80.0, min(-20.0, float(noise_floor_db)))
    return (
        "highpass=f=80,"
        f"afftdn=nr={strength:.2f}:nf={noise_floor:.2f}:tn=1,"
        "alimiter=limit=0.95"
    )


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


def merge_nearby_silence_ranges(
    silence_ranges: list[dict[str, float]],
    *,
    maximum_gap_seconds: float = 10.0,
) -> list[dict[str, float]]:
    """Treat brief speech/noise islands between silence candidates as silence."""
    gap_limit = max(0.0, float(maximum_gap_seconds))
    sorted_ranges = sorted(
        (dict(item) for item in silence_ranges if item["end"] > item["start"]),
        key=lambda item: (item["start"], item["end"]),
    )
    merged: list[dict[str, float]] = []
    for item in sorted_ranges:
        previous = merged[-1] if merged else None
        if previous is None or item["start"] - previous["end"] > gap_limit:
            merged.append(item)
        else:
            previous["end"] = max(previous["end"], item["end"])
    return merged


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


def map_source_time_to_output(
    source_seconds: float,
    timeline_map: list[dict[str, float]],
) -> float:
    if not timeline_map:
        return max(0.0, source_seconds)
    for item in timeline_map:
        if source_seconds < item["sourceStart"]:
            return item["outputStart"]
        if source_seconds <= item["sourceEnd"]:
            return item["outputStart"] + source_seconds - item["sourceStart"]
    return timeline_map[-1]["outputEnd"]


def output_split_points(
    source_split_points: list[float],
    timeline_map: list[dict[str, float]],
    output_duration: float,
) -> list[float]:
    mapped = sorted(
        {
            round(map_source_time_to_output(point, timeline_map), 3)
            for point in source_split_points
        }
    )
    return [point for point in mapped if 0.25 <= point <= output_duration - 0.25]


def render_video_segments(
    *,
    input_path: str,
    output_paths: list[str],
    split_points: list[float],
    duration_seconds: float,
) -> list[dict[str, float | str]]:
    boundaries = [0.0, *split_points, duration_seconds]
    if len(output_paths) != len(boundaries) - 1:
        raise RuntimeError("Segment output path count does not match split boundaries")
    rendered: list[dict[str, float | str]] = []
    for index, output_path in enumerate(output_paths):
        start = boundaries[index]
        end = boundaries[index + 1]
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        command = [
            "ffmpeg", "-y", "-hide_banner", "-nostdin",
            "-ss", f"{start:.6f}", "-to", f"{end:.6f}", "-i", input_path,
            "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264",
            "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
            output_path,
        ]
        try:
            _run(command)
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(f"ffmpeg segment render failed: {exc.stderr[-1600:]}") from exc
        rendered.append(
            {
                "path": output_path,
                "startTimeSeconds": start,
                "endTimeSeconds": end,
                "durationSeconds": max(0.0, end - start),
            }
        )
    return rendered


def render_trimmed_video(
    *,
    input_path: str,
    output_path: str,
    kept_ranges: list[dict[str, float]],
    no_audio_stream: bool,
    original_duration_seconds: float,
    noise_reduction_enabled: bool,
    noise_reduction_strength_db: float,
    noise_floor_db: float,
) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    cut_count = max(0, len(kept_ranges) - 1)
    almost_uncut = (
        cut_count == 0
        and kept_ranges
        and kept_ranges[0]["start"] <= 0.02
        and abs(kept_ranges[0]["end"] - original_duration_seconds) <= 0.02
    )
    if almost_uncut and (no_audio_stream or not noise_reduction_enabled):
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

    if almost_uncut:
        canvas_width, canvas_height = probe_video_canvas(input_path)
        normalize_video = (
            f"scale=w={canvas_width}:h={canvas_height}:"
            "force_original_aspect_ratio=decrease:force_divisible_by=2,"
            f"pad=w={canvas_width}:h={canvas_height}:"
            "x=(ow-iw)/2:y=(oh-ih)/2:color=black,setsar=1"
        )
        audio_filter = build_noise_reduction_filter(
            strength_db=noise_reduction_strength_db,
            noise_floor_db=noise_floor_db,
        )
        command = [
            "ffmpeg", "-y", "-hide_banner", "-nostdin", "-i", input_path,
            "-filter_complex",
            (
                f"[0:v]{normalize_video},fps=24,"
                f"tpad=stop_mode=clone:stop_duration={original_duration_seconds:.6f}[vout];"
                f"[0:a]{audio_filter},"
                f"apad=whole_dur={original_duration_seconds:.6f}[aout]"
            ),
            "-map", "[vout]", "-map", "[aout]",
            "-t", f"{original_duration_seconds:.6f}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart", output_path,
        ]
        try:
            _run(command)
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(
                f"ffmpeg noise reduction failed: {exc.stderr[-1600:]}"
            ) from exc
        return

    if len(kept_ranges) > 180:
        raise RuntimeError("Too many kept ranges. Relax silence settings and retry.")

    canvas_width, canvas_height = probe_video_canvas(input_path)
    normalize_video = (
        f"scale=w={canvas_width}:h={canvas_height}:"
        "force_original_aspect_ratio=decrease:force_divisible_by=2,"
        f"pad=w={canvas_width}:h={canvas_height}:"
        "x=(ow-iw)/2:y=(oh-ih)/2:color=black,setsar=1"
    )
    normalized_path = f"{output_path}.normalized.mp4"
    normalize_filters = [
        f"[0:v]{normalize_video},fps=24,"
        f"tpad=stop_mode=clone:stop_duration={original_duration_seconds:.6f}[vnorm]"
    ]
    if not no_audio_stream:
        audio_filters = []
        if noise_reduction_enabled:
            audio_filters.append(
                build_noise_reduction_filter(
                    strength_db=noise_reduction_strength_db,
                    noise_floor_db=noise_floor_db,
                )
            )
        audio_filters.append(f"apad=whole_dur={original_duration_seconds:.6f}")
        normalize_filters.append(
            f"[0:a]{','.join(audio_filters)}[anorm]"
        )
    normalize_command = [
        "ffmpeg", "-y", "-hide_banner", "-nostdin", "-i", input_path,
        "-filter_complex", ";".join(normalize_filters), "-map", "[vnorm]",
    ]
    if not no_audio_stream:
        normalize_command.extend(["-map", "[anorm]"])
    normalize_command.extend([
        "-t", f"{original_duration_seconds:.6f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-pix_fmt", "yuv420p",
    ])
    if not no_audio_stream:
        normalize_command.extend(["-c:a", "aac", "-b:a", "192k"])
    normalize_command.extend(["-movflags", "+faststart", normalized_path])
    try:
        _run(normalize_command)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"ffmpeg normalization failed: {exc.stderr[-1600:]}") from exc

    section_count = len(kept_ranges)
    video_sources = "".join(f"[vsrc{index}]" for index in range(section_count))
    filter_parts = [f"[0:v]split={section_count}{video_sources}"]
    if not no_audio_stream:
        audio_sources = "".join(f"[asrc{index}]" for index in range(section_count))
        filter_parts.append(f"[0:a]asplit={section_count}{audio_sources}")

    concat_inputs: list[str] = []
    for index, kept in enumerate(kept_ranges):
        start = f"{kept['start']:.6f}"
        end = f"{kept['end']:.6f}"
        filter_parts.append(
            f"[vsrc{index}]trim=start={start}:end={end},"
            f"setpts=PTS-STARTPTS[v{index}]"
        )
        concat_inputs.append(f"[v{index}]")
        if not no_audio_stream:
            filter_parts.append(
                f"[asrc{index}]atrim=start={start}:end={end},"
                f"asetpts=PTS-STARTPTS[a{index}]"
            )
            concat_inputs.append(f"[a{index}]")

    if no_audio_stream:
        filter_parts.append(
            "".join(concat_inputs) + f"concat=n={section_count}:v=1:a=0[vout]"
        )
    else:
        filter_parts.append(
            "".join(concat_inputs) + f"concat=n={section_count}:v=1:a=1[vout][aout]"
        )

    command = [
        "ffmpeg", "-y", "-hide_banner", "-nostdin", "-i", normalized_path,
        "-filter_complex", ";".join(filter_parts), "-map", "[vout]",
    ]
    if not no_audio_stream:
        command.extend(["-map", "[aout]"])
    command.extend([
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-pix_fmt", "yuv420p",
    ])
    if not no_audio_stream:
        command.extend(["-c:a", "aac", "-b:a", "192k"])
    command.extend(["-movflags", "+faststart", output_path])
    try:
        _run(command)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"ffmpeg trim failed: {exc.stderr[-1600:]}") from exc
    finally:
        Path(normalized_path).unlink(missing_ok=True)


def trim_silence_video(params: dict[str, Any]) -> dict[str, Any]:
    input_path = str(params["input_path"])
    output_path = str(params["output_path"])
    manifest_path = str(params["manifest_path"])
    settings = params.get("settings") or {}
    silence_cut_enabled = bool(settings.get("enabled", True))
    threshold_db = float(settings.get("thresholdDb", -38))
    min_silence_seconds = max(0.1, float(settings.get("minSilenceMs", 5000)) / 1000)
    keep_padding_seconds = max(0.0, float(settings.get("keepPaddingMs", 180)) / 1000)
    min_segment_seconds = max(0.1, float(settings.get("minSegmentMs", 450)) / 1000)
    merge_gap_seconds = max(0.0, float(settings.get("mergeGapMs", 10000)) / 1000)
    noise_reduction_enabled = bool(settings.get("noiseReductionEnabled", False))
    noise_reduction_strength_db = float(settings.get("noiseReductionStrengthDb", 12))
    noise_floor_db = float(settings.get("noiseFloorDb", -40))

    original_duration = probe_duration(input_path)
    no_audio_stream = not has_audio_stream(input_path)
    silence_ranges: list[dict[str, float]] = []
    explicit_ranges = settings.get("cutRangesSeconds")
    if silence_cut_enabled and not no_audio_stream:
        if explicit_ranges is not None:
            silence_ranges = sorted([
                {
                    "start": max(0.0, min(original_duration, float(item["start"]))),
                    "end": max(0.0, min(original_duration, float(item["end"]))),
                }
                for item in explicit_ranges
                if float(item["end"]) > float(item["start"])
            ], key=lambda item: item["start"])
        else:
            silence_ranges = detect_silence_ranges(
                input_path,
                duration_seconds=original_duration,
                threshold_db=threshold_db,
                min_silence_seconds=min_silence_seconds,
            )
        silence_ranges = merge_nearby_silence_ranges(
            silence_ranges,
            maximum_gap_seconds=merge_gap_seconds,
        )
    kept_ranges = compute_kept_ranges(
        duration_seconds=original_duration,
        silence_ranges=silence_ranges,
        keep_padding_seconds=0.0 if explicit_ranges is not None else keep_padding_seconds,
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
        noise_reduction_enabled=noise_reduction_enabled,
        noise_reduction_strength_db=noise_reduction_strength_db,
        noise_floor_db=noise_floor_db,
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
            "enabled": silence_cut_enabled,
            "thresholdDb": threshold_db,
            "minSilenceMs": int(min_silence_seconds * 1000),
            "keepPaddingMs": int(keep_padding_seconds * 1000),
            "minSegmentMs": int(min_segment_seconds * 1000),
            "noiseReductionEnabled": noise_reduction_enabled,
            "noiseReductionStrengthDb": noise_reduction_strength_db,
            "noiseFloorDb": noise_floor_db,
        },
        "noAudioStream": no_audio_stream,
        "noiseReductionApplied": noise_reduction_enabled and not no_audio_stream,
    }
    Path(manifest_path).parent.mkdir(parents=True, exist_ok=True)
    Path(manifest_path).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "output_path": output_path,
        "manifest_path": manifest_path,
        "manifest": manifest,
    }
