"""
ダウンロードステップ

GCSから動画ファイルと音声ファイルをダウンロードします。
"""

import os
import tempfile
import time
from typing import List, Dict
from localPackages.common.logger import logger
from localPackages.common import gcs_storage


def download_files(params: dict) -> dict:
    """
    GCSから動画と音声ファイルをダウンロード

    params:
        video_bucket_name: str - 動画ファイルバケット名
        video_file_path: str - 動画ファイルパス
        audio_segments: List[dict] - 音声セグメントリスト

    returns:
        dict - ダウンロード結果
            video_local_path: str - 動画ローカルパス
            audio_local_paths: List[str] - 音声ローカルパスリスト
            audio_segments_with_paths: List[dict] - タイムスタンプ付き音声パス
            output_local_path: str - 出力用一時パス
    """
    video_bucket_name = params['video_bucket_name']
    video_file_path = params['video_file_path']
    audio_segments = params['audio_segments']

    logger.info(f"📥 ダウンロード開始: 動画={video_bucket_name}/{video_file_path}, 音声={len(audio_segments)}個")

    # 一時ディレクトリ作成
    temp_dir = tempfile.mkdtemp(prefix="merge_")
    logger.debug(f"一時ディレクトリ作成: {temp_dir}")

    try:
        # 動画ファイルダウンロード（リトライ付き）
        video_local_path = os.path.join(temp_dir, "input_video.mp4")
        logger.info(f"動画ダウンロード: gs://{video_bucket_name}/{video_file_path}")

        # ファイルパスを修正して再試行
        actual_video_path = _find_actual_file_path(video_bucket_name, video_file_path)
        if actual_video_path != video_file_path:
            logger.info(f"🔄 ファイルパス修正: {video_file_path} → {actual_video_path}")

        success = _download_with_retry({
            'bucket_name': video_bucket_name,
            'file_path': actual_video_path,
            'local_path': video_local_path,
            'max_retries': 3
        })

        if not success:
            raise FileNotFoundError(f"Video file not found: gs://{video_bucket_name}/{actual_video_path}")

        logger.success(f"✅ 動画ダウンロード完了: {video_local_path}")

        # 音声ファイル並列ダウンロード
        audio_local_paths = []
        audio_segments_with_paths = []

        for idx, segment in enumerate(audio_segments):
            audio_bucket = segment['sourceBucketName']
            audio_path = segment['sourceFilePath']
            timestamp_ms = segment['timestampMs']

            audio_local_path = os.path.join(temp_dir, f"audio_{idx}.mp3")
            logger.info(f"音声ダウンロード [{idx+1}/{len(audio_segments)}]: gs://{audio_bucket}/{audio_path}")

            # 音声ファイルパスも修正して再試行
            actual_audio_path = _find_actual_file_path(audio_bucket, audio_path)
            if actual_audio_path != audio_path:
                logger.info(f"🔄 音声ファイルパス修正: {audio_path} → {actual_audio_path}")

            success = _download_with_retry({
                'bucket_name': audio_bucket,
                'file_path': actual_audio_path,
                'local_path': audio_local_path,
                'max_retries': 3
            })

            if not success:
                raise FileNotFoundError(f"Audio file not found: gs://{audio_bucket}/{actual_audio_path}")

            audio_local_paths.append(audio_local_path)
            audio_segments_with_paths.append({
                'local_path': audio_local_path,
                'timestamp_ms': timestamp_ms
            })

        logger.success(f"✅ 全音声ダウンロード完了: {len(audio_local_paths)}個")

        # 出力用一時パス
        output_local_path = os.path.join(temp_dir, "output_merged.mp4")

        return {
            'video_local_path': video_local_path,
            'audio_local_paths': audio_local_paths,
            'audio_segments_with_paths': audio_segments_with_paths,
            'output_local_path': output_local_path,
            'temp_dir': temp_dir
        }

    except Exception as e:
        logger.error(f"❌ ダウンロードエラー: {str(e)}", error=e)
        raise


def _download_with_retry(params: dict) -> bool:
    """
    指数バックオフによるリトライ付きダウンロード

    params:
        bucket_name: str - バケット名
        file_path: str - ファイルパス
        local_path: str - ローカル保存先パス
        max_retries: int - 最大リトライ回数（デフォルト3）

    returns:
        bool - ダウンロード成功フラグ
    """
    bucket_name = params['bucket_name']
    file_path = params['file_path']
    local_path = params['local_path']
    max_retries = params.get('max_retries', 3)

    logger.info(f"🔍 ダウンロード試行開始: gs://{bucket_name}/{file_path}")
    
    # ファイル存在確認（デバッグ用）
    try:
        from localPackages.common import gcs_storage
        # バケット内のファイル一覧を取得してデバッグ情報を出力
        logger.info(f"📋 バケット確認: {bucket_name}")
        logger.info(f"📋 ファイルパス確認: {file_path}")
        
        # ファイル存在確認
        try:
            blob = gcs_storage.get_client().bucket(bucket_name).blob(file_path)
            exists = blob.exists()
            logger.info(f"📋 ファイル存在確認結果: {exists}")
            if not exists:
                # 類似ファイルを検索
                bucket = gcs_storage.get_client().bucket(bucket_name)
                blobs = list(bucket.list_blobs(prefix=os.path.dirname(file_path) if os.path.dirname(file_path) else ""))
                logger.info(f"📋 バケット内の類似ファイル: {[b.name for b in blobs[:10]]}")
        except Exception as debug_error:
            logger.warning(f"⚠️ ファイル存在確認エラー: {str(debug_error)}")
            
    except Exception as e:
        logger.warning(f"⚠️ デバッグ情報取得エラー: {str(e)}")

    retry_delays = [1, 2, 4]  # 指数バックオフ（1s, 2s, 4s）

    for attempt in range(max_retries):
        try:
            gcs_storage.get_client().bucket(bucket_name).blob(file_path).download_to_filename(local_path)
            logger.success(f"✅ ダウンロード成功: gs://{bucket_name}/{file_path}")
            return True

        except Exception as e:
            if attempt < max_retries - 1:
                delay = retry_delays[attempt]
                logger.warning(f"⚠️ ダウンロード失敗 (試行{attempt+1}/{max_retries}): {str(e)}。{delay}秒後にリトライ...")
                time.sleep(delay)
            else:
                logger.error(f"❌ ダウンロード最終失敗 ({max_retries}回試行): {str(e)}")
                return False

    return False


def _find_actual_file_path(bucket_name: str, file_path: str) -> str:
    """
    実際のファイルパスを検索（ファイル名の部分一致で検索）
    
    params:
        bucket_name: str - バケット名
        file_path: str - 元のファイルパス
        
    returns:
        str - 実際のファイルパス（見つからない場合は元のパスを返す）
    """
    try:
        from localPackages.common import gcs_storage
        
        # まず元のパスで存在確認
        blob = gcs_storage.get_client().bucket(bucket_name).blob(file_path)
        if blob.exists():
            return file_path
        
        # ファイル名のみを抽出
        filename = os.path.basename(file_path)
        directory = os.path.dirname(file_path)
        
        logger.info(f"🔍 ファイル検索開始: {filename} in {directory}")
        
        # バケット内のファイルを検索
        bucket = gcs_storage.get_client().bucket(bucket_name)
        
        # ディレクトリ内のファイルを検索
        if directory:
            blobs = list(bucket.list_blobs(prefix=directory))
        else:
            blobs = list(bucket.list_blobs())
        
        # ファイル名の部分一致で検索
        for blob in blobs:
            blob_filename = os.path.basename(blob.name)
            if filename in blob_filename or blob_filename in filename:
                logger.info(f"🎯 類似ファイル発見: {blob.name}")
                return blob.name
        
        # 拡張子を無視して検索
        filename_without_ext = os.path.splitext(filename)[0]
        for blob in blobs:
            blob_filename_without_ext = os.path.splitext(os.path.basename(blob.name))[0]
            if filename_without_ext == blob_filename_without_ext:
                logger.info(f"🎯 拡張子違いファイル発見: {blob.name}")
                return blob.name
        
        logger.warning(f"⚠️ ファイルが見つかりません: {file_path}")
        return file_path
        
    except Exception as e:
        logger.warning(f"⚠️ ファイル検索エラー: {str(e)}")
        return file_path
