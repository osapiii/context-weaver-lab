"""
Step 4: 結果をGCSに保存

文字起こし結果（段落分割結果を含む）をGCSに保存します。
"""

from typing import Dict, Any, Tuple
import json
from localPackages.common.logger import logger
from localPackages.common.context import RequestContext
from localPackages.common import gcs_storage


def execute(ctx: RequestContext, transcription_text: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    結果をGCSに保存

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        transcription_text: str - 保存する文字起こしテキスト
    }

    returns: Tuple[bool, str, Dict[str, Any]] -
             (成功フラグ, GCSパス, エラー詳細)
    """
    logger.start_operation("step4_save_to_gcs")

    try:
        # 保存対象は final_result_json を優先、両方空の場合は「音声なし」フォールバック
        final_result = getattr(ctx, "final_result_json", None)
        if final_result is not None:
            content_text = json.dumps(final_result, ensure_ascii=False, indent=2)
        elif transcription_text:
            content_text = transcription_text
        else:
            logger.warning(
                "⚠️ transcription_text と final_result_json が両方空のため、固定値「音声なし」で保存します"
            )
            content_text = json.dumps(
                {
                    "transcript": "音声なし",
                    "statistics": {},
                    "note": "音声が検出されなかったため、固定テキストを返しました",
                },
                ensure_ascii=False,
                indent=2,
            )

        # 呼び出し元が指定した出力パスを尊重する。
        # 以前は sections/{sectionId}/transcribe/transcribe.json に固定変換していたため、
        # 再録音・再実行時に同一オブジェクト上書きとなり、delete 権限不足で 403 になることがあった。
        transcript_path = ctx.output_file_path

        # 結果をGCSに保存（content_text は上で決定済み）
        logger.info("💾 GCSに保存中...")
        gcs_storage.save_transcription_to_gcs(ctx, content_text)

        gcs_path = f"gs://{ctx.output_bucket_name}/{ctx.output_file_path}"
        logger.info(f"✅ 保存完了: {gcs_path}")

        logger.complete_operation("step4_save_to_gcs", success=True)
        return True, gcs_path, {
            "bucket_name": ctx.output_bucket_name,
            "file_path": ctx.output_file_path
        }

    except Exception as e:
        logger.error(f"❌ Step 4エラー: {str(e)}")
        error_details = {
            "step": "step4_save_to_gcs",
            "exception_type": type(e).__name__,
            "message": str(e)
        }
        logger.complete_operation("step4_save_to_gcs", success=False)
        return False, "", error_details

