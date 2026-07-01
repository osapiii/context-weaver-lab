"""
Step 2: 動画連結処理

ダウンロードした各セクション動画を連結して1つの動画を生成します。
FFmpeg concat demuxerを使用し、MoviePyの音声ループバグを回避します。
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
    連結用に動画を標準形式に正規化する。
    concat demuxerは全入力のコーデック・パラメータが完全に同一である必要がある。
    各セクションはmergeVideoAudioNarration由来。mergeはCANONICAL_FPS(30)で統一して
    出力するため、映像は-c:v copyで高速連結可能。音声のみサンプルレート統一で再エンコード。

    出力形式: 映像 copy, 音声 stereo 48kHz AAC 192k

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
    if not has_video:
        # 音声のみ: lavfiのcolorで黒映像を生成し、音声と結合
        d = duration or 1.0  # 0の場合は1秒
        r = int(fps) if abs(fps - round(fps)) < 0.01 else round(fps, 2)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={r}:d={d}",
            "-i", input_path,
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-avoid_negative_ts", "make_zero",
            output_path,
        ]
    elif has_audio:
        # 音声あり: 映像はcopy（mergeがCANONICAL_FPSで統一済み）、音声のみ標準形式に再エンコード
        cmd = [
            "ffmpeg", "-y", "-fflags", "+genpts", "-i", input_path,
            "-c:v", "copy",
            "-ac", "2", "-ar", "48000", "-c:a", "aac", "-b:a", "192k",
            "-map", "0:v", "-map", "0:a",
            "-avoid_negative_ts", "make_zero",
            output_path,
        ]
    else:
        # 音声なし: 無音トラックを付与、映像はcopy
        cmd = [
            "ffmpeg", "-y", "-fflags", "+genpts", "-i", input_path,
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-map", "0:v", "-map", "1:a",
            "-avoid_negative_ts", "make_zero",
            output_path,
        ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        logger.error(f"正規化エラー: {result.stderr}")
        raise RuntimeError(f"動画正規化失敗: {result.stderr}")


def _concatenate_with_ffmpeg(
    downloaded_paths: List[str],
    output_path: str,
    temp_dir: str,
) -> None:
    """
    FFmpeg concat demuxerで動画を連結する。
    MoviePyのconcatenate_videoclipsで発生する音声ループバグを回避する。
    全入力は事前に映像+音声の同一構成にそろえておくこと。

    Args:
        downloaded_paths: 連結する動画ファイルのパスリスト（いずれも映像+音声あり）
        output_path: 出力ファイルパス
        temp_dir: 一時ディレクトリ（concat listファイル用）
    """
    # concat listファイルを作成（FFmpeg concat demuxer形式）
    concat_list_path = os.path.join(temp_dir, "concat_list.txt")
    with open(concat_list_path, "w", encoding="utf-8") as f:
        for path in downloaded_paths:
            # 絶対パスに正規化し、シングルクォートをエスケープ
            abs_path = os.path.abspath(path)
            escaped_path = abs_path.replace("'", "'\\''")
            f.write(f"file '{escaped_path}'\n")

    logger.info(f"FFmpeg concat demuxerで連結開始: {len(downloaded_paths)}個の動画")

    # 全入力は正規化済みで同一形式のため -c copy で高速連結（PTS正規化で先頭黒化を防止）
    cmd = [
        "ffmpeg",
        "-y",  # 出力ファイルを上書き
        "-fflags", "+genpts",
        "-f", "concat",
        "-safe", "0",  # 絶対パスを許可
        "-i", concat_list_path,
        "-map", "0:v",
        "-map", "0:a",
        "-c", "copy",  # 正規化済みのため再エンコード不要
        "-avoid_negative_ts", "make_zero",
        output_path,
    ]

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


def execute(ctx: RequestContext, downloaded_paths: list) -> Dict[str, Any]:
    """
    Step 2: 動画を連結

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        downloaded_paths: List[str] - ダウンロードした動画ファイルのパスのリスト
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
            message=f"動画を連結中 ({len(downloaded_paths)}個のセクション)",
            current_step="concatenating"
        )

    if not downloaded_paths:
        raise ValueError("連結する動画がありません")

    if len(downloaded_paths) == 1:
        # 1つの動画のみの場合はそのまま返す
        logger.info("セクションが1つのみのため、連結処理をスキップ")
        single_path = downloaded_paths[0]
        video_info = _get_video_metadata_ffprobe(single_path)

        # 出力ファイルパスを生成
        output_filename = "concatenated_video.mp4"
        output_path = os.path.join(ctx.temp_dir, output_filename)

        # ファイルをコピー
        shutil.copy2(single_path, output_path)

        return {
            "output_path": output_path,
            "duration": video_info["duration"],
            "fps": video_info["fps"],
            "width": video_info["width"],
            "height": video_info["height"],
            "has_audio": video_info["has_audio"],
            "size_bytes": os.path.getsize(output_path) if os.path.exists(output_path) else 0,
        }

    # 各セクション動画の情報を取得
    clips_info = []
    total_duration = 0.0

    logger.info(f"セクション動画の情報を取得中... ({len(downloaded_paths)}個)")

    for i, video_path in enumerate(downloaded_paths):
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"セクション動画が見つかりません: {video_path}")

        # Firestoreに進捗を記録
        if ctx.collection_name and ctx.document_id:
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"セクション{i + 1}/{len(downloaded_paths)}の情報を取得中",
                current_step="concatenating",
                progress={
                    "processed": i,
                    "total": len(downloaded_paths)
                }
            )

        meta = _get_video_metadata_ffprobe(video_path)
        clip_info = {
            "path": video_path,
            "duration": meta["duration"],
            "fps": meta["fps"],
            "size": meta["size"],
            "width": meta["width"],
            "height": meta["height"],
            "has_audio": meta["has_audio"],
            "has_video": meta["has_video"],
        }
        clips_info.append(clip_info)
        total_duration += meta["duration"]

        logger.info(f"セクション{i + 1}: {meta['duration']:.2f}秒, {meta['width']}x{meta['height']}, FPS={meta['fps']}")

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

    # 全セクションを標準形式に正規化してから連結
    # mergeVideoAudioNarrationはCANONICAL_FPS(30)で統一出力するため、映像はcopyで高速連結可能。
    # 音声のみサンプルレート・チャンネルを48kHz/stereoに統一。
    paths_for_concat: List[str] = []
    for i, clip_info in enumerate(clips_info):
        normalized_path = os.path.join(ctx.temp_dir, f"normalized_{i}.mp4")
        logger.info(f"セクション{i + 1}: 標準形式に正規化中 (映像=copy, 音声={'あり' if clip_info['has_audio'] else 'なし'})")
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

    # 動画を連結（FFmpeg concat demuxer使用 - MoviePy音声ループバグ回避）
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

    _concatenate_with_ffmpeg(paths_for_concat, output_path, ctx.temp_dir)

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

    has_audio = any(c["has_audio"] for c in clips_info)

    operation_time = time.time() - operation_start_time
    logger.complete_operation("Step 2: 動画連結処理", operation_time)

    return {
        "output_path": output_path,
        "duration": total_duration,
        "fps": clips_info[0]["fps"] if clips_info else 30,
        "width": clips_info[0]["width"] if clips_info else 1920,
        "height": clips_info[0]["height"] if clips_info else 1080,
        "has_audio": has_audio,
        "size_bytes": output_size_bytes
    }
