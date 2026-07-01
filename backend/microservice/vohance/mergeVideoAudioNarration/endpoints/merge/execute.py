"""
/merge エンドポイント実装

動画と音声ナレーションをタイムスタンプベースで合成します。
RequestDoc黄金テンプレート準拠
"""

import time
from flask import request, jsonify, g
from pydantic import ValidationError
from localPackages.common.logger import logger
from localPackages.common.response_formatter import ResponseFormatter
from localPackages.common import firestore_client
from .request_schema import ProcessRequest, ProcessResponse, MergeOutput, MergeStatistics
from steps.download import download_files
from steps.merge_audio import merge_audio_with_video
from steps.upload import upload_to_gcs


def _log_final_response(label: str, response_tuple) -> None:
    """Flask Response tupleをJSON化しようとして二次エラーを起こさないための軽量ログ。"""
    try:
        response, status_code = response_tuple
        payload = response.get_json(silent=True) if hasattr(response, "get_json") else None
        logger.info(f"🔍 {label}: status={status_code}, payload={payload}")
    except Exception as log_error:
        logger.warning(f"⚠️ {label} のログ出力に失敗しました: {str(log_error)}")


def handle(flask_request):
    """
    POST /merge エンドポイント処理

    params:
        flask_request: Flask request object

    returns:
        Flask Response - JSONレスポンス (ProcessResponse)
    """
    request_start_time = time.time()
    request_id = g.get('request_id', 'unknown')
    ctx = g.get('request_context')

    logger.start_operation(f"動画・音声マージ処理 (request_id: {request_id})")

    try:
        # 1. リクエストデータの取得とPydanticバリデーション
        request_data = flask_request.get_json()
        if not request_data:
            logger.error("リクエストボディが空です")
            # 🔍 return 前のデバッグ出力（必須）
            empty_body_response = ResponseFormatter.error(
                message="Request body is required",
                status_code=400,
                request_id=request_id
            )
            _log_final_response("Final Response", empty_body_response)
            return empty_body_response

        try:
            process_request = ProcessRequest(**request_data)
            logger.info(f"✅ リクエストバリデーション成功: {process_request.request_id}")

            # Firestoreログ記録: 処理開始
            if ctx and process_request.systemMetadata:
                ctx.collection_name = process_request.systemMetadata.loggingCollectionId
                ctx.document_id = process_request.systemMetadata.loggingDocumentId
                firestore_client.log_processing_progress(
                    ctx=ctx,
                    message="動画・音声マージ処理を開始しました",
                    log_type="info",
                    current_step="validation"
                )
        except ValidationError as e:
            # payloadNotSet 対策: フィールド単位のエラー詳細をログ出力
            logger.error(f"❌ バリデーションエラー: {e}")
            logger.error(f"❌ ValidationError.errors(): {e.errors()}")
            logger.error(
                f"❌ request_data サマリ: keys={list(request_data.keys()) if isinstance(request_data, dict) else 'N/A'}, "
                f"input_type={type(request_data.get('input')).__name__ if isinstance(request_data, dict) else 'N/A'}, "
                f"systemMetadata_type={type(request_data.get('systemMetadata')).__name__ if isinstance(request_data, dict) else 'N/A'}"
            )
            # 🔍 return 前のデバッグ出力（必須）
            validation_response = ResponseFormatter.error(
                message=f"Validation error: {str(e)}",
                status_code=400,
                request_id=request_id
            )
            _log_final_response("Final Response", validation_response)
            return validation_response

        # 2. ダウンロードステップ
        logger.info("📥 ステップ1: ファイルダウンロード開始")

        # Firestoreログ記録: ダウンロード開始
        if ctx:
            firestore_client.log_processing_progress(
                ctx=ctx,
                message="動画・音声ファイルのダウンロードを開始しました",
                log_type="info",
                current_step="downloading"
            )

        download_result = download_files({
            'video_bucket_name': process_request.input.videoBucketName,
            'video_file_path': process_request.input.videoFilePath,
            'audio_segments': [seg.model_dump() for seg in process_request.input.audioSegments]
        })
        logger.success(f"✅ ダウンロード完了: 動画={download_result['video_local_path']}, 音声={len(download_result['audio_local_paths'])}個")

        # Firestoreログ記録: ダウンロード完了
        if ctx:
            firestore_client.log_processing_progress(
                ctx=ctx,
                message=f"ダウンロード完了（音声: {len(download_result['audio_local_paths'])}個）",
                log_type="info",
                current_step="downloading",
                progress={"downloaded_audio_count": len(download_result['audio_local_paths'])}
            )

        # 3. マージステップ
        logger.info("🎬 ステップ2: 動画・音声マージ開始")

        # Firestoreログ記録: マージ開始
        if ctx:
            firestore_client.log_processing_progress(
                ctx=ctx,
                message="動画と音声のマージ処理を開始しました",
                log_type="info",
                current_step="merging"
            )

        merge_result = merge_audio_with_video({
            'video_path': download_result['video_local_path'],
            'audio_segments_with_paths': download_result['audio_segments_with_paths'],
            'output_path': download_result['output_local_path']
        })
        logger.success(f"✅ マージ完了: {merge_result['output_path']}")

        # Firestoreログ記録: マージ完了
        if ctx:
            firestore_client.log_processing_progress(
                ctx=ctx,
                message="マージ処理が完了しました",
                log_type="info",
                current_step="merging"
            )

        # 3. アップロードステップ
        logger.info("📤 ステップ3: GCSアップロード開始")

        # Firestoreログ記録: アップロード開始
        if ctx:
            firestore_client.log_processing_progress(
                ctx=ctx,
                message="マージ済み動画のGCSアップロードを開始しました",
                log_type="info",
                current_step="uploading"
            )

        upload_result = upload_to_gcs({
            'local_path': merge_result['output_path'],
            'bucket_name': process_request.input.outputBucketName,
            'file_path': process_request.input.outputFilePath
        })
        logger.success(f"✅ アップロード完了: gs://{upload_result['bucket_name']}/{upload_result['file_path']}")

        # Firestoreログ記録: アップロード完了
        if ctx:
            firestore_client.log_processing_progress(
                ctx=ctx,
                message=f"アップロード完了: gs://{upload_result['bucket_name']}/{upload_result['file_path']}",
                log_type="info",
                current_step="uploading"
            )

        # 5. ProcessResponse生成
        processing_time = time.time() - request_start_time

        # 統計情報の計算
        output_file_size = upload_result.get('file_size')
        
        statistics = MergeStatistics(
            totalAudioSegments=len(process_request.input.audioSegments),
            totalDurationSeconds=None,  # 動画の長さを取得する場合は追加
            outputFileSizeBytes=output_file_size
        )

        output = MergeOutput(
            resultBucketName=upload_result['bucket_name'],
            resultFilePath=upload_result['file_path'],
            processingTime=processing_time,
            statistics=statistics
        )

        response = ProcessResponse(
            output=output,
            processing_time=processing_time
        )

        # Firestoreログ記録: 処理完了（resultsのみ記録、statusは更新しない）
        if ctx:
            firestore_client.log_processing_progress(
                ctx=ctx,
                message=f"動画・音声マージ処理が完了しました（処理時間: {processing_time:.2f}秒）",
                log_type="info",
                results={
                    "resultBucketName": upload_result['bucket_name'],
                    "resultFilePath": upload_result['file_path'],
                    "processingTime": processing_time
                }
            )

        logger.complete_operation(f"動画・音声マージ処理完了 (処理時間: {processing_time:.2f}秒)")

        # ✅ CORRECT: Cloud Runは`output`キーで結果を返却（規約準拠）
        # 規約: Cloud Runのレスポンス構造はTypeScript RequestDocの`output`型定義の単一情報源
        # ✅ CRITICAL: response.outputのみ（MergeOutput）を渡す。ProcessResponse全体は渡さない
        output_data = response.output.model_dump()

        # ✅ ResponseFormatter.success()に統一
        final_response = ResponseFormatter.success(
            request_id=request_id,
            output=output_data
        )
        logger.info(f"🔍 Final Response output: {output_data}")

        return final_response

    except FileNotFoundError as e:
        logger.error(f"❌ ファイル不存在エラー: {str(e)}", error=e)

        # Firestoreログ記録: エラー（statusは更新しない、logsのみ）
        if ctx:
            firestore_client.log_processing_progress(
                ctx=ctx,
                message=f"ファイル不存在エラー: {str(e)}",
                log_type="error",
                error=str(e)
            )

        # ✅ ResponseFormatter使用
        file_not_found_response = ResponseFormatter.error(
            message=f"File not found: {str(e)}",
            status_code=404,
            request_id=request_id,
            error_type="FileNotFoundError"
        )
        _log_final_response("Final Response", file_not_found_response)

        return file_not_found_response

    except Exception as e:
        logger.error(f"❌ マージ処理エラー: {str(e)}", error=e)

        # Firestoreログ記録: エラー（statusは更新しない、logsのみ）
        if ctx:
            firestore_client.log_processing_progress(
                ctx=ctx,
                message=f"マージ処理エラー: {str(e)}",
                log_type="error",
                error=str(e)
            )

        # ✅ ResponseFormatter使用
        processing_error_response = ResponseFormatter.error(
            message=f"Merge processing failed: {str(e)}",
            status_code=500,
            request_id=request_id,
            error_type="ProcessingError"
        )
        _log_final_response("Final Response", processing_error_response)

        return processing_error_response
