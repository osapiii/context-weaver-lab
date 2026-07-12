"""
Step 2: 動画連結処理

ダウンロードした各セクション動画を連結して1つの動画を生成します。
FFmpeg concat filterを使用し、MoviePyの音声ループバグを回避します。
複数セクションの中間ファイルはMOV + PCMにして、AACのencoder delay/paddingを
セクション境界ごとに累積させないようにします。
メタデータ取得はffprobeを使用（MoviePyのvideo_fps KeyErrorを回避）。
"""

import json
import os
import shutil
import subprocess
import time
from typing import Dict, Any, List, Optional
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import firestore_client


def _parse_fps(r_frame_rate: Optional[str]) -> float:
    """ffprobeのr_frame_rate（例: 30000/1001）をfloatに変換"""
    if not r_frame_rate:
        return 30.0
    try:
        parts = r_frame_rate.split("/")
        if len(parts) == 2:
            return float(parts[0]) / float(parts[1])
        return float(parts[0])
    except (ValueError, ZeroDivisionError):
        return 30.0


def _get_video_metadata_ffprobe(video_path: str) -> Dict[str, Any]:
    """
    ffprobeで動画メタデータを取得。
    MoviePyのVideoFileClipはvideo_fps KeyErrorを起こす動画があるため使用しない。
    """
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-show_format",
        "-show_streams",
        "-print_format", "json",
        video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    data = json.loads(result.stdout)

    # 動画ストリームを探す
    video_stream = None
    audio_stream = None
    for s in data.get("streams", []):
        if s.get("codec_type") == "video":
            video_stream = s
        elif s.get("codec_type") == "audio":
            audio_stream = s

    duration = 0.0
    fps = 30.0
    width = 1920
    height = 1080

    if video_stream:
        # durationはformatまたはstreamのどちらかにある
        duration = float(
            video_stream.get("duration")
            or data.get("format", {}).get("duration", 0)
            or 0
        )
        fps = _parse_fps(video_stream.get("r_frame_rate"))
        width = int(video_stream.get("width", 1920))
        height = int(video_stream.get("height", 1080))
    elif data.get("format"):
        duration = float(data["format"].get("duration", 0) or 0)

    return {
        "duration": duration,
        "fps": fps,
        "size": (width, height),
        "width": width,
        "height": height,
        "has_audio": audio_stream is not None,
        "has_video": video_stream is not None,
    }


def _get_audio_max_volume_db(video_path: str) -> Optional[float]:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i",
        video_path,
        "-map",
        "0:a:0",
        "-af",
        "volumedetect",
        "-f",
        "null",
        "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        logger.warning(f"音声音量検査に失敗しました: {result.stderr[-1200:]}")
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


def _assert_audible_output(video_path: str, *, required: bool) -> None:
    if not required:
        return
    metadata = _get_video_metadata_ffprobe(video_path)
    if not metadata["has_audio"]:
        raise RuntimeError("concatenated output has no audio stream")
    max_volume = _get_audio_max_volume_db(video_path)
    if max_volume is None:
        logger.warning("音声音量検査をスキップしました: max_volumeが取得できません")
        return
    logger.info(f"連結出力音声 max_volume: {max_volume:.2f} dB")
    if max_volume == float("-inf") or max_volume < -60:
        raise RuntimeError(f"concatenated output audio is silent or too quiet: max_volume={max_volume} dB")


def _assert_duration_close(video_path: str, expected_duration: float, label: str) -> float:
    actual_duration = _get_video_metadata_ffprobe(video_path)["duration"]
    if expected_duration <= 0:
        return actual_duration
    tolerance = max(0.35, min(1.0, expected_duration * 0.03))
    logger.info(
        f"{label} duration検査: actual={actual_duration:.3f}s expected={expected_duration:.3f}s tolerance={tolerance:.3f}s"
    )
    if actual_duration <= 0:
        raise RuntimeError(f"{label} duration could not be determined")
    if abs(actual_duration - expected_duration) > tolerance:
        raise RuntimeError(
            f"{label} duration mismatch: actual={actual_duration:.3f}s expected={expected_duration:.3f}s"
        )
    return actual_duration


def _video_duration_filter(
    fps_text: str,
    target_duration: float,
    *,
    trim_start_seconds: float = 0.0,
) -> str:
    """入力映像が短い場合は末尾フレームで埋め、長い場合は期待秒数で切る。"""
    trim_prefix = (
        f"trim=start={trim_start_seconds:.3f},setpts=PTS-STARTPTS,"
        if trim_start_seconds > 0
        else "setpts=PTS-STARTPTS,"
    )
    return (
        trim_prefix +
        f"fps={fps_text},"
        f"tpad=stop_mode=clone:stop_duration={target_duration:.3f},"
        f"trim=duration={target_duration:.3f},"
        "setpts=PTS-STARTPTS,"
        "setsar=1,"
        "format=yuv420p"
    )


def _audio_duration_filter(target_duration: float) -> str:
    """入力音声が短い場合は無音で埋め、長い場合は期待秒数で切る。"""
    return (
        "asetpts=PTS-STARTPTS,"
        f"atrim=0:{target_duration:.3f},"
        f"apad=pad_dur={target_duration:.3f},"
        f"atrim=0:{target_duration:.3f},"
        "aresample=48000:first_pts=0"
    )


def _audio_encode_args_for_output(output_path: str) -> List[str]:
    """連結前の中間ファイルでは非圧縮PCM、最終MP4ではAACを使う。"""
    ext = os.path.splitext(output_path)[1].lower()
    if ext in {".mov", ".mkv"}:
        return ["-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2"]
    return ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]


def _normalize_for_concat(
    input_path: str,
    output_path: str,
    has_audio: bool,
    has_video: bool = True,
    duration: float = 0.0,
    width: int = 1920,
    height: int = 1080,
    fps: float = 30.0,
) -> None:
    """
    連結用に動画を標準形式へ正規化する。
    入力ファイルのPTS/durationメタデータは信用せず、セクション定義のdurationを優先して
    映像・音声を同じ長さへ再構成する。

    Args:
        input_path: 入力動画パス
        output_path: 出力動画パス
        has_audio: 入力に音声があるか
        has_video: 入力に映像があるか（Falseの場合はlavfiで黒映像を生成）
        duration: 音声のみの場合の再生時間（秒）
        width: 映像サイズ幅
        height: 映像サイズ高さ
        fps: フレームレート（lavfi用）
    """
    target_duration = duration if duration and duration > 0 else 1.0
    fps_value = 30.0
    if fps and fps > 0:
        fps_value = min(max(float(fps), 1.0), 60.0)
    fps_text = str(int(round(fps_value))) if abs(fps_value - round(fps_value)) < 0.01 else f"{fps_value:.2f}"
    gop = max(24, min(60, int(round(fps_value))))
    audio_encode_args = _audio_encode_args_for_output(output_path)
    video_filter = _video_duration_filter(fps_text, target_duration)
    audio_filter = _audio_duration_filter(target_duration)

    if not has_video:
        # 音声のみ: lavfiのcolorで黒映像を生成し、音声と結合
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={fps_text}:d={target_duration:.3f}",
            "-i", input_path,
            "-map", "0:v:0", "-map", "1:a:0",
            "-vf", video_filter,
            "-af", audio_filter,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.0", "-g", str(gop),
            *audio_encode_args,
            "-t", f"{target_duration:.3f}",
            "-movflags", "+faststart", "-avoid_negative_ts", "make_zero",
            output_path,
        ]
    elif has_audio:
        # 音声あり: PTSをリセットして、映像・音声を期待秒数で切る。
        cmd = [
            "ffmpeg", "-y", "-fflags", "+genpts", "-i", input_path,
            "-map", "0:v:0", "-map", "0:a:0",
            "-vf", video_filter,
            "-af", audio_filter,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.0", "-g", str(gop),
            *audio_encode_args,
            "-t", f"{target_duration:.3f}",
            "-movflags", "+faststart", "-avoid_negative_ts", "make_zero",
            output_path,
        ]
    else:
        # 音声なし: 無音トラックを付与し、期待秒数で切る。
        cmd = [
            "ffmpeg", "-y", "-fflags", "+genpts", "-i", input_path,
            "-f", "lavfi", "-i", f"anullsrc=channel_layout=stereo:sample_rate=48000:d={target_duration:.3f}",
            "-map", "0:v:0", "-map", "1:a:0",
            "-vf", video_filter,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.0", "-g", str(gop),
            *audio_encode_args,
            "-t", f"{target_duration:.3f}",
            "-movflags", "+faststart", "-avoid_negative_ts", "make_zero",
            output_path,
        ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        logger.error(f"正規化エラー: {result.stderr}")
        raise RuntimeError(f"動画正規化失敗: {result.stderr}")
    _assert_duration_close(output_path, target_duration, "normalized section")


def _normalize_video_only_for_timeline(
    input_path: str,
    output_path: str,
    *,
    has_video: bool = True,
    duration: float = 0.0,
    trim_start_seconds: float = 0.0,
    width: int = 1920,
    height: int = 1080,
    fps: float = 30.0,
) -> None:
    """映像タイムライン用に音声なしMOVへ正規化する。"""
    target_duration = duration if duration and duration > 0 else 1.0
    fps_value = 30.0
    if fps and fps > 0:
        fps_value = min(max(float(fps), 1.0), 60.0)
    fps_text = str(int(round(fps_value))) if abs(fps_value - round(fps_value)) < 0.01 else f"{fps_value:.2f}"
    gop = max(24, min(60, int(round(fps_value))))
    video_filter = _video_duration_filter(
        fps_text,
        target_duration,
        trim_start_seconds=trim_start_seconds,
    )

    if has_video:
        cmd = [
            "ffmpeg", "-y", "-fflags", "+genpts", "-i", input_path,
        ]
        cmd.extend([
            "-map", "0:v:0",
            "-vf", video_filter,
            "-an",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.0", "-g", str(gop),
            "-t", f"{target_duration:.3f}",
            "-movflags", "+faststart", "-avoid_negative_ts", "make_zero",
            output_path,
        ])
    else:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={fps_text}:d={target_duration:.3f}",
            "-map", "0:v:0",
            "-vf", video_filter,
            "-an",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.0", "-g", str(gop),
            "-t", f"{target_duration:.3f}",
            "-movflags", "+faststart", "-avoid_negative_ts", "make_zero",
            output_path,
        ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        logger.error(f"映像正規化エラー: {result.stderr}")
        raise RuntimeError(f"映像正規化失敗: {result.stderr}")
    _assert_duration_close(output_path, target_duration, "normalized video section")


def _section_source_key(section_item: Dict[str, Any]) -> str:
    """同じ元動画から切り出すセクションか判定するための安定キーを返す。"""
    bucket_name = str(section_item.get("bucketName") or "")
    file_path = str(section_item.get("filePath") or "")
    if bucket_name or file_path:
        return f"{bucket_name}/{file_path}"
    return str(section_item.get("localPath") or "")


def _section_trim_start_seconds(
    section_item: Dict[str, Any],
    source_duration: float,
    expected_duration: float,
    *,
    same_source_reused: bool = False,
) -> float:
    """同じ元動画が渡された場合に、セクション開始時刻から切り出す。"""
    if expected_duration <= 0:
        return 0.0
    try:
        section_start = float(section_item.get("sectionStartSeconds") or 0)
    except (TypeError, ValueError):
        section_start = 0.0
    try:
        section_end = float(section_item.get("sectionEndSeconds") or 0)
    except (TypeError, ValueError):
        section_end = 0.0

    # 入力動画がすでにセクション長へ切り出されている場合は再トリムしない。
    # 元動画が渡っている場合だけ、開始時刻から expectedDurationSeconds 分を切り出す。
    has_valid_range = section_start >= 0 and section_end > section_start
    if not has_valid_range:
        return 0.0

    # screen recording由来のwebmではffprobe durationが0になることがある。
    # 同じStorage上の元動画が複数セクションで使われている場合は、保存済みタイムスタンプを正として切り出す。
    if same_source_reused:
        return section_start

    if source_duration <= 0:
        return 0.0

    is_long_source = source_duration > expected_duration + max(1.0, expected_duration * 0.2)
    if is_long_source:
        return section_start
    return 0.0


def _build_section_audio_bed(
    audio_segments: List[Dict[str, Any]],
    output_path: str,
    *,
    duration: float,
) -> None:
    """セクション内のAI音声をタイムスタンプ通りに配置したPCM WAVを作る。"""
    target_duration = duration if duration and duration > 0 else 1.0
    sample_rate = 48000
    if not audio_segments:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"anullsrc=channel_layout=stereo:sample_rate={sample_rate}:d={target_duration:.3f}",
            "-map", "0:a:0",
            "-c:a", "pcm_s16le", "-ar", str(sample_rate), "-ac", "2",
            "-t", f"{target_duration:.3f}",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            logger.error(f"無音ベッド生成エラー: {result.stderr}")
            raise RuntimeError(f"無音ベッド生成失敗: {result.stderr}")
        return

    cmd = ["ffmpeg", "-y"]
    for segment in audio_segments:
        cmd.extend(["-i", segment["localPath"]])

    filter_parts: List[str] = [
        f"anullsrc=r={sample_rate}:cl=stereo:d={target_duration:.3f}[abase]"
    ]
    mix_inputs = ["[abase]"]
    for index, segment in enumerate(audio_segments):
        try:
            timestamp_ms = int(segment.get("timestampMs") or segment.get("timestamp_ms") or 0)
        except (TypeError, ValueError):
            timestamp_ms = 0
        start_seconds = max(0.0, timestamp_ms / 1000.0)
        remaining_seconds = max(0.001, target_duration - start_seconds)
        filter_parts.append(
            f"[{index}:a]aresample={sample_rate}:first_pts=0,"
            f"aformat=sample_fmts=fltp:sample_rates={sample_rate}:channel_layouts=stereo,"
            f"atrim=start=0:duration={remaining_seconds:.3f},asetpts=PTS-STARTPTS,"
            f"adelay={timestamp_ms}:all=1,"
            f"apad=whole_dur={target_duration:.3f},atrim=0:{target_duration:.3f}[a{index}]"
        )
        mix_inputs.append(f"[a{index}]")

    filter_parts.append(
        f"{''.join(mix_inputs)}amix=inputs={len(mix_inputs)}:duration=first:dropout_transition=0:normalize=0,"
        f"aresample={sample_rate}:first_pts=0,"
        f"aformat=sample_fmts=s16:sample_rates={sample_rate}:channel_layouts=stereo[aout]"
    )

    cmd.extend([
        "-filter_complex", ";".join(filter_parts),
        "-map", "[aout]",
        "-c:a", "pcm_s16le",
        "-ar", str(sample_rate),
        "-ac", "2",
        "-t", f"{target_duration:.3f}",
        output_path,
    ])
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        logger.error(f"音声ベッド生成エラー: {result.stderr}")
        raise RuntimeError(f"音声ベッド生成失敗: {result.stderr}")
    _assert_duration_close(output_path, target_duration, "section audio bed")


def _concatenate_timeline_with_ffmpeg(
    video_paths: List[str],
    audio_paths: List[str],
    output_path: str,
) -> None:
    """
    映像タイムラインと音声タイムラインをペアでconcatし、最後に1回だけMP4へmuxする。
    """
    if not video_paths or len(video_paths) != len(audio_paths):
        raise ValueError("映像と音声のセクション数が一致しません")

    cmd = ["ffmpeg", "-y", "-fflags", "+genpts"]
    for video_path, audio_path in zip(video_paths, audio_paths):
        cmd.extend(["-i", video_path, "-i", audio_path])

    filter_parts: List[str] = []
    concat_inputs: List[str] = []
    for index in range(len(video_paths)):
        video_input = index * 2
        audio_input = video_input + 1
        filter_parts.append(f"[{video_input}:v:0]setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v{index}]")
        filter_parts.append(
            f"[{audio_input}:a:0]asetpts=PTS-STARTPTS,aresample=48000:first_pts=0,"
            f"aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo[a{index}]"
        )
        concat_inputs.append(f"[v{index}][a{index}]")
    filter_parts.append(
        f"{''.join(concat_inputs)}concat=n={len(video_paths)}:v=1:a=1[vout][aout]"
    )

    cmd.extend([
        "-filter_complex", ";".join(filter_parts),
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level:v", "4.0",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        "-avoid_negative_ts", "make_zero",
        output_path,
    ])

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    if result.returncode != 0:
        logger.error(f"タイムラインconcatエラー: {result.stderr}")
        raise RuntimeError(f"タイムラインconcat失敗: {result.stderr}")


def _concatenate_with_ffmpeg(
    downloaded_paths: List[str],
    output_path: str,
    temp_dir: str,
) -> None:
    """
    FFmpeg filter_complex concatで動画を連結する。
    copy連結で残るPTS/duration不整合を避け、映像と音声を再構成する。
    全入力は事前に映像+音声の同一構成にそろえておくこと。

    Args:
        downloaded_paths: 連結する動画ファイルのパスリスト（いずれも映像+音声あり）
        output_path: 出力ファイルパス
        temp_dir: 一時ディレクトリ（concat listファイル用）
    """
    if not downloaded_paths:
        raise ValueError("連結対象がありません")

    logger.info(f"FFmpeg filter_complex concatで連結開始: {len(downloaded_paths)}個の動画")

    cmd = ["ffmpeg", "-y", "-fflags", "+genpts"]
    for path in downloaded_paths:
        cmd.extend(["-i", path])

    filter_parts: List[str] = []
    concat_inputs: List[str] = []
    for index in range(len(downloaded_paths)):
        filter_parts.append(f"[{index}:v:0]setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v{index}]")
        filter_parts.append(
            f"[{index}:a:0]asetpts=PTS-STARTPTS,aresample=48000:first_pts=0,"
            f"aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo[a{index}]"
        )
        concat_inputs.append(f"[v{index}][a{index}]")
    filter_parts.append(
        f"{''.join(concat_inputs)}concat=n={len(downloaded_paths)}:v=1:a=1[vout][aout]"
    )

    cmd.extend([
        "-filter_complex", ";".join(filter_parts),
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level:v", "4.0",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        "-avoid_negative_ts", "make_zero",
        output_path,
    ])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600,  # 10分タイムアウト
    )

    if result.returncode != 0:
        logger.error(f"FFmpeg concat エラー: {result.stderr}")
        raise RuntimeError(f"FFmpeg concat 失敗: {result.stderr}")

    logger.success("FFmpeg concat 連結完了")


def _apply_expected_total_duration_to_last_clip(
    clips_info: List[Dict[str, Any]],
    expected_total_duration: float,
    current_total_duration: float,
) -> float:
    """セクション境界の丸めで生じた総尺差分を最後のセクションに吸収する。"""
    if not clips_info or expected_total_duration <= 0 or current_total_duration <= 0:
        return current_total_duration

    duration_delta = expected_total_duration - current_total_duration
    if abs(duration_delta) <= 0.02:
        return current_total_duration

    max_adjustment = max(1.0, expected_total_duration * 0.05)
    if abs(duration_delta) > max_adjustment:
        logger.warning(
            "期待総尺との差分が大きいためセクション長補正をスキップ: "
            f"expected={expected_total_duration:.3f}s current={current_total_duration:.3f}s "
            f"delta={duration_delta:.3f}s max_adjustment={max_adjustment:.3f}s"
        )
        return current_total_duration

    last_clip = clips_info[-1]
    current_last_duration = float(last_clip.get("duration") or 0)
    adjusted_last_duration = max(0.1, current_last_duration + duration_delta)
    actual_delta = adjusted_last_duration - current_last_duration
    last_clip["duration"] = adjusted_last_duration
    logger.info(
        "期待総尺に合わせて最終セクション長を補正: "
        f"expected_total={expected_total_duration:.3f}s current_total={current_total_duration:.3f}s "
        f"delta={duration_delta:.3f}s applied={actual_delta:.3f}s "
        f"last_section={current_last_duration:.3f}s->{adjusted_last_duration:.3f}s"
    )
    return current_total_duration + actual_delta


def execute(ctx: RequestContext, downloaded_sections: list) -> Dict[str, Any]:
    """
    Step 2: 動画を連結

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        downloaded_sections: List[Dict[str, Any]] - ダウンロードした動画ファイルとセクションメタ情報
    }

    returns: Dict[str, Any] - 連結動画の情報
    """
    logger.start_operation("Step 2: 動画連結処理")

    operation_start_time = time.time()

    # Firestoreに進捗を記録（開始）
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"動画を連結中 ({len(downloaded_sections)}個のセクション)",
            current_step="concatenating"
        )

    if not downloaded_sections:
        raise ValueError("連結する動画がありません")

    input_data = ctx.get_param('input', {})
    expected_total_duration = 0.0
    try:
        expected_total_duration = float(input_data.get("expectedTotalDurationSeconds") or 0)
    except (TypeError, ValueError):
        expected_total_duration = 0.0

    if len(downloaded_sections) == 1:
        # 1つの動画のみの場合はそのまま返す
        logger.info("セクションが1つのみのため、正規化のみ実行")
        single_section = downloaded_sections[0]
        single_path = single_section["localPath"]
        probed_info = _get_video_metadata_ffprobe(single_path)
        expected_duration = float(
            expected_total_duration
            or single_section.get("expectedDurationSeconds")
            or probed_info["duration"]
            or 1.0
        )
        trim_start_seconds = _section_trim_start_seconds(single_section, probed_info["duration"], expected_duration)

        # 出力ファイルパスを生成
        output_filename = "concatenated_video.mp4"
        output_path = os.path.join(ctx.temp_dir, output_filename)

        audio_segments = single_section.get("audioSegments") or []
        if audio_segments:
            video_only_path = os.path.join(ctx.temp_dir, "single_video_only.mov")
            audio_bed_path = os.path.join(ctx.temp_dir, "single_audio_bed.wav")
            _normalize_video_only_for_timeline(
                single_path,
                video_only_path,
                has_video=probed_info["has_video"],
                duration=expected_duration,
                trim_start_seconds=trim_start_seconds,
                width=probed_info["width"],
                height=probed_info["height"],
                fps=probed_info["fps"],
            )
            _build_section_audio_bed(audio_segments, audio_bed_path, duration=expected_duration)
            _concatenate_timeline_with_ffmpeg([video_only_path], [audio_bed_path], output_path)
        else:
            _normalize_for_concat(
                single_path,
                output_path,
                probed_info["has_audio"],
                has_video=probed_info["has_video"],
                duration=expected_duration,
                width=probed_info["width"],
                height=probed_info["height"],
                fps=probed_info["fps"],
            )
        _assert_audible_output(output_path, required=bool(audio_segments) or probed_info["has_audio"])
        output_info = _get_video_metadata_ffprobe(output_path)

        return {
            "output_path": output_path,
            "duration": output_info["duration"],
            "fps": output_info["fps"],
            "width": output_info["width"],
            "height": output_info["height"],
            "has_audio": output_info["has_audio"],
            "size_bytes": os.path.getsize(output_path) if os.path.exists(output_path) else 0,
        }

    # 各セクション動画の情報を取得
    clips_info = []
    total_duration = 0.0
    source_key_counts: Dict[str, int] = {}
    for section_item in downloaded_sections:
        source_key = _section_source_key(section_item)
        source_key_counts[source_key] = source_key_counts.get(source_key, 0) + 1

    logger.info(f"セクション動画の情報を取得中... ({len(downloaded_sections)}個)")

    for i, section_item in enumerate(downloaded_sections):
        video_path = section_item["localPath"]
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"セクション動画が見つかりません: {video_path}")

        # Firestoreに進捗を記録
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"セクション{i + 1}/{len(downloaded_sections)}の情報を取得中",
                current_step="concatenating",
                progress={
                    "processed": i,
                    "total": len(downloaded_sections)
                }
            )

        meta = _get_video_metadata_ffprobe(video_path)
        try:
            expected_duration = float(section_item.get("expectedDurationSeconds") or 0)
        except (TypeError, ValueError):
            expected_duration = 0.0
        duration_for_concat = expected_duration if expected_duration > 0 else meta["duration"]
        source_key = _section_source_key(section_item)
        same_source_reused = source_key_counts.get(source_key, 0) > 1
        trim_start_seconds = _section_trim_start_seconds(
            section_item,
            meta["duration"],
            duration_for_concat,
            same_source_reused=same_source_reused,
        )
        clip_info = {
            "path": video_path,
            "source_key": source_key,
            "duration": duration_for_concat,
            "probed_duration": meta["duration"],
            "trim_start_seconds": trim_start_seconds,
            "same_source_reused": same_source_reused,
            "section_id": section_item.get("sectionId"),
            "section_index": section_item.get("sectionIndex", i),
            "fps": meta["fps"],
            "size": meta["size"],
            "width": meta["width"],
            "height": meta["height"],
            "has_audio": meta["has_audio"],
            "has_video": meta["has_video"],
            "audio_segments": section_item.get("audioSegments") or [],
        }
        clips_info.append(clip_info)
        total_duration += duration_for_concat

        logger.info(
            f"セクション{i + 1}: expected={duration_for_concat:.2f}秒, probed={meta['duration']:.2f}秒, "
            f"trim_start={trim_start_seconds:.2f}秒, source_reused={same_source_reused}, "
            f"{meta['width']}x{meta['height']}, FPS={meta['fps']}"
        )

    total_duration = _apply_expected_total_duration_to_last_clip(
        clips_info,
        expected_total_duration,
        total_duration,
    )

    # 動画情報をログに記録
    logger.data_analysis("セクション動画情報", {
        "total_sections": len(clips_info),
        "total_duration": round(total_duration, 2),
        "sections": clips_info
    })

    # Firestoreに動画情報を記録
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"動画情報取得完了: 合計 {round(total_duration, 2)}秒, {len(clips_info)}個のセクション",
            current_step="concatenating"
        )

    uses_explicit_audio_timeline = any(c["audio_segments"] for c in clips_info)
    paths_for_concat: List[str] = []
    audio_paths_for_concat: List[str] = []
    if uses_explicit_audio_timeline:
        logger.info("AI音声セグメントを使用し、映像タイムラインと音声タイムラインを分離して生成します")
        for i, clip_info in enumerate(clips_info):
            normalized_video_path = os.path.join(ctx.temp_dir, f"timeline_video_{i}.mov")
            audio_bed_path = os.path.join(ctx.temp_dir, f"timeline_audio_{i}.wav")
            logger.info(
                f"セクション{i + 1}: 映像/音声タイムラインを生成中 "
                f"(duration={clip_info['duration']:.3f}s, AI音声={len(clip_info['audio_segments'])}件)"
            )
            _normalize_video_only_for_timeline(
                clip_info["path"],
                normalized_video_path,
                has_video=clip_info["has_video"],
                duration=clip_info["duration"],
                trim_start_seconds=clip_info["trim_start_seconds"],
                width=clip_info["width"],
                height=clip_info["height"],
                fps=clip_info["fps"],
            )
            _build_section_audio_bed(
                clip_info["audio_segments"],
                audio_bed_path,
                duration=clip_info["duration"],
            )
            paths_for_concat.append(normalized_video_path)
            audio_paths_for_concat.append(audio_bed_path)
    else:
        # 全セクションを標準形式・期待秒数に正規化してから連結。
        # 複数セクションでは中間音声をPCMにして、AACの境界paddingを最終出力まで持ち込まない。
        for i, clip_info in enumerate(clips_info):
            normalized_path = os.path.join(ctx.temp_dir, f"normalized_{i}.mov")
            logger.info(
                f"セクション{i + 1}: 標準形式に正規化中 "
                f"(duration={clip_info['duration']:.3f}s, 音声={'あり' if clip_info['has_audio'] else 'なし'})"
            )
            _normalize_for_concat(
                clip_info["path"],
                normalized_path,
                clip_info["has_audio"],
                has_video=clip_info["has_video"],
                duration=clip_info["duration"],
                width=clip_info["width"],
                height=clip_info["height"],
                fps=clip_info["fps"],
            )
            paths_for_concat.append(normalized_path)

    # 動画を連結（FFmpeg concat filter使用 - MoviePy音声ループバグ回避）
    logger.info("動画を連結中...")

    # Firestoreに連結開始を記録
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message="動画連結処理を開始",
            current_step="concatenating"
        )

    output_filename = "concatenated_video.mp4"
    output_path = os.path.join(ctx.temp_dir, output_filename)

    if uses_explicit_audio_timeline:
        _concatenate_timeline_with_ffmpeg(paths_for_concat, audio_paths_for_concat, output_path)
    else:
        _concatenate_with_ffmpeg(paths_for_concat, output_path, ctx.temp_dir)
    has_audio = any(c["has_audio"] for c in clips_info) or uses_explicit_audio_timeline
    _assert_audible_output(output_path, required=has_audio)
    final_expected_duration = expected_total_duration if expected_total_duration > 0 else total_duration
    actual_output_duration = _assert_duration_close(output_path, final_expected_duration, "concatenated output")

    # ファイルサイズを取得
    output_size_bytes = os.path.getsize(output_path) if os.path.exists(output_path) else 0
    output_size_mb = output_size_bytes / (1024 * 1024)

    logger.success(f"動画連結完了: {output_size_mb:.2f} MB")

    # Firestoreに連結完了を記録
    if ctx.collection_name and ctx.document_id:
        firestore_client.log_processing_status(
            ctx,
            status="processing",
            message=f"動画連結完了 ({output_size_mb:.2f} MB)",
            current_step="concatenating"
        )

    operation_time = time.time() - operation_start_time
    logger.complete_operation("Step 2: 動画連結処理", operation_time)

    return {
        "output_path": output_path,
        "duration": actual_output_duration,
        "fps": clips_info[0]["fps"] if clips_info else 30,
        "width": clips_info[0]["width"] if clips_info else 1920,
        "height": clips_info[0]["height"] if clips_info else 1080,
        "has_audio": has_audio,
        "size_bytes": output_size_bytes
    }
