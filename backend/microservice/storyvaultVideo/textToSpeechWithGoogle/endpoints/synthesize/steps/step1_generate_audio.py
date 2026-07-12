"""
Step 1: 音声生成処理

Chirp 3 HD を使用してテキストから音声を生成し、MP3形式で返します。
"""

from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import gemini_tts
from localPackages.common import audio_processor


def execute(ctx: RequestContext) -> bytes:
    """
    Step 1: Chirp 3 HD で音声を生成（MP3出力）

    params: {
        ctx: RequestContext - リクエストコンテキスト
            - ctx.text: 変換するテキスト
            - ctx.voice_name: 音声モデル名
    }

    returns: bytes - 生成されたMP3音声データ
    """
    logger.start_operation("Step 1: 音声生成")

    # Chirp 3 HD 音声合成（バッチ・MP3）
    audio_data = gemini_tts.synthesize_speech(ctx)

    # メタデータ設定（durationSeconds 等、後続の動画マージ用）
    audio_data = audio_processor.process_tts_audio(ctx, audio_data)
    ctx.audio_data = audio_data
    ctx.audio_size_bytes = len(audio_data)

    logger.success(f"音声生成完了: {ctx.audio_size_bytes} bytes (MP3)")
    logger.complete_operation("Step 1: 音声生成")

    return audio_data
