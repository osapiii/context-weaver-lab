import logging
import json
import traceback
import os
from datetime import datetime
from typing import Dict, Any, Optional

class EnhancedStructuredLogger:
    def __init__(self, name="mergeAudioFiles"):
        self.service_name = name
        self.logger = logging.getLogger(name)
        
        # 環境変数からログレベルを取得
        log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
        self.logger.setLevel(getattr(logging, log_level, logging.INFO))
        
        # デバッグモードの判定
        self.debug_mode = os.environ.get('DEBUG_MODE', 'false').lower() == 'true'
        
        # コンソールハンドラー設定
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter('%(message)s'))
            self.logger.addHandler(handler)
        
        # 初期化完了ログ
        self.info(f"🎯 ログシステム初期化完了 - レベル: {log_level}, デバッグモード: {self.debug_mode}")
    
    def _format_message(self, level: str, message: str, **kwargs) -> str:
        """構造化ログメッセージをJSON形式で作成"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "severity": level,
            "message": message,
            "service": self.service_name
        }
        
        # 追加のキーワード引数を含める
        if kwargs:
            log_entry.update(kwargs)
            
        return json.dumps(log_entry, ensure_ascii=False, indent=2 if self.debug_mode else None)
    
    def info(self, message: str, **kwargs):
        """INFOレベルのログを出力"""
        self.logger.info(self._format_message("INFO", message, **kwargs))
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """ERRORレベルのログを出力"""
        if error:
            kwargs.update({
                "error_type": type(error).__name__,
                "error_message": str(error),
                "traceback": traceback.format_exc() if self.debug_mode else None
            })
        
        self.logger.error(self._format_message("ERROR", message, **kwargs))
    
    def warning(self, message: str, **kwargs):
        """WARNINGレベルのログを出力"""
        self.logger.warning(self._format_message("WARNING", message, **kwargs))
    
    def debug(self, message: str, **kwargs):
        """DEBUGレベルのログを出力"""
        self.logger.debug(self._format_message("DEBUG", message, **kwargs))
    
    def success(self, message: str, **kwargs):
        """成功ログ（INFOレベル、緑色の絵文字付き）"""
        self.info(f"✅ {message}", **kwargs)
    
    def start_operation(self, operation: str, **kwargs):
        """操作開始ログ"""
        self.info(f"🚀 {operation} を開始します", operation=operation, **kwargs)
    
    def complete_operation(self, operation: str, duration_seconds: Optional[float] = None, **kwargs):
        """操作完了ログ"""
        if duration_seconds:
            self.info(f"🎉 {operation} が完了しました (所要時間: {duration_seconds:.2f}秒)", 
                     operation=operation, duration_seconds=duration_seconds, **kwargs)
        else:
            self.info(f"🎉 {operation} が完了しました", operation=operation, **kwargs)
    
    def file_operation(self, operation: str, file_path: str, size_bytes: Optional[int] = None, **kwargs):
        """ファイル操作ログ"""
        size_info = f" ({size_bytes} bytes)" if size_bytes else ""
        self.info(f"📁 ファイル{operation}: {file_path}{size_info}", 
                 operation=operation, file_path=file_path, size_bytes=size_bytes, **kwargs)
    
    def audio_processing(self, operation: str, file_count: int = None, duration_ms: int = None, **kwargs):
        """音声処理ログ"""
        details = []
        if file_count is not None:
            details.append(f"ファイル数: {file_count}")
        if duration_ms is not None:
            details.append(f"長さ: {duration_ms/1000:.1f}秒")
        
        detail_str = f" ({', '.join(details)})" if details else ""
        self.info(f"🎵 音声{operation}{detail_str}", 
                 operation=operation, file_count=file_count, duration_ms=duration_ms, **kwargs)
    
    def processing_step(self, step: str, current: int, total: int, **kwargs):
        """処理ステップログ"""
        progress = f"({current}/{total})"
        self.info(f"⚙️ {step} {progress}", step=step, current=current, total=total, **kwargs)
    
    def data_analysis(self, description: str, data_info: Dict[str, Any], **kwargs):
        """データ分析ログ"""
        self.info(f"📊 {description}", data_info=data_info, **kwargs)
    
    def performance_metric(self, metric_name: str, value: float, unit: str = "", **kwargs):
        """パフォーマンスメトリクスログ"""
        self.info(f"⚡ {metric_name}: {value}{unit}", 
                 metric_name=metric_name, value=value, unit=unit, **kwargs)
    
    def validation_result(self, validation_type: str, success: bool, details: Optional[str] = None, **kwargs):
        """バリデーション結果ログ"""
        emoji = "✅" if success else "❌"
        status = "成功" if success else "失敗"
        message = f"{emoji} {validation_type} バリデーション{status}"
        if details:
            message += f": {details}"
        
        if success:
            self.info(message, validation_type=validation_type, success=success, **kwargs)
        else:
            self.error(message, validation_type=validation_type, success=success, **kwargs)
    
    def configuration_loaded(self, config_name: str, config_values: Dict[str, Any], **kwargs):
        """設定読み込みログ"""
        # 機密情報をマスク
        safe_config = {}
        for key, value in config_values.items():
            if any(secret_key in key.lower() for secret_key in ['key', 'token', 'secret', 'password']):
                safe_config[key] = f"{str(value)[:4]}***" if value else "未設定"
            else:
                safe_config[key] = value
        
        self.info(f"⚙️ {config_name} 設定読み込み完了", 
                 config_name=config_name, config_values=safe_config, **kwargs)

# グローバルロガーインスタンス
logger = EnhancedStructuredLogger()