"""
/split エンドポイント実装

動画を指定されたタイムスタンプで分割し、GCSにアップロードします。
RequestDocアーキテクチャ黄金テンプレート準拠（input/systemMetadata構造）。
"""

import time
import json
from flask import jsonify
from localPackages.common.context import RequestContext, context
from localPackages.common.logger import logger
from localPackages.common import firestore_client
from localPackages.common.request_validator import request_validator, RequestValidationError
from localPackages.common.response_formatter import response_formatter
from .request_schema import SplitRequest
from .steps import step1_download, step2_process, step3_upload


def handle(ctx: RequestContext):
    """
    /split エンドポイント処理（RequestDoc黄金テンプレート準拠）

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
        logger.start_operation(f"動画分割リクエスト処理 [{ctx.request_id}]")

        # ✅ Pydanticリクエスト検証（黄金テンプレート準拠）
        try:
            validated_request = request_validator.validate_request(
                request_data=ctx.params,
                schema_class=SplitRequest,
                endpoint="/split"
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
                        "endpoint": "/split",
                        "validation_errors": validation_errors
                    }
                }
            }
            logger.info(f"🔍 Final Response: {json.dumps(validation_response_data, ensure_ascii=False, indent=2)}")
            return response_formatter.validation_error(
                request_id=ctx.request_id,
                endpoint="/split",
                validation_errors=validation_errors
            )

        # ✅ input/systemMetadataセクションから取得（黄金テンプレート準拠）
        input_data = ctx.get_param('input', {})
        system_metadata = ctx.get_param('systemMetadata', {})

        # ⚠️ Cloud Runはビジネスロジック実行のみ、Status/Logs更新はFirebase Function側の責務
        # Firestoreログ記録用パラメータ設定（デバッグ目的のみ）
        ctx.collection_name = system_metadata.get('loggingCollectionId')
        ctx.document_id = system_metadata.get('loggingDocumentId')

        # リクエストパラメータのサマリー
        source_file = input_data.get('sourceFilePath')
        source_bucket = input_data.get('sourceBucketName')
        output_bucket = input_data.get('outputBucketName')
        cutoff_seconds = input_data.get('cutoffSeconds', [])

        request_summary = {
            "source_file": source_file,
            "source_bucket": source_bucket,
            "output_bucket": output_bucket,
            "segments_count": len(cutoff_seconds) + 1,
            "cutoff_points": cutoff_seconds
        }
        logger.data_analysis("リクエストパラメータ", request_summary)

        # Step 1: ダウンロード
        video_data = step1_download.execute(ctx)

        # Step 2: 処理（動画分割）
        segments = step2_process.execute(ctx, video_data)

        # Step 3: アップロード
        upload_results = step3_upload.execute(ctx, segments)

        # 処理時間計算
        total_processing_time = time.time() - request_start_time
        ctx.processing_time = total_processing_time

        # ✅ 成功レスポンス（ResponseFormatter使用）
        logger.complete_operation(f"動画分割リクエスト処理 [{ctx.request_id}]", total_processing_time)

        # ✅ MUST: 成功時のContextデバッグログ出力（return直前）
        logger.info(f"📋 Context dump (success): {ctx.to_json()}")

        # ✅ CORRECT: Cloud Runは`output`キーで結果を返却（規約準拠）
        # 規約: Cloud Runのレスポンス構造はTypeScript RequestDocの`output`型定義の単一情報源
        # ✅ Cloud Run側で完全に整形しきる（Firebase BGでの再整形を不要にする）
        formatted_segments = []
        for upload_result in upload_results:
            formatted_segments.append({
                'segmentNumber': upload_result['segment_number'],
                'startTime': upload_result['start_time'],
                'endTime': upload_result['end_time'],
                'duration': upload_result['duration'],
                'sizeBytes': upload_result['size_bytes'],
                'bucketName': upload_result['bucket_name'],
                'gcsFilePath': upload_result['gcs_file_path'],
                'gcsPath': upload_result['gcs_path'],
            })
        
        output_data = {
            "segments": formatted_segments,
            "totalSegments": len(segments),
            "apiRequestId": ctx.request_id,
            "processingTime": round(total_processing_time, 2)
        }

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
        logger.error(f"動画分割リクエスト処理失敗 [{ctx.request_id}]",
                    error=e, processing_time=processing_time)

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
