"""
動画処理モジュール

FFmpegを使用して動画を指定されたタイムスタンプで分割します。
ストリームコピー（-c copy）で再エンコードせず高速処理。並列実行でスループット向上。
メタデータ取得はffprobeを使用（MoviePyのvideo_fps KeyError回避・依存排除）。
"""

import json
import os
import time
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Tuple, Dict, Any
from ..common.logger import logger
from ..common.context import context, RequestContext, VideoSegment


# 並列処理のワーカー数
PARALLEL_WORKERS = 4


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
        )
        fps = _parse_fps(video_stream.get("r_frame_rate"))
        width = int(video_stream.get("width", 1920))
        height = int(video_stream.get("height", 1080))
    elif data.get("format"):
        duration = float(data["format"].get("duration", 0))

    return {
        "duration": duration,
        "fps": fps,
        "size": (width, height),
        "width": width,
        "height": height,
        "has_audio": audio_stream is not None,
    }


def extract_video_segment(input_path: str, output_path: str, start_time: float, end_time: float) -> bool:
    """
    FFmpegで動画セグメントを抽出（ストリームコピー、再エンコードなし）
    ビデオ・音声をそのままコピーするため高速。

    Args:
        input_path: 入力動画ファイルパス
        output_path: 出力動画ファイルパス
        start_time: 開始時間（秒）
        end_time: 終了時間（秒）

    Returns:
        bool: 成功した場合True、失敗した場合False
    """
    try:
        # -c copy で再エンコードせずストリームコピー（高速）
        # -map 0:a:0? で音声があれば含め、なければスキップ
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-ss', str(start_time),
            '-to', str(end_time),
            '-map', '0:v:0',
            '-map', '0:a:0?',  # 音声（あれば）
            '-c:v', 'copy',
            '-c:a', 'copy',
            '-avoid_negative_ts', 'make_zero',
            '-y',
            output_path
        ]
        
        logger.debug(f"FFmpegコマンド実行: {' '.join(cmd)}")
        
        # FFmpegコマンドを実行
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5分のタイムアウト
        )
        
        if result.returncode == 0:
            logger.success(f"動画セグメント抽出成功: {output_path}")
            return True
        else:
            logger.error(f"FFmpegエラー: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("FFmpegタイムアウト: 動画処理が5分を超えました")
        return False
    except Exception as e:
        logger.error(f"動画セグメント抽出エラー: {e}")
        return False


def split_video(ctx: RequestContext, video_data: bytes) -> List[VideoSegment]:
    """
    動画を指定されたタイムスタンプで分割
    
    FFmpegを使用してtimecodeトラックを除外した安定した動画分割を実行します。
    
    Args:
        ctx: リクエストコンテキスト
        video_data: 動画データ（使用されない、ファイルパスから直接読み込み）
        
    Returns:
        分割されたセグメントのリスト
        
    Raises:
        Exception: 動画処理エラー
    """
    operation_start_time = time.time()
    
    logger.start_operation(f"動画分割処理 [request_id: {ctx.request_id}]")
    
    segments = []
    
    try:
        # 動画ファイルを開く
        if not ctx.downloaded_video_path or not os.path.exists(ctx.downloaded_video_path):
            raise ValueError(f"動画ファイルが見つかりません: {ctx.downloaded_video_path}")
        
        logger.info(f"動画ファイルを読み込み中: {ctx.downloaded_video_path}")

        # 動画の情報を取得（ffprobe使用、MoviePy排除）
        meta = _get_video_metadata_ffprobe(ctx.downloaded_video_path)
        video_duration = meta["duration"]
        video_size = meta["size"]
        video_info = {
            "duration": round(video_duration, 2),
            "fps": meta["fps"],
            "resolution": f"{video_size[0]}x{video_size[1]}",
            "has_audio": meta["has_audio"]
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
                current_step="splitting"
            )
        
        # カットポイントの準備
        cutoff_points = sorted([0] + ctx.cutoff_seconds + [video_duration])
        # 重複を除去
        cutoff_points = list(dict.fromkeys(cutoff_points))
        logger.info(f"カットポイント: {cutoff_points}")
        
        # Firestoreにカットポイント情報を記録
        if ctx.collection_name and ctx.document_id:
            from localPackages.common import firestore_client
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"カットポイント準備完了: {len(cutoff_points) - 1}個のセグメントに分割",
                current_step="splitting"
            )
        
        # セグメント対象を事前に構築
        segment_tasks: List[Tuple[int, float, float, str, VideoSegment]] = []
        for i in range(len(cutoff_points) - 1):
            start_time = cutoff_points[i]
            end_time = cutoff_points[i + 1]

            if start_time >= end_time or start_time >= video_duration:
                continue
            end_time = min(end_time, video_duration)

            segment_number = i + 1
            output_filename = f"segment_{segment_number:03d}.mp4"
            temp_output_path = os.path.join(ctx.temp_dir, output_filename)
            segment = VideoSegment(
                segment_number=segment_number,
                start_time=start_time,
                end_time=end_time,
                output_path=ctx.get_segment_output_path(segment_number),
                duration=end_time - start_time,
                temp_path=temp_output_path
            )
            segment_tasks.append((segment_number, start_time, end_time, temp_output_path, segment))

        total_segments = len(segment_tasks)
        logger.info(f"FFmpegで{total_segments}個のセグメントを並列処理開始（workers={PARALLEL_WORKERS}）")

        if ctx.collection_name and ctx.document_id:
            from localPackages.common import firestore_client
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"{total_segments}個のセグメントを並列で処理中（FFmpegストリームコピー）",
                current_step="splitting"
            )

        def _extract_one(args: Tuple[int, float, float, str, VideoSegment]) -> Optional[VideoSegment]:
            _seg_num, st, en, out_path, seg = args
            if extract_video_segment(ctx.downloaded_video_path, out_path, st, en):
                if os.path.exists(out_path):
                    seg.size_bytes = os.path.getsize(out_path)
                return seg
            return None

        with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
            futures = {executor.submit(_extract_one, t): t for t in segment_tasks}
            completed = 0
            for future in as_completed(futures):
                completed += 1
                result = future.result()
                if result:
                    segments.append(result)
                    logger.success(f"セグメント{result.segment_number}作成完了")
                else:
                    task = futures[future]
                    logger.error(f"セグメント{task[0]}の切り出し失敗")

                if ctx.collection_name and ctx.document_id and completed % max(1, total_segments // 4) == 0:
                    from localPackages.common import firestore_client
                    firestore_client.log_processing_status(
                        ctx,
                        status="processing",
                        message=f"セグメント処理中 ({completed}/{total_segments} 完了)",
                        current_step="splitting"
                    )

        # セグメント番号でソート（並列完了順がばらつくため）
        segments.sort(key=lambda s: s.segment_number)

        if ctx.collection_name and ctx.document_id:
            from localPackages.common import firestore_client
            firestore_client.log_processing_status(
                ctx,
                status="processing",
                message=f"動画分割完了 ({len(segments)}個のセグメント)",
                current_step="splitting"
            )

        if not segments:
            raise ValueError("有効なセグメントを作成できませんでした")
        
        operation_time = time.time() - operation_start_time
        logger.performance_metric("動画分割処理時間", operation_time, "秒")
        logger.complete_operation(f"動画分割処理 [request_id: {ctx.request_id}]", operation_time)
        logger.success(f"{len(segments)}個のセグメントに分割完了")
        
        return segments
        
    except Exception as e:
        operation_time = time.time() - operation_start_time
        logger.error(f"動画分割エラー [request_id: {ctx.request_id}]", 
                    error=e, operation_time=operation_time)
        raise


def validate_video_format(file_path: str) -> bool:
    """
    動画フォーマットが対応しているか確認
    
    Args:
        file_path: 動画ファイルパス
        
    Returns:
        対応している場合True
    """
    supported_formats = context.supported_video_formats
    file_ext = os.path.splitext(file_path)[1].lower()
    return file_ext in supported_formats


def get_video_info(file_path: str) -> Optional[dict]:
    """
    動画ファイルの情報を取得（ffprobe使用）
    
    Args:
        file_path: 動画ファイルパス
        
    Returns:
        動画情報の辞書、エラーの場合None
    """
    try:
        meta = _get_video_metadata_ffprobe(file_path)
        return {
            "duration": meta["duration"],
            "fps": meta["fps"],
            "size": meta["size"],
            "width": meta["width"],
            "height": meta["height"],
            "has_audio": meta["has_audio"]
        }
    except Exception as e:
        logger.error(f"動画情報取得エラー: {file_path}", error=e)
        return None


def calculate_segments_from_timestamps(timestamps: List[float], video_duration: float) -> List[tuple]:
    """
    タイムスタンプからセグメントの開始・終了時間を計算
    
    Args:
        timestamps: カットポイントのタイムスタンプリスト
        video_duration: 動画の総時間
        
    Returns:
        (start_time, end_time)のタプルのリスト
    """
    # タイムスタンプをソートして重複を除去
    cutoff_points = sorted(set([0] + timestamps + [video_duration]))
    
    segments = []
    for i in range(len(cutoff_points) - 1):
        start = cutoff_points[i]
        end = min(cutoff_points[i + 1], video_duration)  # 動画の長さを超えないように調整
        
        # 有効なセグメントのみ追加
        if start < end and start < video_duration:
            segments.append((start, end))
    
    return segments