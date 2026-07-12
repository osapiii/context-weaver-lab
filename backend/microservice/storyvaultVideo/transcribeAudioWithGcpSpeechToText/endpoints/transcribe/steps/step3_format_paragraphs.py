"""
Step 3: Gemini段落分割処理

Geminiを使用して文字起こしテキストを段落に分割します。
"""

import json
from typing import Dict, Any, Tuple, Optional
from localPackages.common.logger import logger
from localPackages.common.context import RequestContext
from localPackages.core.gemini_processor import GeminiParagraphProcessor


def execute(
    ctx: RequestContext,
    transcription_result: Dict[str, Any],
    enable_paragraph_formatting: bool
) -> Tuple[bool, Optional[str], Optional[int], Dict[str, Any]]:
    """
    Gemini段落分割処理

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        transcription_result: Dict[str, Any] - 文字起こし結果,
        enable_paragraph_formatting: bool - 段落整形を有効化するか
    }

    returns: Tuple[bool, Optional[str], Optional[int], Dict[str, Any]] -
             (成功フラグ, 更新後文字起こしテキスト, 段落数, エラー詳細)
    """
    logger.start_operation("step3_format_paragraphs")

    # 音声なし時の固定テキスト（出力長0・result null時のエラー回避）
    NO_AUDIO_FIXED_TEXT = "音声なし"

    try:
        # Aqua Voiceの結果を取得
        transcription_text = getattr(ctx, 'transcription_text', None)
        if not transcription_text:
            logger.warning(
                "⚠️ transcription_textが空またはnullのため、固定値「音声なし」で結果を返します"
            )
            result_json = {
                "transcript": NO_AUDIO_FIXED_TEXT,
                "statistics": getattr(ctx, 'statistics', {}) or {},
                "note": "音声が検出されなかったため、固定テキストを返しました",
            }
            ctx.final_result_json = result_json
            result_text = json.dumps(result_json, ensure_ascii=False, indent=2)
            logger.complete_operation("step3_format_paragraphs", success=True)
            return True, result_text, 0, {}

        if not enable_paragraph_formatting:
            logger.info("📝 段落整形は無効化されています")
            # 段落整形が無効な場合でも、transcription_textをJSON形式で返す
            result_json = {
                "transcript": transcription_text,
                "statistics": getattr(ctx, 'statistics', {})
            }
            ctx.final_result_json = result_json
            result_text = json.dumps(result_json, ensure_ascii=False, indent=2)
            logger.complete_operation("step3_format_paragraphs", success=True)
            return True, result_text, None, {}

        logger.info("🤖 Geminiで段落分割処理を実行中...")

        # Geminiプロセッサ初期化
        gemini_processor = GeminiParagraphProcessor()

        # Aqua Voiceの結果をJSON形式に構築
        transcription_json = {
            "transcript": transcription_text,
            "statistics": getattr(ctx, 'statistics', {})
        }

        # Geminiで段落分割
        llm_output = gemini_processor.process_transcript(transcription_json)

        if llm_output:
            # 段落分割結果を transcription_json に追加し final_result_json として保持
            transcription_json['llm_output'] = llm_output
            ctx.llm_output = llm_output
            ctx.final_result_json = transcription_json

            paragraph_count = len(llm_output.get('paragraphs', []))
            logger.info(f"✨ 段落分割完了: {paragraph_count}個の段落を生成")

            logger.complete_operation("step3_format_paragraphs", success=True)
            # 互換性のため paragraph_text は整形済みJSON文字列を返す
            paragraph_text = json.dumps(transcription_json, ensure_ascii=False, indent=2)
            return True, paragraph_text, paragraph_count, {}

        else:
            # Gemini処理が失敗した場合でも、基本的な結果を返す
            logger.warning("⚠️ Gemini処理がスキップされました（エラーまたは無効）")
            ctx.final_result_json = transcription_json
            result_text = json.dumps(transcription_json, ensure_ascii=False, indent=2)
            logger.complete_operation("step3_format_paragraphs", success=True)
            return True, result_text, None, {}

    except Exception as e:
        logger.error(f"⚠️ Step 3エラー（継続します）: {str(e)}")
        # Geminiエラーは致命的ではないため、元の文字起こし結果を保持して継続

        # 基本的な結果を構築（transcription_textが空の場合は固定値「音声なし」）
        transcription_text = getattr(ctx, 'transcription_text', None)
        if transcription_text:
            result_json = {
                "transcript": transcription_text,
                "statistics": getattr(ctx, 'statistics', {})
            }
        else:
            result_json = {
                "transcript": "音声なし",
                "statistics": getattr(ctx, 'statistics', {}) or {},
                "note": "音声が検出されなかったため、固定テキストを返しました",
            }
        ctx.final_result_json = result_json
        result_text = json.dumps(result_json, ensure_ascii=False, indent=2)

        error_details = {
            "step": "step3_format_paragraphs",
            "exception_type": type(e).__name__,
            "message": str(e),
            "severity": "warning"  # 継続可能
        }
        logger.complete_operation("step3_format_paragraphs", success=True)
        return True, result_text, None, error_details

