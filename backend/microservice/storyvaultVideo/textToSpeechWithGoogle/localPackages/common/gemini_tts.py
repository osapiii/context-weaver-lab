"""
Chirp 3 HD Text-to-Speech 処理モジュール（gemini_tts.py として互換維持）

Cloud Text-to-Speech Chirp 3 HD を使用してテキストから音声を生成します。
バッチ処理向けに最適化され、MP3形式で出力します。
認証はADC（Application Default Credentials）を使用します。

参照: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd
"""

from typing import Dict, Any, List
from google.cloud import texttospeech
from .logger import logger
from .context import RequestContext


# フロントエンド互換: 短縮音声名（UI用）
# Perse は Chirp 3 にないため Leda にマッピング
AVAILABLE_VOICES: List[str] = [
    "Zephyr",
    "Puck",
    "Charon",
    "Aoede",
    "Fenrir",
    "Kore",
    "Perse",
]

DEFAULT_VOICE_NAME = "Puck"

# 短縮名 → Chirp 3 のベース名（Perse は Leda にマッピング）
VOICE_BASE_NAMES: Dict[str, str] = {
    "Zephyr": "Zephyr",
    "Puck": "Puck",
    "Charon": "Charon",
    "Aoede": "Aoede",
    "Fenrir": "Fenrir",
    "Kore": "Kore",
    "Perse": "Leda",
    "Leda": "Leda",
}


def _to_chirp_voice_name(voice_name: str, language_code: str = "ja-JP") -> str:
    """短縮名を Chirp 3 HD 完全名に変換"""
    if "-Chirp3-HD-" in voice_name:
        return voice_name
    base = VOICE_BASE_NAMES.get(voice_name, "Puck")
    return f"{language_code}-Chirp3-HD-{base}"


def initialize_client() -> None:
    """
    Cloud TTS クライアントの初期化（起動時ヘルスチェック用）

    ADC で TextToSpeechClient が作成できることを確認します。
    """
    logger.info("Chirp 3 HD TTS初期化チェック - Cloud TTS 接続確認")

    try:
        client = texttospeech.TextToSpeechClient()
        logger.success(f"Cloud TTS クライアント初期化成功")
    except Exception as e:
        raise ValueError(f"Cloud TTS 初期化失敗: {str(e)}") from e


def synthesize_speech(ctx: RequestContext) -> bytes:
    """
    テキストから音声を生成（バッチ・MP3出力）

    Chirp 3 HD を使用し、MP3形式で返します。
    後続の動画マージ・音声再生との互換性を維持します。

    Args:
        ctx: リクエストコンテキスト（input.text, input.voiceName 等）

    Returns:
        MP3音声データ（バイト）
    """
    input_data = ctx.get_param("input", {})
    text = input_data.get("text")
    voice_name = input_data.get("voiceName")
    # 日本語前提: 常に ja-JP を使用
    language_code = "ja-JP"

    if not text:
        raise ValueError("input.text is required")

    if not voice_name:
        voice_name = DEFAULT_VOICE_NAME
        logger.info(f"音声が指定されていないため、デフォルト音声を使用: {voice_name}")

    if voice_name not in AVAILABLE_VOICES and voice_name not in VOICE_BASE_NAMES:
        logger.warning(f"指定された音声 '{voice_name}' は利用できません。デフォルト音声を使用します。")
        voice_name = DEFAULT_VOICE_NAME

    chirp_voice_name = _to_chirp_voice_name(voice_name, language_code)

    logger.start_operation(f"Chirp 3 HD 音声合成 [request_id: {ctx.request_id}]")
    logger.data_analysis("音声合成パラメータ", {
        "text_length": len(text),
        "voice_name": voice_name,
        "chirp_voice": chirp_voice_name,
        "language_code": language_code,
        "output_format": "MP3",
    })

    try:
        client = texttospeech.TextToSpeechClient()

        input_text = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=chirp_voice_name,
        )
        # 読み上げ速度を10%速く（1.1 = 110%、自然なペースに）
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.1,
        )

        logger.api_request("POST", "Cloud TTS Chirp 3 HD", f"voice={chirp_voice_name}")

        response = client.synthesize_speech(
            input=input_text,
            voice=voice,
            audio_config=audio_config,
        )

        audio_data = response.audio_content
        ctx.set_state("audio_size_bytes", len(audio_data))
        ctx.set_metadata("audio_format", "MP3")
        ctx.set_metadata("audio_mime_type", "audio/mpeg")

        logger.api_response(200, f"音声生成完了: {len(audio_data)} bytes (MP3)")
        logger.complete_operation(f"Chirp 3 HD 音声合成 [request_id: {ctx.request_id}]")

        return audio_data

    except Exception as e:
        logger.error(f"Chirp 3 HD 音声合成エラー [request_id: {ctx.request_id}]", error=e)
        ctx.set_metadata("synthesis_error", str(e))
        raise RuntimeError(f"音声合成に失敗しました: {str(e)}") from e


def synthesize_speech_stream(ctx: RequestContext):
    """
    互換性のためのストリームAPI（Chirp 3 はバッチのみ）

    内部で synthesize_speech を呼び、1チャンクとして yield します。
    """
    audio_data = synthesize_speech(ctx)
    yield audio_data


def get_available_voices() -> Dict[str, Any]:
    """
    利用可能な音声リスト（フロントエンド互換）
    """
    voice_details = {
        "Zephyr": {"gender": "FEMALE", "description": "明瞭で自然な音声"},
        "Puck": {"gender": "MALE", "description": "活発で親しみやすい音声"},
        "Charon": {"gender": "MALE", "description": "落ち着いた深みのある男性音声"},
        "Aoede": {"gender": "FEMALE", "description": "優しく聞き取りやすい女性音声"},
        "Fenrir": {"gender": "MALE", "description": "力強く説得力のある男性音声"},
        "Kore": {"gender": "FEMALE", "description": "明るく親しみやすい女性音声"},
        "Perse": {"gender": "FEMALE", "description": "プロフェッショナルで洗練された女性音声"},  # Chirp 3: Leda にマッピング
    }

    voices = []
    for name in AVAILABLE_VOICES:
        info = voice_details.get(name, {"gender": "NEUTRAL", "description": ""})
        voices.append({
            "name": name,
            "gender": info["gender"],
            "language_codes": ["ja-JP"],
            "description": info["description"],
            "natural_sample_rate_hertz": 24000,
        })

    return {
        "voices": voices,
        "total_count": len(voices),
        "note": "Chirp 3 HD のプリセット音声リスト",
    }
