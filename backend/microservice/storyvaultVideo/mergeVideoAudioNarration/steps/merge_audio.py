"""
動画・音声マージステップ

ffmpeg サブプロセスを使用して動画と音声ナレーションをタイムスタンプベースで合成します。
MoviePy は高解像度動画で 8GB 超のメモリを消費するため、ストリーミング処理の ffmpeg に置き換え。
"""

import json
import os
import shutil
import subprocess
from typing import List, Dict, Tuple, Optional
from localPackages.common.logger import logger


def _resolve_media_binary(name: str) -> str:
    binary_path = shutil.which(name)
    if not binary_path:
        raise RuntimeError(f"{name} binary was not found in PATH")
    return binary_path


def _file_size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


def _assert_readable_file(path: str, label: str):
    if not os.path.exists(path):
        raise FileNotFoundError(f"{label} file does not exist: {path}")
    size = _file_size(path)
    if size <= 0:
        raise RuntimeError(f"{label} file is empty: {path}")
    logger.info(f"{label} file ready: {path} ({size} bytes)")


def _run_media_command(cmd: List[str], *, timeout: int, label: str) -> subprocess.CompletedProcess:
    """
    Run ffprobe/ffmpeg through a subprocess path that avoids gRPC fork handlers.

    Cloud Run workers already have Firestore/GCS gRPC clients alive when this runs.
    Python's default fork+exec path can trigger grpc C-core epoll errors in the child
    before ffprobe/ffmpeg even starts. Supplying an absolute executable path and
    close_fds=False lets CPython use posix_spawn on Linux, avoiding that failure mode.
    """
    if not cmd:
        raise ValueError("command must not be empty")

    command = [_resolve_media_binary(cmd[0]), *cmd[1:]]
    logger.info(f"{label} command start", executable=command[0], timeout_seconds=timeout)
    try:
        return subprocess.run(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            errors="replace",
            timeout=timeout,
            close_fds=False,
        )
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"{label} timed out after {timeout}s") from e


def _parse_rate(value: object) -> float:
    if value is None:
        return 0.0
    try:
        text = str(value)
        if "/" in text:
            num, den = text.split("/", 1)
            denominator = float(den)
            if denominator == 0:
                return 0.0
            return float(num) / denominator
        return float(text)
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0


def _normalise_video_fps(raw_fps: float) -> float:
    """Chrome WebM can report r_frame_rate=1000/1; cap it to a sane export FPS."""
    if raw_fps <= 0:
        return 30.0
    if raw_fps > 120:
        logger.info(f"入力fpsが高すぎるため30fpsへ正規化します: raw_fps={raw_fps:.2f}")
        return 30.0
    return max(1.0, min(raw_fps, 60.0))


def _get_audio_duration_seconds(audio_path: str) -> float:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=nokey=1:noprint_wrappers=1",
        audio_path,
    ]
    result = _run_media_command(cmd, timeout=20, label="ffprobe-audio-duration")
    if result.returncode != 0:
        logger.warning(
            "音声duration取得に失敗しました",
            return_code=result.returncode,
            stderr=(result.stderr or "").strip()[-1000:],
        )
        return 0.0
    try:
        return max(0.0, float((result.stdout or "0").strip() or 0))
    except ValueError:
        return 0.0


def _get_has_video_and_size(video_path: str) -> Tuple[bool, bool, int, int, float, float, float, float]:
    """ffprobeで映像ストリームの有無とサイズ・duration・start_time・fpsを取得。
    durationは stream.duration と format.duration の長い方を採用（短い方が誤っている場合の途切れを防止）。
    """
    _assert_readable_file(video_path, "input video")
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_streams", "-show_format",
        "-print_format", "json",
        video_path,
    ]
    result = _run_media_command(cmd, timeout=30, label="ffprobe")
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        raise RuntimeError(f"ffprobe failed (code={result.returncode}): {stderr or stdout or 'no output'}")
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"ffprobe returned invalid JSON: {(result.stdout or '')[:500]}") from e
    has_video = False
    has_audio = False
    width, height = 1920, 1080
    stream_duration = 0.0
    start_time = 0.0
    fps = 30.0
    for s in data.get("streams", []):
        if s.get("codec_type") == "video":
            has_video = True
            width = int(s.get("width", 1920))
            height = int(s.get("height", 1080))
            stream_dur = s.get("duration")
            if stream_dur is not None:
                try:
                    stream_duration = float(stream_dur)
                except (TypeError, ValueError):
                    pass
            # fps取得（VFR対策のfps固定に使用）
            rf = s.get("r_frame_rate")
            avg_fps = _parse_rate(s.get("avg_frame_rate"))
            raw_fps = avg_fps or _parse_rate(rf)
            fps = _normalise_video_fps(raw_fps)
            if not stream_duration and s.get("nb_frames") and rf:
                try:
                    nf = int(s["nb_frames"])
                    f = _normalise_video_fps(_parse_rate(rf))
                    if f > 0:
                        stream_duration = nf / f
                except (TypeError, ValueError, ZeroDivisionError, KeyError):
                    pass
            break
        if s.get("codec_type") == "audio":
            has_audio = True

    format_duration = 0.0
    if data.get("format"):
        fmt = data["format"]
        format_duration = float(fmt.get("duration", 0) or 0)
        if start_time == 0:
            st = fmt.get("start_time")
            if st is not None:
                try:
                    start_time = float(st)
                except (TypeError, ValueError):
                    pass

    # 長い方を採用（streamが4s, formatが10sの場合の途切れを防止）
    duration = max(stream_duration, format_duration) if (stream_duration or format_duration) else 0.0
    if stream_duration and format_duration and abs(stream_duration - format_duration) > 0.5:
        logger.info(
            f"duration差あり: stream={stream_duration:.2f}s, format={format_duration:.2f}s → {duration:.2f}s採用"
        )
    if not has_audio:
        has_audio = any(s.get("codec_type") == "audio" for s in data.get("streams", []))
    return has_video, has_audio, width, height, duration, start_time, fps, stream_duration


def _get_audio_max_volume_db(path: str) -> Optional[float]:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i",
        path,
        "-map",
        "0:a:0",
        "-af",
        "volumedetect",
        "-f",
        "null",
        "-",
    ]
    result = _run_media_command(cmd, timeout=120, label="ffmpeg-audio-volume")
    if result.returncode != 0:
        logger.warning(
            "音声音量検査に失敗しました",
            return_code=result.returncode,
            stderr=(result.stderr or "").strip()[-1200:],
        )
        return None
    for line in (result.stderr or "").splitlines():
        if "max_volume:" not in line:
            continue
        raw_value = line.split("max_volume:", 1)[1].strip().split(" ", 1)[0]
        if raw_value == "-inf":
            return float("-inf")
        try:
            return float(raw_value)
        except ValueError:
            return None
    return None


def _media_duration_seconds(path: str) -> float:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=nokey=1:noprint_wrappers=1",
        path,
    ]
    result = _run_media_command(cmd, timeout=30, label="ffprobe-output-duration")
    if result.returncode != 0:
        logger.warning(
            "出力duration取得に失敗しました",
            return_code=result.returncode,
            stderr=(result.stderr or "").strip()[-1000:],
        )
        return 0.0
    try:
        return max(0.0, float((result.stdout or "0").strip() or 0))
    except ValueError:
        return 0.0


def _assert_duration_close(path: str, expected_duration: float) -> float:
    actual_duration = _media_duration_seconds(path)
    if expected_duration <= 0:
        return actual_duration
    tolerance = max(0.35, min(1.0, expected_duration * 0.03))
    logger.info(
        f"出力duration検査: actual={actual_duration:.3f}s expected={expected_duration:.3f}s tolerance={tolerance:.3f}s"
    )
    if actual_duration <= 0:
        raise RuntimeError("merged output duration could not be determined")
    if abs(actual_duration - expected_duration) > tolerance:
        raise RuntimeError(
            f"merged output duration mismatch: actual={actual_duration:.3f}s expected={expected_duration:.3f}s"
        )
    return actual_duration


def _assert_audible_output(path: str, *, required: bool) -> None:
    if not required:
        return
    _, has_audio, *_ = _get_has_video_and_size(path)
    if not has_audio:
        raise RuntimeError("merged output has no audio stream")
    max_volume = _get_audio_max_volume_db(path)
    if max_volume is None:
        logger.warning("音声音量検査をスキップしました: max_volumeが取得できません")
        return
    logger.info(f"出力音声 max_volume: {max_volume:.2f} dB")
    if max_volume == float("-inf") or max_volume < -60:
        raise RuntimeError(f"merged output audio is silent or too quiet: max_volume={max_volume} dB")


def _assert_output_audio_encoding(path: str, *, required: bool) -> None:
    if not required:
        return
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_name,sample_rate,channels",
        "-print_format", "json",
        path,
    ]
    result = _run_media_command(cmd, timeout=30, label="ffprobe-output-audio-encoding")
    if result.returncode != 0:
        raise RuntimeError(
            "merged output audio encoding could not be inspected: "
            f"{(result.stderr or result.stdout or '').strip()[-1000:]}"
        )
    try:
        data = json.loads(result.stdout or "{}")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"ffprobe returned invalid audio encoding JSON: {(result.stdout or '')[:500]}") from e

    streams = data.get("streams") or []
    if not streams:
        raise RuntimeError("merged output has no inspectable audio stream")

    audio = streams[0]
    codec_name = str(audio.get("codec_name") or "")
    sample_rate = str(audio.get("sample_rate") or "")
    channels = int(audio.get("channels") or 0)
    logger.info(
        "出力音声codec検査",
        codec_name=codec_name,
        sample_rate=sample_rate,
        channels=channels,
    )
    if codec_name != "aac" or sample_rate != "48000" or channels < 2:
        raise RuntimeError(
            "merged output audio encoding mismatch: "
            f"codec={codec_name or 'unknown'} sample_rate={sample_rate or 'unknown'} channels={channels}; "
            "expected AAC 48000Hz stereo"
        )


def _last_non_silent_end_seconds(path: str, *, noise_db: int = -40, min_silence_seconds: float = 0.15) -> Optional[float]:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i",
        path,
        "-map",
        "0:a:0",
        "-af",
        f"silencedetect=noise={noise_db}dB:d={min_silence_seconds}",
        "-f",
        "null",
        "-",
    ]
    result = _run_media_command(cmd, timeout=120, label="ffmpeg-silencedetect")
    if result.returncode != 0:
        logger.warning(f"音声終端検査に失敗しました: {(result.stderr or '')[-1200:]}")
        return None

    duration = _get_audio_duration_seconds(path) or _media_duration_seconds(path)
    last_end = 0.0 if duration > 0 else None
    current_silence_start: Optional[float] = None
    for line in (result.stderr or "").splitlines():
        if "silence_start:" in line:
            raw_value = line.split("silence_start:", 1)[1].strip().split(" ", 1)[0]
            try:
                current_silence_start = max(float(raw_value), 0.0)
                last_end = current_silence_start
            except ValueError:
                continue
        elif "silence_end:" in line:
            raw_value = line.split("silence_end:", 1)[1].strip().split(" ", 1)[0]
            try:
                silence_end = max(float(raw_value), 0.0)
                if duration > 0 and silence_end >= duration - 0.05 and current_silence_start is not None:
                    last_end = current_silence_start
                else:
                    last_end = max(silence_end, last_end or 0.0)
                current_silence_start = None
            except ValueError:
                continue
    return last_end


def _assert_audio_segments_not_truncated(
    output_path: str,
    audio_segments_with_paths: List[dict],
    output_duration_seconds: float,
) -> None:
    if not audio_segments_with_paths or output_duration_seconds <= 0:
        return

    expected_last_speech_end = 0.0
    for seg in audio_segments_with_paths:
        start_seconds = max(0.0, int(seg.get("timestamp_ms", 0)) / 1000.0)
        remaining_seconds = max(0.0, output_duration_seconds - start_seconds)
        if remaining_seconds <= 0:
            continue
        source_last_speech_end = _last_non_silent_end_seconds(seg["local_path"])
        if source_last_speech_end is None:
            source_last_speech_end = _get_audio_duration_seconds(seg["local_path"])
        if source_last_speech_end <= 0:
            continue
        expected_last_speech_end = max(
            expected_last_speech_end,
            start_seconds + min(source_last_speech_end, remaining_seconds),
        )

    if expected_last_speech_end <= 1.0:
        return

    output_last_speech_end = _last_non_silent_end_seconds(output_path)
    if output_last_speech_end is None:
        logger.warning("出力音声終端検査をスキップしました: last non-silent endが取得できません")
        return

    tolerance_seconds = 1.0
    logger.info(
        "音声終端検査: "
        f"output_last_speech_end={output_last_speech_end:.3f}s "
        f"expected_last_speech_end={expected_last_speech_end:.3f}s"
    )
    if output_last_speech_end + tolerance_seconds < expected_last_speech_end:
        raise RuntimeError(
            "merged output audio appears truncated: "
            f"last_speech={output_last_speech_end:.3f}s expected_at_least={expected_last_speech_end:.3f}s"
        )


def merge_audio_with_video(params: dict) -> dict:
    """
    動画と音声セグメントをタイムスタンプベースで合成（ffmpeg 実装）

    params:
        video_path: str - 動画ローカルパス
        audio_segments_with_paths: List[dict] - タイムスタンプ付き音声パスリスト
        output_path: str - 出力ファイルパス

    returns:
        dict - マージ結果
            output_path: str - 出力ファイルパス
    """
    video_path = params['video_path']
    audio_segments_with_paths = params['audio_segments_with_paths']
    output_path = params['output_path']
    expected_duration_seconds = params.get('expected_duration_seconds')

    logger.info(f"動画・音声マージ開始（ffmpeg）: {video_path}")
    logger.info(f"音声セグメント数: {len(audio_segments_with_paths)}")
    for idx, seg in enumerate(audio_segments_with_paths):
        _assert_readable_file(seg["local_path"], f"audio segment {idx + 1}")
        logger.info(f"音声 [{idx+1}/{len(audio_segments_with_paths)}]: {seg['local_path']}, タイムスタンプ={seg['timestamp_ms']/1000:.3f}秒")

    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, mode=0o755, exist_ok=True)
        logger.info(f"出力ディレクトリを作成しました: {output_dir}")

    has_video, has_input_audio, width, height, probed_duration, _, fps, stream_duration = _get_has_video_and_size(video_path)
    try:
        expected_duration = float(expected_duration_seconds or 0)
    except (TypeError, ValueError):
        expected_duration = 0.0
    duration = expected_duration if expected_duration > 0 else probed_duration
    if expected_duration > 0:
        logger.info(
            f"セクション定義の長さを優先します: expected={expected_duration:.3f}s, probed={probed_duration:.3f}s, fps={fps:.1f}"
        )
    elif has_video and duration > 0:
        logger.info(f"入力映像の長さ: {duration:.2f}秒, fps: {fps:.1f}（この長さを出力に維持）")

    if len(audio_segments_with_paths) == 0:
        logger.info("音声セグメントなし。入力動画の音声を保持して出力します")
        if has_video:
            # setptsでPTS正規化、yuv420pでQuickTime互換（-pix_fmt が最重要）
            # -g: キーフレーム間隔（QuickTimeは長いGOPで4秒以降黒化することがある）
            gop = max(24, min(60, int(round(fps))))  # 約1秒間隔（QuickTimeは長GOPで黒化する）
            cmd = [
                "ffmpeg", "-y", "-fflags", "+genpts",
                "-i", video_path,
                "-vf", f"setpts=PTS-STARTPTS,fps={int(round(fps))},format=yuv420p",
                "-map", "0:v:0",
                "-map", "0:a:0?",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                "-pix_fmt", "yuv420p", "-profile:v", "main", "-g", str(gop),
                "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
                "-vsync", "cfr",
                "-movflags", "+faststart",
                "-avoid_negative_ts", "make_zero",
                "-muxdelay", "0", "-muxpreload", "0",
            ]
            if duration > 0:
                cmd.extend(["-t", f"{duration:.3f}"])
            cmd.append(output_path)
        else:
            # 映像なし: lavfiで黒映像を生成
            d = duration or 1.0
            cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r=30:d={d}",
                "-an", "-c:v", "libx264", "-avoid_negative_ts", "make_zero",
                output_path,
            ]
    else:
        cmd = _build_ffmpeg_merge_command(
            video_path, audio_segments_with_paths, output_path,
            has_video=has_video, width=width, height=height, duration=duration,
            fps=fps, stream_duration=stream_duration,
        )

    logger.info(f"MP4出力開始: {output_path}")
    result = _run_media_command(cmd, timeout=600, label="ffmpeg")

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        logger.error("ffmpeg マージエラー", return_code=result.returncode, stderr=stderr[-4000:], stdout=stdout[-1000:])
        raise RuntimeError(f"ffmpeg マージ失敗 (code={result.returncode}): {stderr or stdout or 'no output'}")

    logger.success(f"MP4出力完了: {output_path}")
    _assert_audible_output(
        output_path,
        required=len(audio_segments_with_paths) > 0 or has_input_audio,
    )
    _assert_output_audio_encoding(
        output_path,
        required=len(audio_segments_with_paths) > 0 or has_input_audio,
    )
    actual_duration = _assert_duration_close(output_path, duration) if duration > 0 else _media_duration_seconds(output_path)
    _assert_audio_segments_not_truncated(output_path, audio_segments_with_paths, actual_duration)
    logger.info("短時間RMS比較によるブツ切れ検査は自然な無音を誤検知するため実行しません")
    return {'output_path': output_path, 'duration_seconds': actual_duration}


def _build_ffmpeg_merge_command(
    video_path: str,
    audio_segments_with_paths: List[dict],
    output_path: str,
    *,
    has_video: bool = True,
    width: int = 1920,
    height: int = 1080,
    duration: float = 0.0,
    fps: float = 30.0,
    stream_duration: float = 0.0,
) -> List[str]:
    """
    QuickTime互換性を最大化したffmpegコマンドを構築。
    - 48kHz/Stereo: 最終連結と同じ形式に統一して再サンプリングを最小化
    - 単一音声: 無音トラックとのamixを避け、微小な音切れ・クリックを抑制
    - 複数音声: anullsrcをベースにして0秒から音声ストリームを維持
    - adelay=ms:all=1: 全チャネルに確実に遅延適用
    - fps固定: VFR→CFR変換でQuickTimeの音ズレを防止
    """
    cmd = ["ffmpeg", "-y", "-fflags", "+genpts"]

    if has_video:
        cmd.extend(["-i", video_path])
        video_input_idx = 0
    else:
        d = duration or 1.0
        cmd.extend(["-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={fps}:d={d}"])
        video_input_idx = 0

    audio_start_idx = 1
    for seg in audio_segments_with_paths:
        cmd.extend(["-i", seg["local_path"]])

    audio_sample_rate = 48000

    # Chrome WebMはdurationを持たないことがあるため、その場合はナレーション終端まで確保する。
    max_audio_end = 0.0
    for seg in audio_segments_with_paths:
        audio_duration = _get_audio_duration_seconds(seg["local_path"])
        max_audio_end = max(max_audio_end, (int(seg["timestamp_ms"]) / 1000.0) + audio_duration)
    silence_dur = duration if duration > 0 else max(max_audio_end, 1.0)
    logger.info(f"音声出力長: {silence_dur:.2f}秒")

    # 音声フィルタ: TTSの端点クリックを抑えるため、ごく短いフェードを入れる。
    filter_parts = []
    num_audios = len(audio_segments_with_paths)
    fade_dur = 0.015
    if num_audios == 1:
        seg = audio_segments_with_paths[0]
        ts_ms = int(seg["timestamp_ms"])
        remaining_seconds = max(0.001, silence_dur - (ts_ms / 1000.0))
        filter_parts.append(
            f"[{audio_start_idx}:a]aresample={audio_sample_rate}:first_pts=0,"
            f"aformat=sample_fmts=fltp:sample_rates={audio_sample_rate}:channel_layouts=stereo,"
            f"atrim=start=0:duration={remaining_seconds:.3f},asetpts=PTS-STARTPTS,"
            f"afade=t=in:st=0:d={fade_dur:.3f},"
            f"afade=t=out:st={max(0.0, remaining_seconds - fade_dur):.3f}:d={fade_dur:.3f},"
            f"adelay={ts_ms}:all=1,"
            f"apad=whole_dur={silence_dur:.3f},atrim=0:{silence_dur:.3f}[aout]"
        )
        logger.info("単一ナレーション音声: amixなしで直接音声トラックを生成")
    else:
        logger.info(f"複数ナレーション音声: {num_audios}本をミックス")
        filter_parts.append(f"anullsrc=r={audio_sample_rate}:cl=stereo:d={silence_dur:.3f}[asilence]")
        for idx, seg in enumerate(audio_segments_with_paths):
            ts_ms = int(seg["timestamp_ms"])
            in_idx = audio_start_idx + idx
            remaining_seconds = max(0.001, silence_dur - (ts_ms / 1000.0))
            filter_parts.append(
                f"[{in_idx}:a]aresample={audio_sample_rate}:first_pts=0,"
                f"aformat=sample_fmts=fltp:sample_rates={audio_sample_rate}:channel_layouts=stereo,"
                f"atrim=start=0:duration={remaining_seconds:.3f},asetpts=PTS-STARTPTS,"
                f"afade=t=in:st=0:d={fade_dur:.3f},"
                f"afade=t=out:st={max(0.0, remaining_seconds - fade_dur):.3f}:d={fade_dur:.3f},"
                f"apad=whole_dur={remaining_seconds:.3f},atrim=0:{remaining_seconds:.3f},"
                f"adelay={ts_ms}:all=1[a{idx}]"
            )
        amix_inputs = "[asilence]" + "".join(f"[a{i}]" for i in range(num_audios))
        filter_parts.append(
            f"{amix_inputs}amix=inputs={num_audios + 1}:duration=first:"
            f"dropout_transition=0:normalize=0[aout]"
        )

    # 4. 映像フィルタ: fps固定（VFR→CFR）とyuv420p
    # stream_duration < duration の場合、最後のフレームを延長（QuickTimeの映像途切れ防止）
    fps_val = int(fps) if abs(fps - round(fps)) < 0.01 else round(fps, 2)
    pad_dur = (
        max(0.0, duration - stream_duration)
        if (duration and stream_duration and stream_duration > 0)
        else 0.0
    )
    if pad_dur > 0.5:
        logger.info(f"映像延長: stream={stream_duration:.2f}s < duration={duration:.2f}s → tpad {pad_dur:.2f}s")
    vf_chain = f"setpts=PTS-STARTPTS,fps={fps_val},format=yuv420p"
    if pad_dur > 0:
        vf_chain += f",tpad=stop_mode=clone:stop_duration={pad_dur:.2f}"
    video_filter = f"[{video_input_idx}:v]{vf_chain}[vout]"
    filter_complex = ";".join(filter_parts) + ";" + video_filter

    gop = max(24, min(60, int(round(fps))))
    cmd.extend([
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level:v", "4.0",
        "-g", str(gop),
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", str(audio_sample_rate),
        "-ac", "2",
        "-movflags", "+faststart",
        "-vsync", "cfr",
        "-avoid_negative_ts", "make_zero",
        "-muxdelay", "0", "-muxpreload", "0",
        "-max_muxing_queue_size", "1024",
    ])

    if has_video and duration and duration > 0:
        cmd.extend(["-t", f"{duration:.3f}"])
        logger.info(f"出力長を映像に合わせて固定: {duration:.2f}秒")

    logger.info("QuickTime互換: 48kHz/Stereo統一, high+4.0, fps固定")
    cmd.append(output_path)
    return cmd
