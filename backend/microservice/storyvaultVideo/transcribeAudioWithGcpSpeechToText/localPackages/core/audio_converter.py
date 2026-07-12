"""
音声フォーマット変換モジュール

WebMなどの非対応フォーマットをGladiaがサポートする形式に変換します。
"""

import os
import tempfile
from typing import Optional
from pydub import AudioSegment
from localPackages.common.logger import logger


class AudioConverter:
    """音声フォーマット変換クラス"""

    # Gladiaがサポートする形式
    SUPPORTED_FORMATS = ['aac', 'ac3', 'eac3', 'flac', 'm4a', 'mp2', 'mp3', 'ogg', 'opus', 'wav']

    # 変換先のデフォルトフォーマット
    DEFAULT_TARGET_FORMAT = 'mp3'

    @staticmethod
    def needs_conversion(file_path: str) -> bool:
        """
        ファイルが変換必要かチェック

        Args:
            file_path: ファイルパス

        Returns:
            変換が必要な場合True
        """
        ext = os.path.splitext(file_path)[1].lower().lstrip('.')
        return ext not in AudioConverter.SUPPORTED_FORMATS

    @staticmethod
    def convert_to_supported_format(
        input_path: str,
        target_format: str = DEFAULT_TARGET_FORMAT
    ) -> Optional[str]:
        """
        音声ファイルをサポート形式に変換

        Args:
            input_path: 入力ファイルパス
            target_format: 変換先フォーマット（デフォルト: mp3）

        Returns:
            変換後のファイルパス、失敗時はNone
        """
        try:
            # 入力ファイルの拡張子
            input_ext = os.path.splitext(input_path)[1].lower().lstrip('.')

            logger.info(f"🔄 音声変換開始: {input_ext} → {target_format}")

            # 既にサポート形式の場合はそのまま返す
            if input_ext in AudioConverter.SUPPORTED_FORMATS:
                logger.info(f"✅ {input_ext}は既にサポート形式です")
                return input_path

            # 一時ファイル作成
            with tempfile.NamedTemporaryFile(
                suffix=f'.{target_format}',
                delete=False
            ) as temp_file:
                output_path = temp_file.name

            # pydubで音声を読み込み
            logger.info(f"📂 音声ファイル読み込み中: {input_path}")
            audio = AudioSegment.from_file(input_path)

            # フォーマット変換
            logger.info(f"⚙️ {target_format}形式に変換中...")
            audio.export(
                output_path,
                format=target_format,
                codec='libmp3lame' if target_format == 'mp3' else None
            )

            # ファイルサイズをログ出力
            input_size = os.path.getsize(input_path) / (1024 * 1024)  # MB
            output_size = os.path.getsize(output_path) / (1024 * 1024)  # MB

            logger.info(f"✨ 変換完了: {input_size:.2f}MB → {output_size:.2f}MB")
            logger.info(f"📁 変換後ファイル: {output_path}")

            return output_path

        except Exception as e:
            logger.error(f"❌ 音声変換エラー: {str(e)}")
            return None

    @staticmethod
    def extract_audio_from_video(
        video_path: str,
        output_format: str = 'flac'
    ) -> Optional[str]:
        """
        動画ファイルから音声トラックを抽出

        params: {
            video_path: str - 入力動画ファイルパス,
            output_format: str - 出力音声フォーマット（デフォルト: flac）
        }

        returns: Optional[str] - 抽出された音声ファイルパス、失敗時はNone
        """
        try:
            logger.info(f"🎬 動画ファイルから音声を抽出: {video_path}")

            # 一時ファイル作成
            with tempfile.NamedTemporaryFile(
                suffix=f'.{output_format}',
                delete=False
            ) as temp_file:
                output_path = temp_file.name

            # pydubで動画を読み込み（音声トラックのみ）
            logger.info(f"📂 動画ファイル読み込み中: {video_path}")
            audio = AudioSegment.from_file(video_path)

            # 音声をエクスポート
            logger.info(f"⚙️ {output_format}形式で音声をエクスポート中...")
            audio.export(
                output_path,
                format=output_format
            )

            # ファイルサイズをログ出力
            output_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
            logger.info(f"✨ 音声抽出完了: {output_size:.2f}MB")
            logger.info(f"📁 抽出ファイル: {output_path}")

            return output_path

        except Exception as e:
            logger.error(f"❌ 音声抽出エラー: {str(e)}")
            return None

    @staticmethod
    def convert_to_flac_16k_mono(input_path: str) -> Optional[str]:
        """
        音声ファイルを FLAC 16kHz モノに変換する。
        m4a/AAC などを安定した入力形式に揃えるために使用する。

        params: {
            input_path: str - 入力音声ファイルパス（m4a, mp3, wav 等）
        }
        returns: Optional[str] - 変換後 FLAC の一時ファイルパス、失敗時は None
        """
        try:
            logger.info(f"🔄 GCP用に音声を変換: {input_path} → FLAC 16kHz モノ")
            audio = AudioSegment.from_file(input_path)
            audio_16k_mono = audio.set_frame_rate(16000).set_channels(1)
            with tempfile.NamedTemporaryFile(suffix=".flac", delete=False) as f:
                output_path = f.name
            audio_16k_mono.export(output_path, format="flac")
            logger.info(f"✨ 変換完了: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"❌ FLAC 16kHz 変換エラー: {str(e)}")
            return None

    @staticmethod
    def convert_to_mp3_16k_mono(input_path: str) -> Optional[str]:
        """
        音声ファイルを Aqua Voice 送信用の MP3 16kHz モノに変換する。

        params: {
            input_path: str - 入力音声ファイルパス（m4a, aac, mp3, wav 等）
        }
        returns: Optional[str] - 変換後 MP3 の一時ファイルパス、失敗時は None
        """
        try:
            logger.info(f"🔄 Aqua Voice用に音声を変換: {input_path} → MP3 16kHz モノ")
            audio = AudioSegment.from_file(input_path)
            audio_16k_mono = audio.set_frame_rate(16000).set_channels(1)
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                output_path = f.name
            audio_16k_mono.export(output_path, format="mp3", codec="libmp3lame")
            logger.info(f"✨ 変換完了: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"❌ MP3 16kHz 変換エラー: {str(e)}")
            return None

    @staticmethod
    def cleanup_temp_file(file_path: str) -> None:
        """
        一時ファイルを削除

        params: {
            file_path: str - 削除するファイルパス
        }
        """
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"🗑️ 一時ファイル削除: {file_path}")
        except Exception as e:
            logger.warning(f"⚠️ 一時ファイル削除失敗: {str(e)}")
