"""
Step 2: Aqua Voice文字起こし実行

Aqua Voice Avalon APIを使用して音声文字起こしを実行し、
結果をRequestContextに設定します。
"""

import os
import tempfile
from typing import Dict, Any, Tuple
from localPackages.common.logger import logger
from localPackages.common.context import RequestContext, context
from localPackages.common import gcs_storage
from localPackages.core.aqua_voice_transcription import AquaVoiceTranscription
from localPackages.core.audio_converter import AudioConverter


def execute(ctx: RequestContext, gcs_uri: str) -> Tuple[bool, Dict[str, Any]]:
    """
    Aqua Voice文字起こしを実行
    
    params: {
        ctx: RequestContext - リクエストコンテキスト,
        gcs_uri: GCS音声/動画ファイルURI (gs://bucket/path)
    }
    
    returns: Tuple[bool, Dict[str, Any]] -
             (成功フラグ, エラー詳細)
    """
    logger.start_operation("step2_submit_transcription")

    try:
        # videoFileモードの場合、音声抽出が必要
        audio_gcs_uri = gcs_uri
        if ctx.mode == 'videoFile':
            logger.info("🎬 動画ファイルから音声を抽出します...")
            
            # 一時ファイルパスを生成
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(ctx.source_file_path)[1]) as temp_video:
                video_file_path = temp_video.name
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_audio:
                audio_file_path = temp_audio.name
            
            try:
                # GCSから動画をダウンロード
                logger.info("📥 GCSから動画ファイルをダウンロード中...")
                gcs_storage.download_file_from_gcs(
                    ctx.source_file_bucket_name,
                    ctx.source_file_path,
                    video_file_path
                )
                
                # Aqua Voice は FLAC を受け付けないため、軽量な MP3 で抽出する
                logger.info("🎵 音声トラックを抽出中...")
                audio_file_path = AudioConverter.extract_audio_from_video(
                    video_file_path,
                    output_format='mp3'
                )
                
                if not audio_file_path:
                    error_details = {
                        "step": "audio_extraction",
                        "message": "Failed to extract audio from video"
                    }
                    logger.error("❌ 音声抽出に失敗しました")
                    logger.complete_operation("step2_submit_transcription", success=False)
                    return False, error_details
                
                # 抽出した音声をGCSにアップロード
                audio_gcs_path = ctx.source_file_path.rsplit('.', 1)[0] + '_audio.mp3'
                logger.info(f"📤 抽出した音声をGCSにアップロード: {audio_gcs_path}")
                gcs_storage.upload_file_to_gcs(
                    ctx.source_file_bucket_name,
                    audio_gcs_path,
                    audio_file_path
                )
                
                audio_gcs_uri = f"gs://{ctx.source_file_bucket_name}/{audio_gcs_path}"
                logger.info(f"✅ 音声抽出完了: {audio_gcs_uri}")
                
            finally:
                # 一時ファイルをクリーンアップ
                AudioConverter.cleanup_temp_file(video_file_path)
                AudioConverter.cleanup_temp_file(audio_file_path)

        # audioFile で m4a/aac の場合は Aqua Voice が安定して受け取れる MP3 に変換してから送る
        file_extension = (ctx.source_file_path or "").lower().split(".")[-1] if ctx.mode != "videoFile" else ""
        if ctx.mode == "audioFile" and file_extension in ("m4a", "aac"):
            logger.info("🔄 m4a/AAC は MP3 に変換してから書き起こしします...")
            temp_input_path = None
            temp_mp3_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix="." + file_extension) as f:
                    temp_input_path = f.name
                ok = gcs_storage.download_file_from_gcs(
                    ctx.source_file_bucket_name,
                    ctx.source_file_path,
                    temp_input_path,
                )
                if not ok:
                    logger.complete_operation("step2_submit_transcription", success=False)
                    return False, {"step": "audio_download", "message": "Failed to download m4a/aac from GCS"}
                temp_mp3_path = AudioConverter.convert_to_mp3_16k_mono(temp_input_path)
                if not temp_mp3_path:
                    logger.complete_operation("step2_submit_transcription", success=False)
                    return False, {"step": "audio_conversion", "message": "Failed to convert m4a/aac to MP3 16kHz"}
                audio_gcs_path_converted = ctx.source_file_path.rsplit(".", 1)[0] + "_aqua_voice.mp3"
                gcs_storage.upload_file_to_gcs(
                    ctx.source_file_bucket_name,
                    audio_gcs_path_converted,
                    temp_mp3_path,
                )
                audio_gcs_uri = f"gs://{ctx.source_file_bucket_name}/{audio_gcs_path_converted}"
                logger.info(f"✅ 変換済み音声をアップロード: {audio_gcs_uri}")
            finally:
                AudioConverter.cleanup_temp_file(temp_input_path)
                AudioConverter.cleanup_temp_file(temp_mp3_path)
        
        # Aqua Voiceはローカルファイルアップロード形式のため、対象音声をGCSから一時ファイルへ取得
        logger.info(f"📥 Aqua Voice送信用の音声をGCSからダウンロード: {audio_gcs_uri}")
        audio_bucket_name, audio_object_name = gcs_storage.parse_gcs_path(audio_gcs_uri)
        audio_suffix = os.path.splitext(audio_object_name)[1] or ".audio"
        aqua_audio_path = None

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=audio_suffix) as temp_audio:
                aqua_audio_path = temp_audio.name

            ok = gcs_storage.download_file_from_gcs(
                audio_bucket_name,
                audio_object_name,
                aqua_audio_path,
            )
            if not ok:
                logger.complete_operation("step2_submit_transcription", success=False)
                return False, {"step": "audio_download", "message": "Failed to download audio for Aqua Voice transcription"}

            # 文字起こし実行
            logger.info(f"📡 Aqua Voice文字起こしリクエスト送信: {audio_gcs_uri}")
            speech_client = AquaVoiceTranscription()
            result = speech_client.transcribe_file(
                aqua_audio_path,
                filename=os.path.basename(audio_object_name),
            )
        finally:
            AudioConverter.cleanup_temp_file(aqua_audio_path)

        # 出力長0・result null 時のエラー回避：空またはNoneの場合は固定値「音声なし」に正規化
        transcript = result.get("transcript") if result else None
        if transcript is None or (isinstance(transcript, str) and not transcript.strip()):
            transcript = "音声なし"
            logger.info("⚠️ 文字起こし結果が空のため、固定値「音声なし」を設定します")

        # 結果をコンテキストに設定
        ctx.transcription_text = transcript
        ctx.transcription_id = f"aqua_voice_{result.get('operation_id', 'unknown')}"
        ctx.statistics = {
            "character_count": len(transcript) if transcript else 0,
            "language": result.get("language", ""),
            "language_confidence": result.get("confidence", 0.0),
            "duration_seconds": result.get("duration_seconds", 0.0),
        }

        logger.info(f"✅ 文字起こし成功")
        logger.info(f"   - 文字数: {ctx.statistics['character_count']}")
        logger.info(f"   - 言語: {ctx.statistics['language']}")
        logger.info(f"   - 信頼度: {ctx.statistics['language_confidence']:.2%}")
        logger.info(f"   - 音声長: {ctx.statistics['duration_seconds']:.1f}秒")
        logger.info(f"   - Operation ID: {ctx.transcription_id}")
        
        logger.complete_operation("step2_submit_transcription", success=True)
        return True, {}

    except Exception as e:
        error_details = {
            "step": "step2_submit_transcription",
            "message": f"Aqua Voice API error: {str(e)}",
            "error_type": type(e).__name__
        }
        logger.error(f"❌ Step 2でエラー発生: {str(e)}")
        logger.complete_operation("step2_submit_transcription", success=False)
        return False, error_details
