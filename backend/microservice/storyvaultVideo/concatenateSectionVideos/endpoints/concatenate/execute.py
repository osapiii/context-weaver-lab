"""
/concatenate エンドポイント実装

各セクション動画を連結して1つの動画を生成し、GCSにアップロードします。
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
from .request_schema import ConcatenateRequest
from .steps import step1_download, step2_process, step3_upload


def handle(ctx: RequestContext):
    """
    /concatenate エンドポイント処理（RequestDoc黄金テンプレート準拠）

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
        logger.start_operation(f"動画連結リクエスト処理 [{ctx.request_id}]")

        # ✅ Pydanticリクエスト検証（黄金テンプレート準拠）
        try:
            validated_request = request_validator.validate_request(
                request_data=ctx.params,
                schema_class=ConcatenateRequest,
                endpoint="/concatenate"
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
                        "endpoint": "/concatenate",
                        "validation_errors": validation_errors
                    }
                }
            }
            logger.info(f"🔍 Final Response: {json.dumps(validation_response_data, ensure_ascii=False, indent=2)}")
            return response_formatter.validation_error(
                request_id=ctx.request_id,
                endpoint="/concatenate",
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
        section_count = len(input_data.get('sectionVideoPaths', []))
        output_file = input_data.get('outputFilePath')
        output_bucket = input_data.get('outputBucketName')

        request_summary = {
            "section_count": section_count,
            "output_file": output_file,
            "output_bucket": output_bucket
        }
        logger.data_analysis("リクエストパラメータ", request_summary)

        # Step 1: ダウンロード
        downloaded_paths = step1_download.execute(ctx)

        # Step 2: 処理（動画連結）
        concatenated_video_info = step2_process.execute(ctx, downloaded_paths)

        # Step 3: アップロード
        upload_result = step3_upload.execute(ctx, concatenated_video_info)

        # 処理時間計算
        total_processing_time = time.time() - request_start_time
        ctx.processing_time = total_processing_time

        # ✅ 成功レスポンス（ResponseFormatter使用）
        logger.complete_operation(f"動画連結リクエスト処理 [{ctx.request_id}]", total_processing_time)

        # ✅ MUST: 成功時のContextデバッグログ出力（return直前）
        logger.info(f"📋 Context dump (success): {ctx.to_json()}")

        # ✅ CORRECT: Cloud Runは`output`キーで結果を返却（規約準拠）
        output_data = {
            "mergedVideoPath": {
                "bucketName": upload_result["bucketName"],
                "filePath": upload_result["filePath"]
            },
            "totalDurationSeconds": round(upload_result["duration"], 2),
            "outputFileSizeBytes": upload_result["sizeBytes"],
            "processingTime": round(total_processing_time, 2),
            "fps": upload_result["fps"],
            "width": upload_result["width"],
            "height": upload_result["height"],
            "hasAudio": upload_result["hasAudio"]
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
        import traceback
        processing_time = time.time() - request_start_time
        tb_str = traceback.format_exc()
        logger.error(f"動画連結リクエスト処理失敗 [{ctx.request_id}]",
                    error=e, processing_time=processing_time)
        logger.error(f"🔍 Traceback (KeyError追跡用):\n{tb_str}")

        # ✅ MUST: エラー時のContextデバッグログ出力（return直前）
        if context.debug_mode:
            logger.error(f"📋 Context dump (error): {ctx.to_json()}")
            logger.error(f"コンテキストダンプ: {context.debug_dump(ctx.request_id)}")

        # 🔍 return 前のデバッグ出力（必須）
        # KeyError等の発生箇所特定のためtracebackをdetailsに含める
        error_details = {
            "exception": type(e).__name__,
            "message": str(e)
        }
        if isinstance(e, KeyError):
            error_details["missing_key"] = str(e).strip("'\"")
            error_details["traceback"] = tb_str
        error_response_data = {
            "status": "error",
            "request_id": ctx.request_id,
            "error": {
                "type": "InternalError",
                "message": "Unexpected server error occurred",
                "details": error_details
            }
        }
        logger.info(f"🔍 Final Response: {json.dumps(error_response_data, ensure_ascii=False, indent=2)}")

        return response_formatter.error(
            request_id=ctx.request_id,
            error_type="InternalError",
            message="Unexpected server error occurred",
            details=error_details,
            status_code=500
        )
