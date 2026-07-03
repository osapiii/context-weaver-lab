"""
/synthesize エンドポイント実装

テキストから音声を生成し、GCSにアップロードします。
RequestDocアーキテクチャ黄金テンプレート準拠（input/systemMetadata構造）。
"""

import time
from localPackages.common.context import RequestContext
from localPackages.common.logger import logger
from localPackages.common import firestore_client
from localPackages.common.request_validator import request_validator, RequestValidationError
from localPackages.common.response_formatter import response_formatter
from .request_schema import SynthesizeRequest
from .steps import step1_generate_audio, step2_upload_audio


def handle(ctx: RequestContext):
    """
    /synthesize エンドポイント処理（RequestDoc黄金テンプレート準拠）

    params: {
        ctx: RequestContext - リクエストコンテキスト
            - ctx.params['request_id']: リクエストID
            - ctx.params['input']: 入力パラメータ
            - ctx.params['systemMetadata']: システムメタデータ
    }

    returns: Flask Response - JSONレスポンス
    """
    from flask import g

    # 重複リクエストの場合、即座にエラーを返す
    if hasattr(g, 'is_duplicate') and g.is_duplicate:
        logger.warning(f"⚠️ 重複リクエストのため処理をスキップ: {ctx.request_id}")
        return response_formatter.error(
            request_id=ctx.request_id,
            error_type="DuplicateRequestError",
            message="Duplicate request detected - request is already being processed",
            details={
                "request_id": ctx.request_id,
                "reason": "Request with this ID is already in progress or completed"
            },
            status_code=409  # 409 Conflict
        )

    request_start_time = time.time()
    logger.info(f"⏱️ [TIMING] Request received: {ctx.request_id}")

    try:
        # ✅ Pydanticリクエスト検証
        validation_start = time.time()
        try:
            validated_request = request_validator.validate_request(
                request_data=ctx.params,
                schema_class=SynthesizeRequest,
                endpoint="/synthesize"
            )
        except RequestValidationError as e:
            validation_elapsed = time.time() - validation_start
            logger.error(
                f"❌ Validation failed ({validation_elapsed:.3f}s): {ctx.request_id}",
                error=e,
            )
            validation_errors = e.to_dict()["validation_errors"]
            return response_formatter.validation_error(
                request_id=ctx.request_id,
                endpoint="/synthesize",
                validation_errors=validation_errors
            )

        validation_elapsed = time.time() - validation_start
        logger.info(f"⏱️ [TIMING] Validation done ({validation_elapsed:.3f}s)")

        # ✅ input/systemMetadataセクションから取得（黄金テンプレート準拠）
        input_data = validated_request.input
        system_metadata = validated_request.systemMetadata

        logger.info(
            f"⏱️ [TIMING] Params set: text={len(input_data.text)}chars, voice={input_data.voiceName}"
        )

        # コンテキストにパラメータを設定
        ctx.text = input_data.text
        ctx.voice_name = input_data.voiceName
        ctx.output_gcs_path = f"gs://{input_data.outputBucketName}/{input_data.outputFilePath}"

        # メタデータ設定（ログ記録用）
        ctx.collection_name = system_metadata.loggingCollectionId
        ctx.document_id = system_metadata.loggingDocumentId

        firestore_client.append_request_log(
            ctx, "🎙️ 音声合成処理を開始します", "info"
        )
        firestore_client.append_request_log(
            ctx, f"📝 テキスト長: {len(input_data.text)}文字 / 音声: {input_data.voiceName}", "info"
        )

        # Step 1: 音声生成（Gemini TTS API）
        tts_start = time.time()
        logger.info(f"⏱️ [TIMING] Step1 TTS start")
        audio_data = step1_generate_audio.execute(ctx)
        tts_elapsed = time.time() - tts_start
        logger.info(f"⏱️ [TIMING] Step1 TTS done ({tts_elapsed:.3f}s)")
        firestore_client.append_request_log(
            ctx, "✅ 音声生成完了（Gemini TTS）", "info"
        )

        # Step 2: GCSアップロード
        gcs_start = time.time()
        logger.info(f"⏱️ [TIMING] Step2 GCS upload start")
        upload_result = step2_upload_audio.execute(ctx, audio_data)
        gcs_elapsed = time.time() - gcs_start
        logger.info(f"⏱️ [TIMING] Step2 GCS upload done ({gcs_elapsed:.3f}s)")
        firestore_client.append_request_log(
            ctx, f"✅ GCSアップロード完了: gs://{input_data.outputBucketName}/{input_data.outputFilePath}", "info"
        )

        # 処理時間計算
        total_processing_time = time.time() - request_start_time
        ctx.processing_time = total_processing_time

        logger.info(
            f"⏱️ [TIMING] Response ready: total={total_processing_time:.3f}s "
            f"(validation={validation_elapsed:.3f}s, TTS={tts_elapsed:.3f}s, GCS={gcs_elapsed:.3f}s)"
        )

        # ✅ CORRECT: Cloud Runは`output`キーで結果を返却（規約準拠）
        # 規約: Cloud Runのレスポンス構造はTypeScript RequestDocの`output`型定義の単一情報源
        # ✅ MUST: TypeScript zodスキーマと完全合致（camelCase形式）
        output_data = {
            "outputPath": ctx.output_gcs_path,  # TypeScript zodスキーマ準拠（camelCase）
            "audioFormat": ctx.metadata.get("audio_format", "WAV"),  # TypeScript zodスキーマ準拠（camelCase）
            "durationSeconds": ctx.audio_duration_seconds,  # TypeScript zodスキーマ準拠（camelCase）
            "fileSizeBytes": ctx.audio_size_bytes,  # TypeScript zodスキーマ準拠（camelCase）
            "voiceUsed": ctx.voice_name,  # TypeScript zodスキーマ準拠（camelCase）
            "processingTime": round(total_processing_time, 2),  # TypeScript zodスキーマ準拠（camelCase）
        }

        firestore_client.append_request_log(
            ctx,
            f"✅ 音声合成完了（処理時間: {total_processing_time:.1f}秒）",
            "info",
        )

        return response_formatter.success(
            request_id=ctx.request_id,
            output=output_data
        )

    except Exception as e:
        processing_time = time.time() - request_start_time
        logger.error(
            f"❌ 処理失敗 [{ctx.request_id}] ({processing_time:.3f}s)",
            error=e,
        )

        # Firestoreにエラーログを追記
        try:
            firestore_client.append_request_log(
                ctx,
                f"❌ エラー: {type(e).__name__} - {str(e)}",
                "error",
            )
        except Exception as log_err:
            logger.warning(f"Firestoreログ追記失敗: {log_err}")

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
