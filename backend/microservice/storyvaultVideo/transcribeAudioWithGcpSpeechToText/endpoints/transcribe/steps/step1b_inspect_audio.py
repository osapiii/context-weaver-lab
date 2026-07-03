"""
Step 1b: 書き起こし前の音声ファイル検査（デバッグ用）

GCS上の音声ファイルのサイズ・長さなどをログ出力し、
書き起こし失敗の原因切り分けに利用します。
Step 1 の直後・Step 2 の直前に実行されます。
"""

import os
import tempfile
from typing import Dict, Any, Tuple
from localPackages.common.logger import logger
from localPackages.common.context import RequestContext
from localPackages.common import gcs_storage


def execute(ctx: RequestContext, gcs_uri: str) -> Tuple[bool, Dict[str, Any]]:
    """
    書き起こし前の音声ファイル情報を取得してログ出力する。
    失敗しても処理は継続する（デバッグ用のため）。

    params: {
        ctx: RequestContext - リクエストコンテキスト,
        gcs_uri: str - GCS URI (gs://bucket/path)
    }

    returns: Tuple[bool, Dict[str, Any]] - (成功フラグ, エラー詳細)
    """
    logger.start_operation("step1b_inspect_audio")

    try:
        # GCS blob のメタデータ取得（ファイルサイズ）
        client = gcs_storage.get_client()
        bucket = client.bucket(ctx.source_file_bucket_name)
        blob = bucket.blob(ctx.source_file_path)
        blob.reload()

        file_size_bytes = blob.size if blob.size is not None else 0
        content_type = getattr(blob, "content_type", None) or "unknown"

        logger.info(
            f"📊 [書き起こし前] GCSファイル情報: gs://{ctx.source_file_bucket_name}/{ctx.source_file_path}"
        )
        logger.info(f"   - ファイルサイズ: {file_size_bytes} bytes ({file_size_bytes / 1024:.2f} KB)")
        logger.info(f"   - Content-Type: {content_type}")

        # 拡張子
        ext = (ctx.source_file_path or "").lower().split(".")[-1] if "." in (ctx.source_file_path or "") else ""
        logger.info(f"   - 拡張子: {ext or '(なし)'}")

        duration_seconds = None
        temp_path = None

        if file_size_bytes == 0:
            logger.warning("⚠️ [書き起こし前] ファイルサイズが 0 byte です。書き起こし結果が空になる可能性があります。")
            logger.complete_operation("step1b_inspect_audio", success=True)
            return True, {}

        # 一時ファイルにダウンロードして pydub で長さを取得
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(ctx.source_file_path)[1] or ".bin") as f:
                temp_path = f.name

            ok = gcs_storage.download_file_from_gcs(
                ctx.source_file_bucket_name,
                ctx.source_file_path,
                temp_path,
            )
            if not ok:
                logger.warning("⚠️ [書き起こし前] ダウンロード失敗のため音声長の取得をスキップしました。")
                logger.complete_operation("step1b_inspect_audio", success=True)
                return True, {}

            from pydub import AudioSegment

            audio = AudioSegment.from_file(temp_path)
            duration_seconds = len(audio) / 1000.0  # pydub はミリ秒
            channels = audio.channels
            frame_rate = audio.frame_rate

            logger.info(f"   - 音声長（自前計測）: {duration_seconds:.2f} 秒")
            logger.info(f"   - チャンネル数: {channels}, サンプルレート: {frame_rate} Hz")

            if duration_seconds <= 0:
                logger.warning("⚠️ [書き起こし前] 音声長が 0 秒以下です。GCP が 0 秒と返す原因の可能性があります。")

        except Exception as e:
            logger.warning(
                f"⚠️ [書き起こし前] 音声長の取得に失敗（処理は継続）: {type(e).__name__}: {e}"
            )
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as e:
                    logger.warning(f"⚠️ 一時ファイル削除失敗: {e}")

        logger.complete_operation("step1b_inspect_audio", success=True)
        return True, {}

    except Exception as e:
        # デバッグ用のため失敗しても処理は継続
        logger.warning(
            f"⚠️ [書き起こし前] step1b_inspect_audio でエラー（処理は継続）: {type(e).__name__}: {e}"
        )
        logger.complete_operation("step1b_inspect_audio", success=False)
        return True, {}  # 成功扱いで次ステップへ
