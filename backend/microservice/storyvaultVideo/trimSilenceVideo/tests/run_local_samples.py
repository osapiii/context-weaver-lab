from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from steps.trim_silence import has_audio_stream, probe_duration, trim_silence_video  # noqa: E402


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def make_video_with_audio_plan(output_path: Path, plan: list[tuple[str, float]]) -> None:
    total_duration = sum(duration for _, duration in plan)
    filter_parts: list[str] = []
    concat_inputs: list[str] = []
    for index, (kind, duration) in enumerate(plan):
        if kind == "silence":
            filter_parts.append(
                f"anullsrc=channel_layout=stereo:sample_rate=44100:duration={duration}[a{index}]"
            )
        elif kind == "quiet":
            frequency = 440 + index * 110
            filter_parts.append(f"sine=frequency={frequency}:duration={duration},volume=0.35[a{index}]")
        else:
            frequency = 440 + index * 110
            filter_parts.append(f"sine=frequency={frequency}:duration={duration}[a{index}]")
        concat_inputs.append(f"[a{index}]")
    filter_parts.append("".join(concat_inputs) + f"concat=n={len(plan)}:v=0:a=1[aout]")
    run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc=size=640x360:rate=30:duration={total_duration}",
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            "0:v",
            "-map",
            "[aout]",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
            str(output_path),
        ]
    )


def make_video_without_audio(output_path: Path, duration: float) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc=size=640x360:rate=30:duration={duration}",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ]
    )


def validate_case(
    *,
    name: str,
    input_path: Path,
    output_path: Path,
    manifest_path: Path,
    should_shorten: bool,
    expect_audio: bool,
) -> dict[str, object]:
    original_duration = probe_duration(str(input_path))
    result = trim_silence_video(
        {
            "input_path": str(input_path),
            "output_path": str(output_path),
            "manifest_path": str(manifest_path),
            "settings": {
                "thresholdDb": -38,
                "minSilenceMs": 700,
                "keepPaddingMs": 180,
                "minSegmentMs": 450,
            },
        }
    )
    output_duration = probe_duration(str(output_path))
    output_has_audio = has_audio_stream(str(output_path))
    manifest = result["manifest"]
    if not output_path.exists() or output_path.stat().st_size <= 0:
        raise AssertionError(f"{name}: output MP4 was not created")
    if not manifest_path.exists():
        raise AssertionError(f"{name}: manifest was not created")
    if expect_audio and not output_has_audio:
        raise AssertionError(f"{name}: output lost audio stream")
    if should_shorten and not output_duration < original_duration - 0.5:
        raise AssertionError(
            f"{name}: expected shorter output ({original_duration:.2f}s -> {output_duration:.2f}s)"
        )
    if not should_shorten and abs(output_duration - original_duration) > 0.25:
        raise AssertionError(
            f"{name}: no-cut case changed too much ({original_duration:.2f}s -> {output_duration:.2f}s)"
        )
    if output_duration <= 0:
        raise AssertionError(f"{name}: invalid output duration")
    return {
        "name": name,
        "originalDuration": round(original_duration, 3),
        "outputDuration": round(output_duration, 3),
        "cutCount": manifest["cutCount"],
        "audio": output_has_audio,
        "removed": round(manifest["removedDurationSeconds"], 3),
    }


def main() -> None:
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise SystemExit("ffmpeg and ffprobe are required")
    work_dir = Path(tempfile.mkdtemp(prefix="trim_silence_samples_"))
    summaries: list[dict[str, object]] = []
    try:
        cases = [
            {
                "name": "middle_silence",
                "plan": [("tone", 1.2), ("silence", 1.2), ("tone", 1.2), ("silence", 1.0), ("tone", 1.4)],
                "should_shorten": True,
                "expect_audio": True,
            },
            {
                "name": "no_silence",
                "plan": [("tone", 2.8), ("tone", 2.2)],
                "should_shorten": False,
                "expect_audio": True,
            },
            {
                "name": "head_tail_silence",
                "plan": [("silence", 1.2), ("tone", 2.2), ("silence", 1.3)],
                "should_shorten": True,
                "expect_audio": True,
            },
            {
                "name": "short_phrases",
                "plan": [
                    ("tone", 0.55),
                    ("silence", 0.8),
                    ("tone", 0.6),
                    ("silence", 0.9),
                    ("tone", 0.75),
                ],
                "should_shorten": True,
                "expect_audio": True,
            },
            {
                "name": "mostly_silence_one_phrase",
                "plan": [("silence", 1.5), ("tone", 1.0), ("silence", 1.6)],
                "should_shorten": True,
                "expect_audio": True,
            },
            {
                "name": "quiet_audio_above_threshold",
                "plan": [("quiet", 1.8), ("silence", 1.0), ("quiet", 1.8)],
                "should_shorten": True,
                "expect_audio": True,
            },
            {
                "name": "all_silence_fallback",
                "plan": [("silence", 3.0)],
                "should_shorten": False,
                "expect_audio": True,
            },
        ]
        for case in cases:
            input_path = work_dir / f"{case['name']}_input.mp4"
            output_path = work_dir / f"{case['name']}_trimmed.mp4"
            manifest_path = work_dir / f"{case['name']}_manifest.json"
            make_video_with_audio_plan(input_path, case["plan"])
            summaries.append(
                validate_case(
                    name=case["name"],
                    input_path=input_path,
                    output_path=output_path,
                    manifest_path=manifest_path,
                    should_shorten=case["should_shorten"],
                    expect_audio=case["expect_audio"],
                )
            )

        no_audio_input = work_dir / "no_audio_input.mp4"
        make_video_without_audio(no_audio_input, 3.0)
        summaries.append(
            validate_case(
                name="no_audio_stream",
                input_path=no_audio_input,
                output_path=work_dir / "no_audio_trimmed.mp4",
                manifest_path=work_dir / "no_audio_manifest.json",
                should_shorten=False,
                expect_audio=False,
            )
        )

        summary_path = work_dir / "summary.json"
        summary_path.write_text(json.dumps(summaries, indent=2), encoding="utf-8")
        print(json.dumps({"workDir": str(work_dir), "cases": summaries}, indent=2))
    except Exception:
        print(f"Artifacts kept at: {work_dir}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
