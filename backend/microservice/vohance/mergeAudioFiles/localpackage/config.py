import os
import sys
from typing import Optional, Dict, Any
from .logger import logger

class ConfigManager:
    """環境変数とアプリケーション設定を管理するクラス"""
    
    def __init__(self):
        """設定を初期化し、必要な環境変数をバリデーション"""
        logger.info("🔧 ConfigManager初期化開始")
        self._config = {}
        self._load_environment_variables()
        self._validate_configuration()
        logger.info("✅ ConfigManager初期化完了")
    
    def _load_environment_variables(self):
        """環境変数を読み込み、デフォルト値を設定"""
        logger.info("📋 環境変数読み込み開始")
        
        # Google Cloud設定
        self._config.update({
            'GOOGLE_CLOUD_PROJECT': os.environ.get('GOOGLE_CLOUD_PROJECT', 'vohance-dev'),
            'GOOGLE_CLOUD_REGION': os.environ.get('GOOGLE_CLOUD_REGION', 'asia-northeast1'),
        })
        
        # サービス設定
        self._config.update({
            'SERVICE_NAME': os.environ.get('SERVICE_NAME', 'mergeAudioFiles'),
            'PORT': int(os.environ.get('PORT', 8080)),
            'DEBUG_MODE': os.environ.get('DEBUG_MODE', 'false').lower() == 'true',
            'LOG_LEVEL': os.environ.get('LOG_LEVEL', 'INFO'),
        })
        
        # 音声処理設定
        self._config.update({
            'MAX_FILE_COUNT': int(os.environ.get('MAX_FILE_COUNT', 50)),
            'MAX_BUFFER_SECONDS': float(os.environ.get('MAX_BUFFER_SECONDS', 30.0)),
            'MAX_TOTAL_DURATION_MINUTES': int(os.environ.get('MAX_TOTAL_DURATION_MINUTES', 60)),
            'SUPPORTED_FORMATS': os.environ.get('SUPPORTED_FORMATS', 'mp3,wav,m4a,aac,ogg,flac').split(','),
            'OUTPUT_BITRATE': os.environ.get('OUTPUT_BITRATE', '192k'),
            'TEMP_DIR': os.environ.get('TEMP_DIR', '/tmp/audio_merge'),
        })
        
        # 制限設定
        self._config.update({
            'MAX_RETRY_ATTEMPTS': int(os.environ.get('MAX_RETRY_ATTEMPTS', 3)),
            'REQUEST_TIMEOUT_SECONDS': int(os.environ.get('REQUEST_TIMEOUT_SECONDS', 300)),  # 5分
        })
        
        logger.info("✅ 環境変数読み込み完了")
        self._log_configuration()
    
    def _log_configuration(self):
        """設定内容をログに出力（機密情報は除く）"""
        logger.info("📊 現在の設定:")
        logger.info(f"  🏷️  サービス名: {self._config['SERVICE_NAME']}")
        logger.info(f"  🌐 プロジェクト: {self._config['GOOGLE_CLOUD_PROJECT']}")
        logger.info(f"  📍 リージョン: {self._config['GOOGLE_CLOUD_REGION']}")
        logger.info(f"  🔒 ポート: {self._config['PORT']}")
        logger.info(f"  🐛 デバッグモード: {self._config['DEBUG_MODE']}")
        logger.info(f"  📜 ログレベル: {self._config['LOG_LEVEL']}")
        logger.info(f"  📁 一時ディレクトリ: {self._config['TEMP_DIR']}")
        logger.info(f"  🎵 最大ファイル数: {self._config['MAX_FILE_COUNT']}")
        logger.info(f"  ⏱️ 最大バッファ: {self._config['MAX_BUFFER_SECONDS']}秒")
        logger.info(f"  🕒 最大総再生時間: {self._config['MAX_TOTAL_DURATION_MINUTES']}分")
        logger.info(f"  🎼 対応フォーマット: {', '.join(self._config['SUPPORTED_FORMATS'])}")
        logger.info(f"  🎚️ 出力ビットレート: {self._config['OUTPUT_BITRATE']}")
    
    def _validate_configuration(self):
        """設定の妥当性をチェック"""
        logger.info("🔍 設定バリデーション開始")
        
        # 必須項目のチェック
        required_configs = ['GOOGLE_CLOUD_PROJECT', 'SERVICE_NAME']
        missing_configs = []
        
        for config_key in required_configs:
            if not self._config.get(config_key):
                missing_configs.append(config_key)
        
        if missing_configs:
            error_msg = f"❌ 必須設定が不足しています: {', '.join(missing_configs)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # 数値設定の範囲チェック
        if not (1 <= self._config['MAX_FILE_COUNT'] <= 100):
            logger.error("❌ MAX_FILE_COUNT は 1-100 の範囲で設定してください")
            raise ValueError("Invalid MAX_FILE_COUNT value")
        
        if not (0.1 <= self._config['MAX_BUFFER_SECONDS'] <= 60.0):
            logger.error("❌ MAX_BUFFER_SECONDS は 0.1-60.0 の範囲で設定してください")
            raise ValueError("Invalid MAX_BUFFER_SECONDS value")
        
        if not (1 <= self._config['MAX_TOTAL_DURATION_MINUTES'] <= 240):
            logger.error("❌ MAX_TOTAL_DURATION_MINUTES は 1-240 の範囲で設定してください")
            raise ValueError("Invalid MAX_TOTAL_DURATION_MINUTES value")
        
        logger.info("✅ 設定バリデーション完了")
    
    def get(self, key: str, default: Any = None) -> Any:
        """設定値を取得"""
        return self._config.get(key, default)
    
    def is_debug_mode(self) -> bool:
        """デバッグモードかどうかを判定"""
        return self._config['DEBUG_MODE']
    
    def get_audio_limits(self) -> Dict[str, Any]:
        """音声処理制限を取得"""
        return {
            'max_file_count': self._config['MAX_FILE_COUNT'],
            'max_buffer_seconds': self._config['MAX_BUFFER_SECONDS'],
            'max_total_duration_minutes': self._config['MAX_TOTAL_DURATION_MINUTES'],
            'supported_formats': self._config['SUPPORTED_FORMATS'],
            'output_bitrate': self._config['OUTPUT_BITRATE']
        }
    
    def validate_startup_environment(self):
        """サービス起動時の環境チェック"""
        logger.info("🚀 起動時環境チェック開始")
        
        # 一時ディレクトリの作成
        temp_dir = self._config['TEMP_DIR']
        try:
            os.makedirs(temp_dir, exist_ok=True)
            logger.info(f"📁 一時ディレクトリ確認完了: {temp_dir}")
        except Exception as e:
            logger.error(f"❌ 一時ディレクトリ作成失敗: {temp_dir}", error=e)
            raise
        
        # ポート設定の確認
        port = self._config['PORT']
        if port < 1024 and os.getuid() != 0:
            logger.warning(f"⚠️ ポート {port} は特権ポートです。権限エラーが発生する可能性があります")
        
        logger.info("✅ 起動時環境チェック完了")
    
    def get_service_info(self) -> Dict[str, Any]:
        """サービス情報を取得"""
        return {
            'service_name': self._config['SERVICE_NAME'],
            'project_id': self._config['GOOGLE_CLOUD_PROJECT'],
            'region': self._config['GOOGLE_CLOUD_REGION'],
            'debug_mode': self._config['DEBUG_MODE'],
            'port': self._config['PORT'],
            'audio_limits': self.get_audio_limits()
        }

# グローバル設定インスタンス
try:
    config = ConfigManager()
    logger.info("🎉 グローバル設定インスタンス作成完了")
except Exception as e:
    logger.error(f"💥 設定初期化エラー: {str(e)}")
    logger.error("🚨 サービスを開始できません。環境変数を確認してください。")
    sys.exit(1)