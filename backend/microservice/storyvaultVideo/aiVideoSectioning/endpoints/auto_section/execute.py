"""
/auto-section エンドポイント実装

Gemini structuredOutputで動画を分析し、適切なセクションに分割して
動画と音声をカットし、GCSにアップロードします。
RequestDocアーキテクチャ黄金テンプレート準拠（input/systemMetadata構造）。
"""

import time
import json
from flask import jsonify
from google.cloud import firestore
from localPackages.common.context import RequestContext, context
from localPackages.common.logger import logger
from localPackages.common import firestore_client
from localPackages.common.request_validator import request_validator, RequestValidationError
from localPackages.common.response_formatter import response_formatter
from .request_schema import AutoSectionRequest
from .steps import (
    step1_download,
    step2_analyze_with_gemini,
    step3_cut_video_audio,
    step4_upload
)


def _patch_request_doc(ctx: RequestContext, payload: dict):
    if not ctx.collection_name or not ctx.document_id:
        logger.debug("RequestDoc patch skipped because logging path is not configured")
        return
    full_path = f"{ctx.collection_name}/{ctx.document_id}"
    firestore_client.get_client().document(full_path).update({
        **payload,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })


def handle(ctx: RequestContext):
    """
    /auto-section エンドポイント処理（RequestDoc黄金テンプレート準拠）

    params: {
        ctx: RequestContext - リクエストコンテキスト
            - ctx.params['request_id']: リクエストID
            - ctx.params['input']: 入力パラメータ
            - ctx.params['systemMetadata']: システムメタデータ
    }

    returns: Flask Response - JSONレスポンス
    """
    request_start_time = time.time()

    try:
        logger.start_operation(f"AI動画セクション化リクエスト処理 [{ctx.request_id}]")

        # ✅ Pydanticリクエスト検証（黄金テンプレート準拠）
        try:
            validated_request = request_validator.validate_request(
                request_data=ctx.params,
                schema_class=AutoSectionRequest,
                endpoint="/auto-section"
            )
        except RequestValidationError as e:
            logger.error("リクエスト検証失敗", error=e)
            # 🔍 return 前のデバッグ出力（必須）
            validation_errors = e.to_dict()["validation_errors"]
            validation_response_data = {
                "status": "error",
                "request_id": ctx.request_id,
                "error": {
                    "type": "ValidationError",
                    "message": "Request validation failed",
                    "details": {
                        "endpoint": "/auto-section",
                        "validation_errors": validation_errors
                    }
                }
            }
            logger.info(f"🔍 Final Response: {json.dumps(validation_response_data, ensure_ascii=False, indent=2)}")
            return response_formatter.validation_error(
                request_id=ctx.request_id,
                endpoint="/auto-section",
                validation_errors=validation_errors
            )

        # ✅ input/systemMetadataセクションから取得（黄金テンプレート準拠）
        input_data = ctx.get_param('input', {})
        system_metadata = ctx.get_param('systemMetadata', {})

        # ⚠️ Cloud Runはビジネスロジック実行のみ、Status/Logs更新はFirebase Function側の責務
        # Firestoreログ記録用パラメータ設定
        # ペイロードのrequest_id（Firestore docId）を優先。loggingDocumentIdとずれる場合の保険
        ctx.collection_name = system_metadata.get('loggingCollectionId')
        payload_request_id = ctx.get_param('request_id')
        ctx.document_id = payload_request_id or system_metadata.get('loggingDocumentId')

        # リクエストパラメータのサマリー
        source_file = input_data.get('sourceFilePath')
        source_bucket = input_data.get('sourceBucketName')
        output_bucket = input_data.get('outputBucketName')
        video_id = input_data.get('videoId')
        project_id = input_data.get('projectId')

        request_summary = {
            "source_file": source_file,
            "source_bucket": source_bucket,
            "output_bucket": output_bucket,
            "video_id": video_id,
            "project_id": project_id
        }
        logger.data_analysis("リクエストパラメータ", request_summary)

        # Step 1: ダウンロード
        video_path = step1_download.execute(ctx)

        # Step 2: Gemini分析（GCS URIを直接使用）
        video_gcs_uri = f"gs://{source_bucket}/{source_file}"
        sectioning_prompt = input_data.get("sectioningPrompt") or None
        sections = step2_analyze_with_gemini.execute(
            ctx, video_gcs_uri, user_prompt=sectioning_prompt
        )

        # Step 3: 動画・音声カット
        segments = step3_cut_video_audio.execute(ctx, video_path, sections)

        # Step 4: アップロード
        upload_results = step4_upload.execute(ctx, segments)

        # 処理時間計算
        total_processing_time = time.time() - request_start_time
        ctx.processing_time = total_processing_time

        # ✅ 成功レスポンス（ResponseFormatter使用）
        logger.complete_operation(f"AI動画セクション化リクエスト処理 [{ctx.request_id}]", total_processing_time)

        # ✅ MUST: 成功時のContextデバッグログ出力（return直前）
        logger.info(f"📋 Context dump (success): {ctx.to_json()}")

        # ✅ CORRECT: Cloud Runは`output`キーで結果を返却（規約準拠）
        # 規約: Cloud Runのレスポンス構造はTypeScript RequestDocの`output`型定義の単一情報源
        # ✅ Cloud Run側で完全に整形しきる（Firebase BGでの再整形を不要にする）
        formatted_sections = []
        for upload_result in upload_results:
            formatted_sections.append({
                'sectionId': upload_result['sectionId'],
                'index': upload_result['index'],
                'startTime': upload_result['startTime'],
                'endTime': upload_result['endTime'],
                'title': upload_result.get('title'),
                'videoSegment': upload_result.get('videoSegment', {}),
                'audioSegment': upload_result.get('audioSegment', {}),
            })

        # 無効区間防止: startTime >= endTime の section はレスポンスから除外
        original_count = len(formatted_sections)
        formatted_sections = [
            s for s in formatted_sections
            if s['startTime'] < s['endTime']
        ]
        if len(formatted_sections) < original_count:
            logger.info(
                f"Excluded sections with startTime >= endTime from response: "
                f"{original_count} -> {len(formatted_sections)}"
            )
        if not formatted_sections:
            raise ValueError(
                "No valid sections after filtering (all had startTime >= endTime)"
            )

        output_data = {
            "sections": formatted_sections,
            "apiRequestId": ctx.request_id,
            "processingTime": round(total_processing_time, 2)
        }
        _patch_request_doc(ctx, {
            "status": "completed",
            "output": output_data,
        })

        # 🔍 return 前のデバッグ出力（必須）
        final_response_data = {
            "status": "success",
            "request_id": ctx.request_id,
            "output": output_data,
            "processing_time": round(total_processing_time, 2)
        }
        logger.info(f"🔍 Final Response: {json.dumps(final_response_data, ensure_ascii=False, indent=2)}")

        # ✅ MUST: ResponseFormatter.success()を使用（camelCase変換込み）
        return response_formatter.success(
            request_id=ctx.request_id,
            output=output_data,
            processing_time=round(total_processing_time, 2)
        )

    except Exception as e:
        processing_time = time.time() - request_start_time
        logger.error(f"AI動画セクション化リクエスト処理失敗 [{ctx.request_id}]",
                    error=e, processing_time=processing_time)
        try:
            _patch_request_doc(ctx, {
                "status": "error",
                "errorMessage": str(e)[:2000],
            })
        except Exception as patch_error:
            logger.error("RequestDoc error status patch failed", error=patch_error)

        # ✅ MUST: エラー時のContextデバッグログ出力（return直前）
        if context.debug_mode:
            logger.error(f"📋 Context dump (error): {ctx.to_json()}")
            logger.error(f"コンテキストダンプ: {context.debug_dump(ctx.request_id)}")

        # 🔍 return 前のデバッグ出力（必須）
        error_response_data = {
            "status": "error",
            "request_id": ctx.request_id,
            "error": {
                "type": "InternalError",
                "message": "Unexpected server error occurred",
                "details": {
                    "exception": type(e).__name__,
                    "message": str(e)
                }
            }
        }
        logger.info(f"🔍 Final Response: {json.dumps(error_response_data, ensure_ascii=False, indent=2)}")

        return response_formatter.error(
            request_id=ctx.request_id,
            error_type="InternalError",
            message="Unexpected server error occurred",
            details={
                "exception": type(e).__name__,
                "message": str(e)
            },
            status_code=500
        )
