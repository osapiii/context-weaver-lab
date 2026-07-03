"""
/compress エンドポイント実装

動画をダウンロード・圧縮・アップロード・Firestore更新。
RequestDocアーキテクチャ準拠。
"""

import time
import json
from flask import jsonify
from localPackages.common.context import RequestContext, context
from localPackages.common.logger import logger
from localPackages.common.request_validator import request_validator, RequestValidationError
from localPackages.common.response_formatter import response_formatter
from .request_schema import CompressRequest
from .steps import (
    step1_download,
    step2_convert,
    step2_compress,
    step3_upload,
    step4_update_firestore,
)


def handle(ctx: RequestContext):
    """/compress エンドポイント処理"""
    request_start_time = time.time()

    try:
        logger.start_operation(f"動画圧縮リクエスト処理 [{ctx.request_id}]")

        try:
            validated_request = request_validator.validate_request(
                request_data=ctx.params,
                schema_class=CompressRequest,
                endpoint="/compress"
            )
        except RequestValidationError as e:
            logger.error("リクエスト検証失敗", error=e)
            validation_errors = e.to_dict()["validation_errors"]
            return response_formatter.validation_error(
                request_id=ctx.request_id,
                endpoint="/compress",
                validation_errors=validation_errors
            )

        input_data = ctx.get_param("input", {})
        system_metadata = ctx.get_param("systemMetadata", {})
        ctx.collection_name = system_metadata.get("loggingCollectionId")
        ctx.document_id = ctx.get_param("request_id") or system_metadata.get("loggingDocumentId")

        source_file = input_data.get("sourceFilePath")
        source_bucket = input_data.get("sourceBucketName")
        output_bucket = input_data.get("outputBucketName")
        video_id = input_data.get("videoId")
        logger.data_analysis("リクエストパラメータ", {
            "source_file": source_file,
            "source_bucket": source_bucket,
            "output_bucket": output_bucket,
            "video_id": video_id,
        })

        # Step 1: ダウンロード
        input_path = step1_download.execute(ctx)

        # Step 2a: MP4変換（WebM/MKV等の場合。MP4ならスキップ）
        converted_path = step2_convert.execute(ctx, input_path)
        was_converted = converted_path != input_path

        # Step 2b: 圧縮（②を入力に③を生成）
        compressed_path = step2_compress.execute(ctx, converted_path)

        # Step 3: アップロード（③常時、②は変換時のみ）
        compressed_gcs_path, converted_gcs_path = step3_upload.execute(
            ctx,
            compressed_path,
            converted_path,
            source_file,
            upload_converted=was_converted,
        )

        # Step 4: Firestore更新
        step4_update_firestore.execute(ctx, compressed_gcs_path, source_file, converted_gcs_path)

        total_time = time.time() - request_start_time
        ctx.processing_time = total_time
        logger.complete_operation(f"動画圧縮リクエスト処理 [{ctx.request_id}]", total_time)

        output_data = {
            "compressedPath": compressed_gcs_path,
            "originalPath": source_file,
            "convertedPath": converted_gcs_path,
            "videoId": video_id,
            "processingTime": round(total_time, 2),
        }
        return response_formatter.success(
            request_id=ctx.request_id,
            output=output_data,
            processing_time=round(total_time, 2)
        )

    except Exception as e:
        processing_time = time.time() - request_start_time
        logger.error(f"動画圧縮リクエスト処理失敗 [{ctx.request_id}]", error=e, processing_time=processing_time)
        return response_formatter.error(
            request_id=ctx.request_id,
            error_type="InternalError",
            message=str(e),
            details={"exception": type(e).__name__, "message": str(e)},
            status_code=500
        )
