"""
Transcribeエンドポイント実行モジュール（Aqua Voice版）

4つのステップをOrchestrationし、統一レスポンスを返します。
"""

import time
import json
from typing import Dict, Any, Tuple
from localPackages.common.logger import logger
from localPackages.common.context import RequestContext
from localPackages.common.response_formatter import response_formatter
from localPackages.common.request_validator import RequestValidator
from .request_schema import TranscribeRequest
from .steps import (
    step1_validate_and_prepare,
    step1b_inspect_audio,
    step2_submit_transcription,
    step3_format_paragraphs,
    step4_save_to_gcs
)


def execute(request_data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    文字起こし処理を実行（Orchestrator）
    
    params: {
        request_data: Dict[str, Any] - リクエストデータ
    }
    
    returns: Tuple[Dict[str, Any], int] -
             (レスポンスボディ, HTTPステータスコード)
    """
    start_time = time.time()
    request_id = RequestValidator.extract_request_id(request_data)

    try:
        logger.info(f"🚀 文字起こしリクエストを受信: {request_id}")

        # Step 0: リクエスト検証
        valid, validated_data, error_details = RequestValidator.validate(
            TranscribeRequest,
            request_data
        )

        if not valid:
            logger.error(f"❌ リクエスト検証エラー: {error_details}")
            # 🔍 return 前のデバッグ出力（必須）
            validation_response = response_formatter.validation_error(
                request_id=request_id,
                message="Request validation failed",
                field_errors=error_details
            )
            logger.info(f"🔍 Final Response: {json.dumps(validation_response, ensure_ascii=False, indent=2)}")
            return validation_response

        # RequestContextを構築
        ctx = _build_context(validated_data)

        logger.info(f"📋 モード: {ctx.mode}")
        logger.info(f"🏢 組織ID: {ctx.organization_id}")
        logger.info(
            f"💾 出力先: gs://{ctx.output_bucket_name}/{ctx.output_file_path}"
        )

        # Step 1: モード検証とソース準備
        success, gcs_uri, error_details = step1_validate_and_prepare.execute(ctx)
        if not success:
            # 🔍 return 前のデバッグ出力（必須）
            processing_response = response_formatter.processing_error(
                request_id=request_id,
                message="Failed to validate and prepare source",
                details=error_details
            )
            logger.info(f"🔍 Final Response: {json.dumps(processing_response, ensure_ascii=False, indent=2)}")
            return processing_response

        # Step 1b: 書き起こし前の音声ファイル検査（デバッグ用・失敗しても継続）
        step1b_inspect_audio.execute(ctx, gcs_uri)

        # Step 2: Aqua Voice文字起こしリクエスト送信
        success, error_details = step2_submit_transcription.execute(ctx, gcs_uri)
        if not success:
            # 🔍 return 前のデバッグ出力（必須）
            processing_response = response_formatter.processing_error(
                request_id=request_id,
                message="Failed to submit transcription request",
                details=error_details
            )
            logger.info(f"🔍 Final Response: {json.dumps(processing_response, ensure_ascii=False, indent=2)}")
            return processing_response

        # Step 3: Gemini段落整形処理
        enable_formatting = validated_data.input.enableParagraphFormatting
        success, paragraph_text, paragraph_count, error_details = (
            step3_format_paragraphs.execute(
                ctx,
                {},
                enable_formatting,
            )
        )
        # Step 3は失敗しても継続（error_detailsは記録のみ）
        if error_details:
            logger.warning(f"⚠️ 段落整形処理で警告: {error_details}")

        # Step 4: 結果をGCSに保存
        success, gcs_path, error_details = step4_save_to_gcs.execute(
            ctx, paragraph_text
        )
        if not success:
            # 🔍 return 前のデバッグ出力（必須）
            storage_response = response_formatter.storage_error(
                request_id=request_id,
                message="Failed to save transcription result to GCS",
                details=error_details
            )
            logger.info(f"🔍 Final Response: {json.dumps(storage_response, ensure_ascii=False, indent=2)}")
            return storage_response

        # 処理時間計算
        processing_time = time.time() - start_time
        logger.info(f"⏱️ 処理時間: {processing_time:.1f}秒")

        # レスポンス構築（TypeScript RequestDocのoutput型定義に完全準拠）
        # ⚠️ CloudRunはPython内部でsnake_caseだが、ResponseFormatter.success()でcamelCaseに変換
        result = {
            "transcriptionPath": gcs_path,  # ✅ camelCase（CloudRun変換後）
            "transcriptionBucketName": error_details.get("bucket_name", ""),  # ✅ camelCase
            "transcriptionFilePath": error_details.get("file_path", ""),  # ✅ camelCase
            "transcriptionId": ctx.transcription_id,  # ✅ camelCase
            "processingTime": round(processing_time, 1),  # ✅ camelCase
            "statistics": {
                "characterCount": ctx.statistics.get("character_count"),  # ✅ camelCase
                "language": ctx.statistics.get("language"),
                "languageConfidence": ctx.statistics.get("language_confidence"),  # ✅ camelCase
                "durationSeconds": ctx.statistics.get("duration_seconds")  # ✅ camelCase
            } if ctx.statistics else None
        }

        if paragraph_count is not None:
            result["paragraphCount"] = paragraph_count  # ✅ camelCase

        logger.info(f"✅ 文字起こし完了: {request_id}")

        # ✅ CORRECT: Cloud Runは`output`キーで結果を返却（規約準拠）
        # 規約: Cloud Runのレスポンス構造はTypeScript RequestDocの`output`型定義の単一情報源
        # 🔍 return 前のデバッグ出力（必須）
        final_response = response_formatter.success(
            request_id=request_id,
            output=result
        )
        logger.info(f"🔍 Final Response: {json.dumps(final_response, ensure_ascii=False, indent=2)}")
        
        return final_response

    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(f"❌ 予期しないエラー: {str(e)}")
        logger.error(f"📍 エラー型: {type(e).__name__}")

        # 🔍 return 前のデバッグ出力（必須）
        error_response = response_formatter.internal_error(
            request_id=request_id,
            message=f"Internal server error: {str(e)}",
            exception_type=type(e).__name__
        )
        logger.info(f"🔍 Final Response: {json.dumps(error_response, ensure_ascii=False, indent=2)}")
        
        return error_response


def _build_context(validated_data: TranscribeRequest) -> RequestContext:
    """
    検証済みデータからRequestContextを構築
    
    params: {
        validated_data: TranscribeRequest - 検証済みリクエストデータ
    }
    
    returns: RequestContext - 構築されたコンテキスト
    """
    ctx = RequestContext()

    # リクエストID
    ctx.request_id = validated_data.request_id

    # 入力パラメータ
    ctx.mode = validated_data.input.mode
    ctx.source_file_bucket_name = validated_data.input.sourceFileBucketName
    ctx.source_file_path = validated_data.input.sourceFilePath
    ctx.output_bucket_name = validated_data.input.outputBucketName
    ctx.output_file_path = validated_data.input.outputFilePath

    # システムメタデータ
    ctx.organization_id = validated_data.systemMetadata.organizationId
    ctx.video_id = validated_data.input.videoId
    ctx.project_id = validated_data.input.projectId
    ctx.logging_collection_id = validated_data.systemMetadata.loggingCollectionId
    ctx.logging_document_id = validated_data.systemMetadata.loggingDocumentId

    return ctx
