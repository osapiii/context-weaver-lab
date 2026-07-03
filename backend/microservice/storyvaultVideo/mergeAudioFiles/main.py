import os
import time
import tempfile
import sys
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import storage
from pydub import AudioSegment
from dotenv import load_dotenv
from typing import List, Dict, Any
import shutil

# 早期に.envファイルを読み込み
logger_debug_info = "🔧 dotenv読み込み試行中..."
try:
    load_dotenv()
    print(f"✅ {logger_debug_info} 成功")
except Exception as e:
    print(f"⚠️ {logger_debug_info} 失敗: {str(e)}")

# ログとコンフィグのインポート（環境変数が読み込まれた後）
try:
    from localpackage.logger import logger
    from localpackage.config import config
    logger.start_operation("アプリケーション初期化")
except Exception as e:
    print(f"❌ ログ/設定システム初期化エラー: {str(e)}")
    sys.exit(1)

# Flaskアプリケーション作成
app = Flask(__name__)

# CORS設定（SwaggerやフロントエンドからのAPIアクセスを許可）
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# サービス情報の取得
service_info = config.get_service_info()
logger.configuration_loaded("サービス情報", service_info)

# 起動時バリデーション
try:
    config.validate_startup_environment()
    logger.success("起動時バリデーション完了")
except Exception as e:
    logger.error("起動時バリデーション失敗", error=e)
    sys.exit(1)

@app.route('/merge-audio', methods=['POST'])
def merge_audio():
    """
    複数の音声ファイルをバッファ間隔で連結し、MP3として出力する
    
    Input:
    {
        "audio_files": ["gs://bucket/audio1.mp3", "gs://bucket/audio2.wav"],
        "buffer_seconds": 2.0,
        "output_gcs_filepath": "gs://bucket/merged_output.mp3"
    }
    
    Output:
    {
        "success": true,
        "output_path": "gs://bucket/merged_output.mp3",
        "processing_time": 15.2,
        "statistics": {
            "total_files": 2,
            "total_duration_seconds": 120.5,
            "output_file_size_bytes": 1024000
        }
    }
    """
    request_start_time = time.time()
    
    try:
        # リクエスト開始ログ
        logger.start_operation("音声ファイル統合リクエスト処理")
        
        # リクエストデータの検証
        data = request.get_json()
        if not data:
            logger.error("JSONデータが提供されていません")
            # 🔍 return 前のデバッグ出力（必須）
            no_data_response = {"error": "No JSON data provided"}
            logger.info(f"🔍 Final Response: {json.dumps(no_data_response, ensure_ascii=False, indent=2)}")
            return jsonify(no_data_response), 400
        
        # パラメータ抽出とログ
        audio_files = data.get('audio_files', [])
        buffer_seconds = data.get('buffer_seconds', 1.0)
        output_gcs_filepath = data.get('output_gcs_filepath')
        
        request_params = {
            "audio_files_count": len(audio_files),
            "audio_files_preview": audio_files[:3] if len(audio_files) <= 3 else audio_files[:3] + ["..."],
            "buffer_seconds": buffer_seconds,
            "output_gcs_filepath": output_gcs_filepath
        }
        logger.data_analysis("リクエストパラメータ", request_params)
        
        # 入力バリデーション
        validation_errors = validate_request_parameters(audio_files, buffer_seconds, output_gcs_filepath)
        if validation_errors:
            logger.validation_result("リクエストパラメータ", False, "; ".join(validation_errors))
            # 🔍 return 前のデバッグ出力（必須）
            validation_error_response = {"error": "Validation failed", "details": validation_errors}
            logger.info(f"🔍 Final Response: {json.dumps(validation_error_response, ensure_ascii=False, indent=2)}")
            return jsonify(validation_error_response), 400
        
        logger.validation_result("リクエストパラメータ", True)
        
        # 音声ファイル統合処理
        result = process_audio_merge(audio_files, buffer_seconds, output_gcs_filepath)
        
        # 処理時間計算
        total_processing_time = time.time() - request_start_time
        logger.performance_metric("総処理時間", total_processing_time, "秒")
        
        # 成功レスポンス
        response_data = {
            "success": True,
            "output_path": output_gcs_filepath,
            "processing_time": round(total_processing_time, 1),
            "statistics": result["statistics"]
        }
        
        logger.complete_operation("音声ファイル統合リクエスト処理", total_processing_time)
        logger.success("リクエスト処理完了", **response_data)
        
        # ✅ CORRECT: Cloud Runは`output`キーで結果を返却（規約準拠）
        # 規約: Cloud Runのレスポンス構造はTypeScript RequestDocの`output`型定義の単一情報源
        output_data = response_data.copy()
        if "processing_time" in output_data:
            del output_data["processing_time"]  # processing_timeは別フィールドに
        
        final_response = {
            "status": "success",
            "request_id": data.get("request_id", "unknown"),
            "output": output_data,
            "processing_time": total_processing_time,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        # 🔍 return 前のデバッグ出力（必須）
        logger.info(f"🔍 Final Response: {json.dumps(final_response, ensure_ascii=False, indent=2)}")
        
        return jsonify(final_response), 200
        
    except Exception as e:
        processing_time = time.time() - request_start_time
        logger.error("音声ファイル統合リクエスト処理失敗", error=e, processing_time=processing_time)
        
        # 🔍 return 前のデバッグ出力（必須）
        error_response = {
            "error": f"Internal server error: {str(e)}",
            "error_type": type(e).__name__
        }
        logger.info(f"🔍 Final Response: {json.dumps(error_response, ensure_ascii=False, indent=2)}")
        
        return jsonify(error_response), 500

def validate_request_parameters(audio_files: List[str], buffer_seconds: float, output_gcs_filepath: str) -> List[str]:
    """リクエストパラメータのバリデーション"""
    errors = []
    
    # 必須パラメータチェック
    if not audio_files:
        errors.append("audio_files is required and cannot be empty")
    elif not isinstance(audio_files, list):
        errors.append("audio_files must be a list")
    
    if not output_gcs_filepath:
        errors.append("output_gcs_filepath is required")
    
    # ファイル数制限チェック
    limits = config.get_audio_limits()
    if len(audio_files) > limits['max_file_count']:
        errors.append(f"Too many files: {len(audio_files)} (max: {limits['max_file_count']})")
    
    # バッファ秒数制限チェック
    if buffer_seconds < 0 or buffer_seconds > limits['max_buffer_seconds']:
        errors.append(f"Invalid buffer_seconds: {buffer_seconds} (range: 0-{limits['max_buffer_seconds']})")
    
    # GCSパス形式チェック
    for i, file_path in enumerate(audio_files):
        if not file_path.startswith('gs://'):
            errors.append(f"Invalid GCS path format for file {i+1}: {file_path}")
    
    if not output_gcs_filepath.startswith('gs://'):
        errors.append(f"Invalid GCS path format for output: {output_gcs_filepath}")
    
    return errors

def process_audio_merge(audio_files: List[str], buffer_seconds: float, output_gcs_filepath: str) -> Dict[str, Any]:
    """音声ファイルの統合処理"""
    logger.start_operation("音声ファイル統合処理")
    
    temp_dir = None
    try:
        # 一時ディレクトリ作成
        temp_dir = tempfile.mkdtemp(prefix="audio_merge_")
        logger.file_operation("一時ディレクトリ作成", temp_dir)
        
        # 音声ファイルをダウンロードして読み込み
        audio_segments = []
        total_duration_ms = 0
        
        for i, gcs_path in enumerate(audio_files, 1):
            logger.processing_step(f"音声ファイル{i}処理", i, len(audio_files))
            
            # GCSからダウンロード
            local_path = download_from_gcs(gcs_path, temp_dir)
            
            # AudioSegmentで読み込み
            try:
                audio_segment = AudioSegment.from_file(local_path)
                audio_segments.append(audio_segment)
                
                duration_ms = len(audio_segment)
                total_duration_ms += duration_ms
                
                logger.audio_processing(f"読み込み完了 (ファイル{i})", 
                                      duration_ms=duration_ms)
                
            except Exception as e:
                logger.error(f"音声ファイル{i}の読み込みに失敗しました", error=e)
                raise
        
        # 総再生時間チェック
        total_duration_minutes = total_duration_ms / (1000 * 60)
        max_duration = config.get_audio_limits()['max_total_duration_minutes']
        if total_duration_minutes > max_duration:
            raise ValueError(f"Total duration too long: {total_duration_minutes:.1f}min (max: {max_duration}min)")
        
        # 音声ファイル統合
        logger.start_operation("音声セグメント統合")
        merged_audio = merge_audio_segments(audio_segments, buffer_seconds)
        logger.complete_operation("音声セグメント統合")
        
        # MP3として一時ファイルに保存
        output_temp_path = os.path.join(temp_dir, "merged_output.mp3")
        bitrate = config.get_audio_limits()['output_bitrate']
        
        logger.start_operation("MP3エクスポート")
        merged_audio.export(
            output_temp_path, 
            format="mp3", 
            bitrate=bitrate
        )
        logger.audio_processing("MP3エクスポート完了", 
                               duration_ms=len(merged_audio))
        logger.complete_operation("MP3エクスポート")
        
        # GCSにアップロード
        upload_to_gcs(output_temp_path, output_gcs_filepath)
        
        # ファイルサイズ取得
        output_file_size = os.path.getsize(output_temp_path)
        
        # 統計情報
        statistics = {
            "total_files": len(audio_files),
            "total_duration_seconds": round(len(merged_audio) / 1000, 1),
            "output_file_size_bytes": output_file_size,
            "buffer_seconds": buffer_seconds,
            "output_bitrate": bitrate
        }
        
        logger.data_analysis("統合結果統計", statistics)
        logger.complete_operation("音声ファイル統合処理")
        
        return {"statistics": statistics}
        
    finally:
        # 一時ディレクトリのクリーンアップ
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                logger.file_operation("一時ディレクトリ削除", temp_dir)
            except Exception as e:
                logger.warning("一時ディレクトリ削除に失敗しました", error=e)

def merge_audio_segments(audio_segments: List[AudioSegment], buffer_seconds: float) -> AudioSegment:
    """AudioSegmentリストをバッファ間隔で統合"""
    logger.audio_processing("音声セグメント統合開始", file_count=len(audio_segments))
    
    if not audio_segments:
        raise ValueError("No audio segments to merge")
    
    if len(audio_segments) == 1:
        return audio_segments[0]
    
    # バッファ（無音）を作成
    buffer_ms = int(buffer_seconds * 1000)
    silence_buffer = AudioSegment.silent(duration=buffer_ms)
    
    # 最初のセグメントから開始
    merged = audio_segments[0]
    
    # 残りのセグメントを順次追加
    for i, segment in enumerate(audio_segments[1:], 2):
        logger.processing_step(f"セグメント{i}統合", i, len(audio_segments))
        
        # バッファ + 次のセグメントを追加
        merged = merged + silence_buffer + segment
    
    final_duration_seconds = len(merged) / 1000
    logger.audio_processing("音声セグメント統合完了", 
                           file_count=len(audio_segments),
                           duration_ms=len(merged))
    
    return merged

def download_from_gcs(gcs_path: str, temp_dir: str) -> str:
    """GCSからファイルをダウンロード"""
    try:
        logger.start_operation("GCSファイルダウンロード")
        logger.file_operation("ダウンロード開始", gcs_path)
        
        # パスを解析
        if not gcs_path.startswith('gs://'):
            raise ValueError(f"Invalid GCS path format: {gcs_path}")
        
        path_parts = gcs_path[5:].split('/', 1)
        bucket_name = path_parts[0]
        blob_name = path_parts[1] if len(path_parts) > 1 else ''
        
        # ローカルファイルパス生成
        filename = os.path.basename(blob_name) or "audio_file"
        local_path = os.path.join(temp_dir, filename)
        
        # GCSクライアント初期化とダウンロード
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        
        # ファイル存在確認
        if not blob.exists():
            raise FileNotFoundError(f"File not found: {gcs_path}")
        
        # ダウンロード実行
        blob.download_to_filename(local_path)
        
        # ファイルサイズ確認
        file_size = os.path.getsize(local_path)
        logger.file_operation("ダウンロード完了", local_path, file_size)
        logger.complete_operation("GCSファイルダウンロード")
        
        return local_path
        
    except Exception as e:
        logger.error("GCSダウンロードエラー", error=e, gcs_path=gcs_path)
        raise

def upload_to_gcs(local_path: str, gcs_path: str):
    """ファイルをGCSにアップロード"""
    try:
        logger.start_operation("GCSファイルアップロード")
        
        # パスを解析
        if not gcs_path.startswith('gs://'):
            raise ValueError(f"Invalid GCS path format: {gcs_path}")
        
        path_parts = gcs_path[5:].split('/', 1)
        bucket_name = path_parts[0]
        blob_name = path_parts[1] if len(path_parts) > 1 else ''
        
        # ファイルサイズ取得
        file_size = os.path.getsize(local_path)
        
        # GCSクライアント初期化とアップロード
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        
        # コンテンツタイプ設定
        blob.content_type = 'audio/mpeg'
        
        # アップロード実行
        blob.upload_from_filename(local_path)
        
        logger.file_operation("アップロード完了", gcs_path, file_size)
        logger.complete_operation("GCSファイルアップロード")
        
    except Exception as e:
        logger.error("GCSアップロードエラー", error=e, 
                    local_path=local_path, gcs_path=gcs_path)
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """ヘルスチェックエンドポイント"""
    logger.start_operation("ヘルスチェック")
    
    try:
        # サービス情報収集
        service_info = config.get_service_info()
        health_info = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "service_info": service_info,
            "environment": {
                "python_version": sys.version.split()[0],
                "debug_mode": config.is_debug_mode(),
                "temp_dir_exists": os.path.exists(config.get('TEMP_DIR'))
            }
        }
        
        logger.data_analysis("ヘルスチェック結果", health_info)
        logger.success("ヘルスチェック完了")
        
        return jsonify(health_info), 200
        
    except Exception as e:
        logger.error("ヘルスチェックエラー", error=e)
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }), 500

if __name__ == "__main__":
    try:
        # サービス開始準備
        logger.start_operation("サービス開始準備")
        
        port = config.get('PORT')
        service_name = config.get('SERVICE_NAME')
        
        startup_info = {
            "service_name": service_name,
            "port": port,
            "host": "0.0.0.0",
            "debug_mode": config.is_debug_mode(),
            "environment": "development" if config.is_debug_mode() else "production"
        }
        logger.configuration_loaded("サービス起動設定", startup_info)
        
        logger.success(f"🎉 {service_name} サービスを開始します")
        logger.info(f"🌐 アクセス URL: http://localhost:{port}")
        logger.info(f"❤️ ヘルスチェック: http://localhost:{port}/health")
        logger.info(f"🎵 音声統合エンドポイント: http://localhost:{port}/merge-audio")
        
        logger.complete_operation("サービス開始準備")
        
        # Flaskアプリケーション開始
        app.run(host="0.0.0.0", port=port, debug=config.is_debug_mode())
        
    except Exception as e:
        logger.error("サービス開始エラー", error=e)
        sys.exit(1)