"""
アップロードステップ

マージ済み動画をGCSにアップロードします。
"""

import os
import time
import shutil
from localPackages.common.logger import logger
from localPackages.common import gcs_storage


def upload_to_gcs(params: dict) -> dict:
    """
    マージ済み動画をGCSにアップロード

    params:
        local_path: str - ローカルファイルパス
        bucket_name: str - 出力バケット名
        file_path: str - 出力ファイルパス

    returns:
        dict - アップロード結果
            bucket_name: str - バケット名
            file_path: str - ファイルパス
            file_size: int - ファイルサイズ（bytes）
    """
    local_path = params['local_path']
    bucket_name = params['bucket_name']
    file_path = params['file_path']

    logger.info(f"📤 アップロード開始: {local_path} → gs://{bucket_name}/{file_path}")

    try:
        # ファイル存在確認
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Local file not found: {local_path}")

        # ファイルサイズ取得
        file_size = os.path.getsize(local_path)
        logger.info(f"ファイルサイズ: {file_size / (1024*1024):.2f} MB")

        # リトライ付きアップロード
        success = _upload_with_retry({
            'local_path': local_path,
            'bucket_name': bucket_name,
            'destination_blob_name': file_path,
            'max_retries': 3
        })

        if not success:
            raise Exception(f"Upload failed after retries: gs://{bucket_name}/{file_path}")

        logger.success(f"✅ アップロード完了: gs://{bucket_name}/{file_path}")

        # ローカル一時ファイル削除
        _cleanup_local_files(local_path)

        return {
            'bucket_name': bucket_name,
            'file_path': file_path,
            'file_size': file_size
        }

    except Exception as e:
        logger.error(f"❌ アップロードエラー: {str(e)}", error=e)
        # エラー時もクリーンアップ試行
        try:
            _cleanup_local_files(local_path)
        except:
            pass
        raise


def _upload_with_retry(params: dict) -> bool:
    """
    指数バックオフによるリトライ付きアップロード

    params:
        local_path: str - ローカルファイルパス
        bucket_name: str - バケット名
        destination_blob_name: str - GCS保存先パス
        max_retries: int - 最大リトライ回数（デフォルト3）

    returns:
        bool - アップロード成功フラグ
    """
    local_path = params['local_path']
    bucket_name = params['bucket_name']
    destination_blob_name = params['destination_blob_name']
    max_retries = params.get('max_retries', 3)

    retry_delays = [1, 2, 4]  # 指数バックオフ（1s, 2s, 4s）

    for attempt in range(max_retries):
        try:
            # ファイル存在確認（リトライ前）
            if not os.path.exists(local_path):
                logger.error(f"❌ ローカルファイルが存在しません: {local_path}")
                return False

            gcs_storage.get_client().bucket(bucket_name).blob(destination_blob_name).upload_from_filename(local_path)
            return True

        except Exception as e:
            if attempt < max_retries - 1:
                delay = retry_delays[attempt]
                logger.warning(f"⚠️ アップロード失敗 (試行{attempt+1}/{max_retries}): {str(e)}。{delay}秒後にリトライ...")
                time.sleep(delay)
            else:
                logger.error(f"❌ アップロード最終失敗 ({max_retries}回試行): {str(e)}")
                return False

    return False


def _cleanup_local_files(local_path: str):
    """
    ローカル一時ファイルのクリーンアップ

    params:
        local_path: str - ローカルファイルパス
    """
    try:
        # ファイルの親ディレクトリ（一時ディレクトリ全体）を削除
        temp_dir = os.path.dirname(local_path)

        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            logger.info(f"🗑️ 一時ファイルクリーンアップ完了: {temp_dir}")

    except Exception as e:
        logger.warning(f"⚠️ クリーンアップエラー（無視）: {str(e)}")
