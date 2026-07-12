"""
Logger Compatibility Layer - Backward Compatibility Functions

Provides module-level logger functions for services migrating from old logger implementation.
These functions wrap the new Logger class for easy backward compatibility.

Old API (deprecated but still supported):
    from logger import logger, log_request, log_response, log_error

New API (recommended):
    from common import Logger
    logger = Logger(service_name="my-service")

This module ensures old code continues to work without modification.
"""

import logging
import os
from typing import Optional, Any, Dict, List
from datetime import datetime

# Get or create module-level logger for backward compatibility
logger = logging.getLogger(__name__)

# Configure basic logging if not already configured
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


def setup_logger(service_name: Optional[str] = None) -> logging.Logger:
    """
    Legacy function for setting up logger.

    DEPRECATED: Use Logger class from common module instead.

    Args:
        service_name: Service name for logging identification

    Returns:
        logging.Logger instance

    Example:
        # Old way (deprecated)
        logger = setup_logger("my-service")
        logger.info("Message")

        # New way (recommended)
        from common import Logger
        logger = Logger(service_name="my-service")
        logger.info("Message", emoji="📝")
    """
    return logger


def log_request(
    request_id: str,
    method: str,
    path: str,
    client_host: Optional[str] = None,
    **extra
) -> None:
    """
    Log incoming request details.

    DEPRECATED: Use Logger class instead.

    Args:
        request_id: Unique request identifier
        method: HTTP method (GET, POST, etc.)
        path: Request path
        client_host: Client IP address
        **extra: Additional logging fields

    Example:
        log_request(
            request_id="req_123",
            method="POST",
            path="/list-datasets",
            client_host="192.168.1.1"
        )
    """
    log_data = {
        "event_type": "request_received",
        "request_id": request_id,
        "method": method,
        "path": path,
        "client_host": client_host,
    }
    log_data.update(extra)

    logger.info(
        f"📥 Request received: {method} {path}",
        extra=log_data
    )


def log_response(
    request_id: str,
    status_code: int,
    duration: float,
    **extra
) -> None:
    """
    Log response details.

    DEPRECATED: Use Logger class instead.

    Args:
        request_id: Unique request identifier
        status_code: HTTP status code
        duration: Request processing time in seconds
        **extra: Additional logging fields

    Example:
        log_response(
            request_id="req_123",
            status_code=200,
            duration=0.523
        )
    """
    emoji = "✅" if 200 <= status_code < 300 else "⚠️" if 300 <= status_code < 400 else "❌"

    log_data = {
        "event_type": "response_sent",
        "request_id": request_id,
        "status_code": status_code,
        "duration_seconds": round(duration, 3),
    }
    log_data.update(extra)

    logger.info(
        f"{emoji} Response: {status_code} (Duration: {duration:.3f}s)",
        extra=log_data
    )


def log_error(
    request_id: str,
    error: Exception,
    endpoint: Optional[str] = None,
    request_data: Optional[Dict[str, Any]] = None,
    **extra
) -> None:
    """
    Log error details.

    DEPRECATED: Use Logger class instead.

    Args:
        request_id: Unique request identifier
        error: Exception that occurred
        endpoint: API endpoint where error occurred
        request_data: Request data that caused error
        **extra: Additional logging fields

    Example:
        try:
            # some operation
        except Exception as e:
            log_error(
                request_id="req_123",
                error=e,
                endpoint="/list-datasets"
            )
    """
    log_data = {
        "event_type": "error_occurred",
        "request_id": request_id,
        "error_type": type(error).__name__,
        "error_message": str(error),
        "endpoint": endpoint,
        "request_data": request_data,
    }
    log_data.update(extra)

    logger.error(
        f"❌ Error occurred: {type(error).__name__}: {str(error)}",
        extra=log_data,
        exc_info=True
    )


def log_validation_error(
    request_id: str,
    errors: List[Dict[str, Any]],
    raw_request: Optional[Dict[str, Any]] = None,
    **extra
) -> None:
    """
    Log validation errors.

    DEPRECATED: Use Logger class instead.

    Args:
        request_id: Unique request identifier
        errors: List of validation error dicts from Pydantic
        raw_request: Original request data
        **extra: Additional logging fields

    Example:
        log_validation_error(
            request_id="req_123",
            errors=[
                {"field": "organizationId", "message": "field required"}
            ]
        )
    """
    log_data = {
        "event_type": "validation_error",
        "request_id": request_id,
        "error_count": len(errors),
        "validation_errors": errors,
        "raw_request": raw_request,
    }
    log_data.update(extra)

    logger.warning(
        f"⚠️ Validation error: {len(errors)} field(s) failed validation",
        extra=log_data
    )


class LogMessage:
    """
    Legacy LogMessage class for backward compatibility.

    DEPRECATED: Use Logger class instead.

    This class is provided for services that used the old LogMessage
    dataclass pattern. The new Logger class provides better functionality.
    """

    def __init__(
        self,
        request_id: str,
        message: str,
        level: str = "info",
        emoji: str = "📝",
        **extra
    ):
        self.request_id = request_id
        self.message = message
        self.level = level
        self.emoji = emoji
        self.extra = extra
        self.timestamp = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            "timestamp": self.timestamp.isoformat(),
            "request_id": self.request_id,
            "message": self.message,
            "level": self.level,
            "emoji": self.emoji,
            **self.extra
        }


def add_log_to_cloud_logging(log_entry: LogMessage) -> None:
    """
    Add log entry to Cloud Logging.

    DEPRECATED: Use Logger class instead.

    Args:
        log_entry: LogMessage instance to log

    Example:
        log_entry = LogMessage(
            request_id="req_123",
            message="Processing started",
            emoji="🚀"
        )
        add_log_to_cloud_logging(log_entry)
    """
    level_map = {
        "debug": logger.debug,
        "info": logger.info,
        "warning": logger.warning,
        "error": logger.error,
        "critical": logger.critical
    }

    log_func = level_map.get(log_entry.level.lower(), logger.info)
    log_func(
        f"{log_entry.emoji} {log_entry.message}",
        extra=log_entry.to_dict()
    )
