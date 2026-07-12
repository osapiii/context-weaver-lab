import logging
import json
import time
from datetime import datetime
from typing import Dict


class StructuredLogger:
    def __init__(self, name="transcribeAudioWithGcpSpeechToText"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)

        # コンソールハンドラー設定
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(handler)

        # 操作タイムスタンプ記録用
        self._operation_start_times: Dict[str, float] = {}

    def _format_message(self, level, message, **kwargs):
        """構造化ログメッセージをJSON形式で作成"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "severity": level,
            "message": message,
            "service": "transcribeAudioWithGcpSpeechToText"
        }

        # 追加のキーワード引数を含める
        if kwargs:
            log_entry.update(kwargs)

        return json.dumps(log_entry, ensure_ascii=False)

    def info(self, message, **kwargs):
        """INFOレベルのログを出力"""
        self.logger.info(self._format_message("INFO", message, **kwargs))

    def error(self, message, **kwargs):
        """ERRORレベルのログを出力"""
        self.logger.error(self._format_message("ERROR", message, **kwargs))

    def warning(self, message, **kwargs):
        """WARNINGレベルのログを出力"""
        self.logger.warning(self._format_message("WARNING", message, **kwargs))

    def debug(self, message, **kwargs):
        """DEBUGレベルのログを出力"""
        self.logger.debug(self._format_message("DEBUG", message, **kwargs))

    def success(self, message, **kwargs):
        """成功メッセージをINFOレベルで出力（緑色の絵文字付き）"""
        self.logger.info(self._format_message("INFO", message, **kwargs))

    def start_operation(self, operation_name: str, **kwargs):
        """
        操作の開始をログに記録し、タイムスタンプを保存

        params: {
            operation_name: str - 操作名,
            **kwargs - 追加のログ情報
        }
        """
        self._operation_start_times[operation_name] = time.time()
        self.info(f"🚀 操作開始: {operation_name}", operation=operation_name, **kwargs)

    def complete_operation(
        self,
        operation_name: str,
        success: bool = True,
        **kwargs
    ):
        """
        操作の完了をログに記録し、処理時間を計算

        params: {
            operation_name: str - 操作名,
            success: bool - 成功フラグ,
            **kwargs - 追加のログ情報
        }
        """
        start_time = self._operation_start_times.get(operation_name)
        if start_time:
            duration = time.time() - start_time
            del self._operation_start_times[operation_name]
        else:
            duration = None

        status_emoji = "✅" if success else "❌"
        status_text = "成功" if success else "失敗"

        log_data = {
            "operation": operation_name,
            "success": success,
            **kwargs
        }

        if duration is not None:
            log_data["duration_seconds"] = round(duration, 2)

        message = f"{status_emoji} 操作{status_text}: {operation_name}"
        if duration is not None:
            message += f" ({duration:.2f}秒)"

        if success:
            self.info(message, **log_data)
        else:
            self.error(message, **log_data)


# グローバルロガーインスタンス
logger = StructuredLogger()
