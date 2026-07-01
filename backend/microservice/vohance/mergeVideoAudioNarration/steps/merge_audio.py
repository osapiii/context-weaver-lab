"""
動画・音声マージステップ

ffmpeg サブプロセスを使用して動画と音声ナレーションをタイムスタンプベースで合成します。
MoviePy は高解像度動画で 8GB 超のメモリを消費するため、ストリーミング処理の ffmpeg に置き換え。
"""

import json
import os
import shutil
import subprocess
from typing import List, Dict, Tuple
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


def _get_has_video_and_size(video_path: str) -> Tuple[bool, int, int, float, float, float, float]:
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
            if rf:
                try:
                    if "/" in str(rf):
                        num, den = rf.split("/")
                        fps = float(num) / float(den)
                    else:
                        fps = float(rf)
                    if fps <= 0:
                        fps = 30.0
                except (TypeError, ValueError, ZeroDivisionError):
                    pass
            if not stream_duration and s.get("nb_frames") and rf:
                try:
                    nf = int(s["nb_frames"])
                    if "/" in str(rf):
                        num, den = rf.split("/")
                        f = float(num) / float(den)
                    else:
                        f = float(rf)
                    if f > 0:
                        stream_duration = nf / f
                except (TypeError, ValueError, ZeroDivisionError, KeyError):
                    pass
            break

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
    return has_video, width, height, duration, start_time, fps, stream_duration


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

    logger.info(f"動画・音声マージ開始（ffmpeg）: {video_path}")
    logger.info(f"音声セグメント数: {len(audio_segments_with_paths)}")
    for idx, seg in enumerate(audio_segments_with_paths):
        _assert_readable_file(seg["local_path"], f"audio segment {idx + 1}")
        logger.info(f"音声 [{idx+1}/{len(audio_segments_with_paths)}]: {seg['local_path']}, タイムスタンプ={seg['timestamp_ms']/1000:.3f}秒")

    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, mode=0o755, exist_ok=True)
        logger.info(f"出力ディレクトリを作成しました: {output_dir}")

    has_video, width, height, duration, _, fps, stream_duration = _get_has_video_and_size(video_path)
    if has_video and duration > 0:
        logger.info(f"入力映像の長さ: {duration:.2f}秒, fps: {fps:.1f}（この長さを出力に維持）")

    if len(audio_segments_with_paths) == 0:
        # 音声なし: 映像のみ出力（元動画の音声は含めない）
        logger.info("音声セグメントなし。映像のみ出力します")
        if has_video:
            # setptsでPTS正規化、yuv420pでQuickTime互換（-pix_fmt が最重要）
            # -g: キーフレーム間隔（QuickTimeは長いGOPで4秒以降黒化することがある）
            gop = max(24, min(60, int(round(fps))))  # 約1秒間隔（QuickTimeは長GOPで黒化する）
            cmd = [
                "ffmpeg", "-y", "-fflags", "+genpts",
                "-i", video_path,
                "-an", "-vf", "setpts=PTS-STARTPTS,format=yuv420p",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                "-pix_fmt", "yuv420p", "-profile:v", "main", "-g", str(gop),
                "-vsync", "cfr",
                "-movflags", "+faststart",
                "-avoid_negative_ts", "make_zero",
                "-muxdelay", "0", "-muxpreload", "0",
                output_path,
            ]
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
    return {'output_path': output_path}


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
    - anullsrc: 0秒からの音声Gapを防ぎ、QuickTimeの同期ズレを防止
    - aformat: mix前にサンプルレート・チャネルを統一（44.1kHz/Stereo）
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

    # 1. 無音ベース: 動画長の無音をamixの最初に入れ、0秒から音声ストリームが存在するようにする
    silence_dur = duration if duration > 0 else 1.0
    filter_parts = [f"anullsrc=r=44100:cl=stereo:d={silence_dur}[asilence]"]

    # 2. 各音声セグメント: aformatで統一 → adelay:all=1 で全チャネルに遅延適用
    for idx, seg in enumerate(audio_segments_with_paths):
        ts_ms = int(seg["timestamp_ms"])
        in_idx = audio_start_idx + idx
        filter_parts.append(
            f"[{in_idx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,"
            f"asetpts=PTS-STARTPTS,adelay={ts_ms}:all=1[a{idx}]"
        )

    # 3. ミキシング: 無音ベース + 全セグメント、duration=firstで無音長に合わせる
    num_audios = len(audio_segments_with_paths)
    amix_inputs = "[asilence]" + "".join(f"[a{i}]" for i in range(num_audios))
    filter_parts.append(
        f"{amix_inputs}amix=inputs={num_audios + 1}:duration=first:"
        f"dropout_transition=0:normalize=0,aresample=async=1:first_pts=0[aout]"
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
        "-ar", "44100",
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

    logger.info("QuickTime互換: anullsrcベース, aformat統一, high+4.0, fps固定")
    cmd.append(output_path)
    return cmd
