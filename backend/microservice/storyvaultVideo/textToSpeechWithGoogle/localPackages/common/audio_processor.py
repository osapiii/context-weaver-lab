"""
音声ファイル処理モジュール

Chirp 3 HD から受信したMP3音声データの処理を提供します。
後続の動画マージ・音声再生との互換性を維持します。
"""

import io
import struct
from typing import Dict, Any, Optional
from mutagen.mp3 import MP3
from .logger import logger
from .context import RequestContext


def normalize_audio_volume(audio_data: bytes, audio_format: str = "MP3") -> bytes:
    """
    音声データをピーク正規化して、出力間の音量差を均一化する。

    Args:
        audio_data: 音声データ（バイト列）
        audio_format: 音声フォーマット（デフォルト: MP3）

    Returns:
        ピーク正規化後の音声データ（MP3）
    """
    from pydub import AudioSegment
    from pydub.effects import normalize

    buf = io.BytesIO(audio_data)
    audio = AudioSegment.from_file(buf, format=audio_format.lower())
    normalized = normalize(audio, headroom=0.5)  # 最大値 -0.5dB に正規化

    out = io.BytesIO()
    normalized.export(out, format="mp3", bitrate="128k")
    return out.getvalue()


def get_mp3_duration(audio_data: bytes) -> float:
    """
    MP3バイト列から再生時間（秒）を取得

    Args:
        audio_data: MP3音声データ

    Returns:
        再生時間（秒）
    """
    try:
        audio = MP3(io.BytesIO(audio_data))
        return float(audio.info.length)
    except Exception as e:
        logger.warning(f"MP3 duration parse failed, using estimate: {e}")
        return estimate_audio_duration(len(audio_data), "MP3")


def process_tts_audio(ctx: RequestContext, audio_data: bytes) -> bytes:
    """
    TTS音声データのピーク正規化とメタデータ設定（MP3想定）

    MP3の場合はピーク正規化で音量を均一化し、durationSeconds 等を設定します。
    後続の buildAudioSegmentsForSection、動画マージで使用されます。

    Args:
        ctx: リクエストコンテキスト
        audio_data: MP3音声データ

    Returns:
        ピーク正規化後の音声データ（MP3の場合）
    """
    audio_format = ctx.metadata.get("audio_format", "MP3")
    logger.info(f"TTS音声処理: {len(audio_data)} bytes, フォーマット: {audio_format}")

    # MP3の場合はピーク正規化で音量を均一化
    if audio_format.upper() == "MP3":
        audio_data = normalize_audio_volume(audio_data, audio_format)

    ctx.audio_size_bytes = len(audio_data)

    if audio_format.upper() == "MP3":
        estimated_duration = get_mp3_duration(audio_data)
    else:
        estimated_duration = estimate_audio_duration(len(audio_data), audio_format)

    ctx.audio_duration_seconds = estimated_duration

    # 異常に長い音声の検出
    text_len = len(ctx.text or "")
    if text_len > 0:
        expected_max_seconds = max(45, text_len * 0.6)
        if estimated_duration > expected_max_seconds:
            logger.warning(
                f"⚠️ 音声長がテキスト長に対して異常に長い: "
                f"推定{estimated_duration:.1f}秒, テキスト{text_len}文字 "
                f"(期待値上限約{expected_max_seconds:.0f}秒)"
            )

    logger.success(f"音声処理完了: {len(audio_data)} bytes, フォーマット: {audio_format}, 推定 {estimated_duration:.2f} 秒")
    return audio_data


def add_wav_header(audio_data: bytes, sample_rate: int = 24000, bits_per_sample: int = 16) -> bytes:
    """
    PCM音声データにWAVヘッダーを追加
    
    Args:
        audio_data: PCM音声データ（バイト）
        sample_rate: サンプリングレート（デフォルト: 24000Hz）
        bits_per_sample: ビット深度（デフォルト: 16bit）
        
    Returns:
        WAVヘッダー付きの音声データ
    """
    # WAVファイルのパラメータ
    num_channels = 1  # モノラル
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size  # ヘッダー36バイト + データサイズ
    
    # WAVファイルヘッダーの作成（http://soundfile.sapp.org/doc/WaveFormat/）
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",          # ChunkID
        chunk_size,       # ChunkSize (ファイルサイズ - 8バイト)
        b"WAVE",          # Format
        b"fmt ",          # Subchunk1ID
        16,               # Subchunk1Size (PCMの場合は16)
        1,                # AudioFormat (PCMの場合は1)
        num_channels,     # NumChannels
        sample_rate,      # SampleRate
        byte_rate,        # ByteRate
        block_align,      # BlockAlign
        bits_per_sample,  # BitsPerSample
        b"data",          # Subchunk2ID
        data_size         # Subchunk2Size (音声データのサイズ)
    )
    
    # ヘッダーとデータを結合
    return header + audio_data


def process_gemini_audio_stream(ctx: RequestContext, audio_chunks: list[bytes]) -> bytes:
    """
    Geminiからの音声ストリームを処理
    
    Geminiから受信した複数の音声チャンクを結合し、必要に応じてWAVヘッダーを追加します。
    
    Args:
        ctx: リクエストコンテキスト
        audio_chunks: 音声データのチャンクリスト
        
    Returns:
        処理済みの音声データ（WAV形式）
    """
    logger.info(f"Gemini音声ストリーム処理中: {len(audio_chunks)} chunks")
    
    # すべてのチャンクを結合
    audio_data = b''.join(audio_chunks)
    
    # メタデータからMIMEタイプを取得
    mime_type = ctx.metadata.get("audio_mime_type", "")
    logger.info(f"音声MIME type: {mime_type}")
    
    # PCMデータの場合（Gemini TTSのデフォルト）はWAVヘッダーを追加
    if "audio/L16" in mime_type or "audio/pcm" in mime_type.lower():
        logger.info("PCMデータを検出 - WAVヘッダーを追加します")
        
        # MIMEタイプからサンプリングレートを抽出（例: "audio/L16;rate=24000"）
        sample_rate = 24000  # デフォルト
        if "rate=" in mime_type:
            try:
                rate_str = mime_type.split("rate=")[1].split(";")[0]
                sample_rate = int(rate_str)
                logger.info(f"サンプリングレート: {sample_rate}Hz")
            except:
                pass
        
        # WAVヘッダーを追加
        audio_data = add_wav_header(audio_data, sample_rate=sample_rate)
        ctx.metadata["audio_format"] = "WAV"
    else:
        # すでにエンコード済みの形式（MP3など）の場合
        ctx.metadata["audio_format"] = mime_type.split("/")[1].upper() if "/" in mime_type else "MP3"
    
    # 音声サイズをコンテキストに保存
    ctx.audio_size_bytes = len(audio_data)
    
    # 簡易的な再生時間推定
    audio_format = ctx.metadata.get("audio_format", "WAV")
    estimated_duration = estimate_audio_duration(len(audio_data), audio_format)
    ctx.audio_duration_seconds = estimated_duration
    
    # テキスト長に対する異常に長い音声の検出（目安: 日本語は約4文字/秒、2秒/文字以上は異常）
    text_len = len(ctx.text or "")
    if text_len > 0:
        expected_max_seconds = max(45, text_len * 0.6)  # 最低45秒、または0.6秒/文字
        if estimated_duration > expected_max_seconds:
            logger.warning(
                f"⚠️ 音声長がテキスト長に対して異常に長い: "
                f"推定{estimated_duration:.1f}秒, テキスト{text_len}文字 "
                f"(期待値上限約{expected_max_seconds:.0f}秒)"
            )
    
    logger.success(f"音声処理完了: {len(audio_data)} bytes, フォーマット: {audio_format}, 推定 {estimated_duration:.2f} 秒")
    
    return audio_data


def estimate_audio_duration(audio_size: int, format: str = "WAV") -> float:
    """
    音声データサイズから再生時間を推定
    
    Args:
        audio_size: 音声データのサイズ（バイト）
        format: 音声フォーマット（デフォルト: WAV）
        
    Returns:
        推定再生時間（秒）
    """
    # フォーマット別のビットレート（概算）
    bitrate_map = {
        'MP3': 128000,      # 128kbps
        'WAV': 24000 * 16,  # 24kHz * 16bit * 1ch = 384kbps
        'M4A': 128000,      # 128kbps
        'OGG': 96000,       # 96kbps
    }
    
    # デフォルトはWAV
    bitrate = bitrate_map.get(format.upper(), bitrate_map['WAV'])
    
    # WAVの場合はヘッダー分を除外
    if format.upper() == 'WAV' and audio_size > 44:
        audio_size -= 44  # WAVヘッダーは44バイト
    
    # ビット/秒 → バイト/秒に変換して計算
    bytes_per_second = bitrate / 8
    estimated_duration = audio_size / bytes_per_second
    
    logger.debug(f"音声時間推定: {audio_size} bytes / {bitrate} bps = {estimated_duration:.2f} 秒")
    
    return estimated_duration


def validate_audio_parameters(ctx: RequestContext) -> tuple[bool, Optional[str]]:
    """
    音声合成パラメータの検証
    
    Args:
        ctx: リクエストコンテキスト
        
    Returns:
        (検証成功, エラーメッセージ) のタプル
    """
    # テキスト長の検証
    if ctx.text:
        max_length = ctx.metadata.get("max_text_length", 5000)
        if len(ctx.text) > max_length:
            return False, f"Text too long. Maximum {max_length} characters allowed"
    
    # 音声パラメータの検証
    if ctx.voice_name:
        available_voices = ["Zephyr", "Puck", "Charon", "Aoede", "Fenrir", "Kore", "Perse"]
        if ctx.voice_name not in available_voices:
            return False, f"Invalid voice name: {ctx.voice_name}"
    
    return True, None