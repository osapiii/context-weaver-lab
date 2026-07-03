import json
import sys
from datetime import datetime
from typing import Any, Dict, Optional

class StructuredLogger:
    def __init__(self, service_name: str = "text-to-speech-service"):
        self.service_name = service_name
        self.context = {}
    
    def _format_log(self, level: str, message: str, **kwargs) -> str:
        """構造化ログフォーマット"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "service": self.service_name,
            "level": level,
            "message": message,
            **kwargs
        }
        return json.dumps(log_entry, ensure_ascii=False)
    
    def _print_log(self, level: str, message: str, **kwargs):
        """ログを出力"""
        formatted_log = self._format_log(level, message, **kwargs)
        
        # レベルに応じた絵文字を追加（開発時の視認性向上）
        emoji_map = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "WARNING": "⚠️",
            "ERROR": "❌",
            "DEBUG": "🔍"
        }
        
        # 開発環境では絵文字付きで表示
        if sys.stdout.isatty():
            emoji = emoji_map.get(level, "📝")
            print(f"{emoji} {message}")
            if kwargs:
                for key, value in kwargs.items():
                    print(f"   {key}: {value}")
        else:
            # 本番環境では構造化ログのみ
            print(formatted_log, file=sys.stderr if level == "ERROR" else sys.stdout)
    
    def info(self, message: str, **kwargs):
        self._print_log("INFO", message, **kwargs)
    
    def success(self, message: str, **kwargs):
        self._print_log("SUCCESS", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        self._print_log("WARNING", message, **kwargs)
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        if error:
            kwargs["error_type"] = type(error).__name__
            kwargs["error_message"] = str(error)
        self._print_log("ERROR", message, **kwargs)
    
    def debug(self, message: str, **kwargs):
        self._print_log("DEBUG", message, **kwargs)
    
    def start_operation(self, operation_name: str):
        """操作開始ログ"""
        self.info(f"🚀 {operation_name}を開始します")
    
    def complete_operation(self, operation_name: str, duration: Optional[float] = None):
        """操作完了ログ"""
        if duration:
            self.success(f"✨ {operation_name}が完了しました", duration_seconds=round(duration, 2))
        else:
            self.success(f"✨ {operation_name}が完了しました")
    
    def api_request(self, method: str, service: str, details: str = ""):
        """API リクエストログ"""
        self.info(f"🌐 {method} {service}", details=details)
    
    def api_response(self, status_code: int, details: str = "", duration_ms: Optional[float] = None):
        """API レスポンスログ"""
        log_data = {"status_code": status_code}
        if details:
            log_data["details"] = details
        if duration_ms:
            log_data["duration_ms"] = round(duration_ms, 1)
        
        if 200 <= status_code < 300:
            self.success(f"📨 APIレスポンス受信", **log_data)
        else:
            self.error(f"📨 APIエラーレスポンス", **log_data)
    
    def data_analysis(self, analysis_type: str, data: Dict[str, Any]):
        """データ分析ログ"""
        self.info(f"📊 {analysis_type}", **data)
    
    def performance_metric(self, metric_name: str, value: float, unit: str = ""):
        """パフォーマンスメトリックログ"""
        self.info(f"⚡ {metric_name}: {value}{unit}")
    
    def configuration_loaded(self, config_type: str, config_data: Dict[str, Any]):
        """設定読み込みログ"""
        self.info(f"⚙️ {config_type}を読み込みました", **config_data)
    
    def file_operation(self, operation: str, file_path: str, size_bytes: Optional[int] = None):
        """ファイル操作ログ"""
        log_data = {"file_path": file_path}
        if size_bytes:
            log_data["size_bytes"] = size_bytes
        self.info(f"📁 ファイル{operation}", **log_data)
    
    def validation_result(self, validation_type: str, is_valid: bool, details: str = ""):
        """バリデーション結果ログ"""
        if is_valid:
            self.success(f"✓ {validation_type}検証成功", details=details)
        else:
            self.error(f"✗ {validation_type}検証失敗", details=details)
    
    def processing_step(self, step_name: str, current: int, total: int):
        """処理ステップログ"""
        self.info(f"📋 {step_name} ({current}/{total})")

# グローバルロガーインスタンス
logger = StructuredLogger("text-to-speech-with-google")