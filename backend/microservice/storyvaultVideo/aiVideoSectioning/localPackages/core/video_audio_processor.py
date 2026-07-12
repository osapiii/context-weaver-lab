"""
動画・音声処理モジュール

FFmpegを使用して動画と音声をカットします。
入力は常に圧縮済み MP4（アップロード時変換済み）を想定し、-c copy で高速カット。
メタデータ取得はffprobeを使用（MoviePyのvideo_fps KeyError回避・依存排除）。
Duration:N/A の WebM は get_duration_via_ffprobe でストリームを読んで補完。
"""

import json
import os
import time
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass

from ..common.logger import logger
from ..common.context import context, RequestContext


def get_duration_via_ffprobe(video_path: str) -> Optional[float]:
    """
    Duration:N/A のファイルでも、ストリームを読んで duration を取得する。
    1) format=duration を試行
    2) 失敗時: packet pts_time + read_intervals 99999%+#1000 で末尾付近の
       パケットを読み、最後の PTS を duration とする。
    """
    if not os.path.exists(video_path):
        return None

    # 1) format=duration を試行（通常ファイル用）
    try:
        result = subprocess.run(
            [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                video_path,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0 and result.stdout.strip():
            val = result.stdout.strip()
            if val.lower() != 'n/a':
                duration = float(val)
                if duration > 0:
                    return duration
    except (subprocess.TimeoutExpired, ValueError, Exception) as e:
        logger.debug(f"ffprobe format=duration failed for {video_path}: {e}")

    # 2) ストリームを読んで取得（packet pts_time）
    try:
        result = subprocess.run(
            [
                'ffprobe',
                '-v', 'error',
                '-of', 'csv=p=0:nk=1',
                '-show_entries', 'packet=pts_time',
                '-select_streams', 'v:0',
                '-read_intervals', '99999%+#1000',
                video_path,
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0 and result.stdout.strip():
            lines = [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]
            if lines:
                last_pts = lines[-1]
                duration = float(last_pts)
                if duration > 0:
                    logger.info(f"Duration取得（ストリーム読取）: {video_path} -> {duration:.2f}秒")
                    return duration
    except (subprocess.TimeoutExpired, ValueError, Exception) as e:
        logger.debug(f"ffprobe packet pts failed for {video_path}: {e}")

    return None


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
    Duration:N/A の場合は get_duration_via_ffprobe でストリームを読んで補完。
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

    # Duration:N/A の WebM 等はメタデータに含まれない。ストリームを読んで取得
    if duration <= 0:
        fallback = get_duration_via_ffprobe(video_path)
        if fallback is not None:
            duration = fallback
            logger.info(f"Duration:N/A を ffprobe で補完: {video_path} -> {duration:.2f}秒")

    return {
        "duration": duration,
        "fps": fps,
        "size": (width, height),
        "width": width,
        "height": height,
        "has_audio": audio_stream is not None,
    }


# 初期Autoトリミング: 長さがこの値未満のセクションはスキップする（秒）
MIN_SECTION_DURATION_SEC = 1.0

# 並列処理のワーカー数
PARALLEL_WORKERS = 4


@dataclass
class SectionSegment:
    """セクションごとの動画・音声セグメント情報"""
    section_id: str
    index: int
    start_time: float
    end_time: float
    title: Optional[str]
    
    # 動画セグメント情報
    video_temp_path: Optional[str] = None
    video_size_bytes: Optional[int] = None
    
    # 音声セグメント情報
    audio_temp_path: Optional[str] = None
    audio_size_bytes: Optional[int] = None


def _extract_video_segment(
    input_path: str,
    output_path: str,
    start_time: float,
    end_time: float
) -> bool:
    """
    FFmpegで動画セグメントを抽出。
    入力は常に圧縮済み MP4 であるため -c copy でストリームコピー。
    -ss を -i の前に配置（入力側シーク）で長尺動画のシークを高速化。
    """
    duration = end_time - start_time

    try:
        cmd = [
            'ffmpeg',
            '-ss', str(start_time),
            '-i', input_path,
            '-t', str(duration),
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-avoid_negative_ts', 'make_zero',
            '-c:v', 'copy',
            '-c:a', 'copy',
            '-y',
            output_path,
        ]
        logger.debug(f"FFmpeg動画カット: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        if result.returncode == 0:
            return True
        logger.error(f"FFmpeg動画カットエラー: {result.stderr}")
        return False
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg動画カットタイムアウト")
        return False
    except Exception as e:
        logger.error(f"動画セグメント抽出エラー: {e}")
        return False


def _extract_audio_segment(
    input_path: str,
    output_path: str,
    start_time: float,
    end_time: float
) -> bool:
    """
    FFmpegでソース動画から指定区間の音声を抽出。
    入力は常に圧縮済み MP4 であるため -acodec copy でストリームコピー。
    """
    duration = end_time - start_time

    try:
        cmd = [
            'ffmpeg',
            '-ss', str(start_time),
            '-i', input_path,
            '-t', str(duration),
            '-vn',
            '-acodec', 'copy',
            '-y',
            output_path,
        ]
        logger.debug(f"FFmpeg音声抽出: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        if result.returncode == 0:
            return True
        logger.error(f"FFmpeg音声抽出エラー: {result.stderr}")
        return False
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg音声抽出タイムアウト")
        return False
    except Exception as e:
        logger.error(f"音声セグメント抽出エラー: {e}")
        return False


def _process_one_section(
    args: Tuple[RequestContext, str, int, Dict[str, Any], SectionSegment, bool]
) -> Optional[SectionSegment]:
    """
    1セクション分の動画・音声カットを実行（並列ワーカー用）

    Returns:
        成功時はSectionSegment、失敗時はNone
    """
    ctx, video_path, i, section_data, segment, has_audio = args
    start_time = section_data.get("start", 0)
    end_time = section_data.get("end", 0)
    title = section_data.get("title", f"セクション {i + 1}")

    video_output_path = os.path.join(ctx.temp_dir, f"video_segment_{i:03d}.mp4")
    audio_output_path = os.path.join(ctx.temp_dir, f"audio_segment_{i:03d}.m4a")

    try:
        logger.info(f"セクション{i + 1}処理開始: {start_time:.1f}秒 - {end_time:.1f}秒")
        # 動画セグメントを切り出し
        if not _extract_video_segment(video_path, video_output_path, start_time, end_time):
            return None
        if not os.path.exists(video_output_path):
            return None

        segment.video_temp_path = video_output_path
        segment.video_size_bytes = os.path.getsize(video_output_path)

        # 音声セグメントを抽出（ソースから直接、ストリームコピー）
        if has_audio:
            if _extract_audio_segment(video_path, audio_output_path, start_time, end_time):
                if os.path.exists(audio_output_path):
                    segment.audio_temp_path = audio_output_path
                    segment.audio_size_bytes = os.path.getsize(audio_output_path)

        return segment
    except Exception as e:
        logger.error(f"セクション{i + 1}の処理エラー: {e}")
        return None


def cut_video_and_audio(
    ctx: RequestContext,
    video_path: str,
    sections: List[Dict[str, Any]]
) -> List[SectionSegment]:
    """
    動画と音声をセクションごとにカット

    入力は常に圧縮済み MP4（アップロード時変換済み）。
    全セクションを -c copy でストリームコピーし、並列処理で高速化。

    Args:
        ctx: リクエストコンテキスト
        video_path: 入力動画ファイルパス
        sections: Gemini分析結果のセクション配列

    Returns:
        カットされたセクションセグメントのリスト

    Raises:
        Exception: 動画処理エラー
    """
    operation_start_time = time.time()

    logger.start_operation(f"動画・音声カット処理 [request_id: {ctx.request_id}]")

    try:
        if not os.path.exists(video_path):
            raise ValueError(f"動画ファイルが見つかりません: {video_path}")

        logger.info(f"動画ファイルを読み込み中: {video_path}")

        # 動画の情報を取得（ffprobe使用、MoviePy排除）
        meta = _get_video_metadata_ffprobe(video_path)
        video_duration = meta["duration"]
        video_size = meta["size"]
        has_audio = meta["has_audio"]

        video_info = {
            "duration": round(video_duration, 2),
            "fps": meta["fps"],
            "resolution": f"{video_size[0]}x{video_size[1]}",
            "has_audio": has_audio
        }
        logger.data_analysis("入力動画情報", video_info)
        ctx.metadata["input_video_info"] = video_info

        # Firestoreに動画情報を記録
        if ctx.collection_name and ctx.document_id:
            from localPackages.common import firestore_client
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"動画情報取得完了: 長さ {round(video_duration, 2)}秒, 解像度 {video_size[0]}x{video_size[1]}",
                current_step="cutting"
            )

        # 処理対象セクションを事前に構築
        section_tasks: List[Tuple[RequestContext, str, int, Dict[str, Any], SectionSegment, bool]] = []
        for i, section_data in enumerate(sections):
            start_time = section_data.get("start", 0)
            end_time = section_data.get("end", video_duration)
            title = section_data.get("title", f"セクション {i + 1}")

            if start_time >= end_time:
                logger.warning(f"無効なセクションをスキップ: {start_time} - {end_time}")
                continue
            if start_time >= video_duration:
                logger.warning(f"動画の長さを超えるセクションをスキップ: {start_time} - {end_time}")
                continue

            end_time = min(end_time, video_duration)
            duration_sec = end_time - start_time
            if duration_sec < MIN_SECTION_DURATION_SEC:
                logger.warning(
                    f"長さ{MIN_SECTION_DURATION_SEC}秒未満のセクションをスキップ: "
                    f"セクション{i + 1} ({start_time:.2f} - {end_time:.2f}秒)"
                )
                continue

            segment = SectionSegment(
                section_id=f"section-{i}",
                index=i,
                start_time=start_time,
                end_time=end_time,
                title=title
            )
            section_tasks.append((ctx, video_path, i, section_data, segment, has_audio))

        total_sections = len(section_tasks)
        if total_sections == 0:
            raise ValueError("有効なセクションがありません")

        logger.info(f"FFmpegで{total_sections}個のセクションを並列処理開始（workers={PARALLEL_WORKERS}）")

        if ctx.collection_name and ctx.document_id:
            from localPackages.common import firestore_client
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"動画と音声を{total_sections}個のセクションにカット中（FFmpegストリームコピー・並列）",
                current_step="cutting"
            )

        segments: List[SectionSegment] = []
        completed = 0

        with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
            futures = {executor.submit(_process_one_section, t): t for t in section_tasks}
            for future in as_completed(futures):
                completed += 1
                result = future.result()
                if result:
                    segments.append(result)
                    logger.success(f"セクション{result.index + 1}作成完了")
                else:
                    task = futures[future]
                    logger.error(f"セクション{task[2] + 1}の切り出し失敗")

                if ctx.collection_name and ctx.document_id:
                    from localPackages.common import firestore_client
                    if completed % max(1, total_sections // 4) == 0 or completed == total_sections:
                        firestore_client.log_processing_status(
                            ctx,
                            status="processing",
                            message=f"セクション{completed}/{total_sections}処理完了",
                            current_step="cutting"
                        )

        segments.sort(key=lambda s: s.index)

        if not segments:
            raise ValueError("有効なセグメントを作成できませんでした")

        if ctx.collection_name and ctx.document_id:
            from localPackages.common import firestore_client
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"動画・音声カット完了 ({len(segments)}個のセクション)",
                current_step="cutting"
            )

        operation_time = time.time() - operation_start_time
        logger.performance_metric("動画・音声カット処理時間", operation_time, "秒")
        logger.complete_operation(f"動画・音声カット処理 [request_id: {ctx.request_id}]", operation_time)
        logger.success(f"{len(segments)}個のセグメントにカット完了")

        return segments

    except Exception as e:
        operation_time = time.time() - operation_start_time
        logger.error(
            f"動画・音声カットエラー [request_id: {ctx.request_id}]",
            error=e, operation_time=operation_time
        )
        raise
