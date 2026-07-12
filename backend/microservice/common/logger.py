"""
Unified Logger Module for CloudRun Microservices

Provides integrated logging to both Google Cloud Logging and Firestore with:
- Multi-tenant support (organizationId/spaceId isolation)
- Firestore logs array integration (optional, based on operationMetadata)
- Custom emoji support for message categorization
- Silent failure on Firestore errors (Cloud Logging continues)
- Dynamic service name from environment variable

Complies with: DOC_06_RequestDoc_OperationMetadata共通型ガイドライン

Usage:
    # Cloud Logging only (no operationMetadata)
    logger = Logger(service_name="report-generator")
    logger.info("Task started", emoji="🚀")

    # Cloud Logging + Firestore logs array
    logger = Logger(
        service_name="report-generator",
        operation_metadata={
            "organizationId": "org_123",
            "spaceId": "space_456",
            "loggingCollectionId": "requests/reportRequests",
            "loggingDocumentId": "req_abc123"
        }
    )
    logger.info("Processing complete", emoji="✅")
    # → logs array in Firestore + Cloud Logging
"""

import os
import logging
import traceback
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from google.cloud import logging as cloud_logging
from google.cloud import firestore

from .parent_path_creator import ParentPathCreator


class LogEntry(BaseModel):
    """Log entry structure for Firestore logs array"""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    emoji: str
    message: str
    level: Literal["info", "warn", "error", "debug"] = "info"
    service: str


class Logger:
    """
    Unified logger for CloudRun microservices with Cloud Logging and optional Firestore integration.

    Design Principles:
    - Instance-based management (one logger per request context)
    - operationMetadata passed at initialization (not per-log call)
    - Firestore enabled only when loggingCollectionId and loggingDocumentId are present
    - Silent failure on Firestore errors (Cloud Logging continues)
    - Custom emoji per log message
    """

    def __init__(
        self,
        service_name: Optional[str] = None,
        operation_metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize Logger instance.

        Args:
            service_name: Name of the service (used for Cloud Logging identification).
                         If None, uses SERVICE_NAME environment variable.
                         If neither available, defaults to "unknown-service".
            operation_metadata: Dict with keys:
                - organizationId (required for Firestore)
                - spaceId (required for Firestore)
                - loggingCollectionId (required for Firestore - collection path)
                - loggingDocumentId (required for Firestore - document id)
                If both loggingCollectionId and loggingDocumentId present, Firestore logging enabled.

        Raises:
            ValueError: If operation_metadata provided but missing required fields for Firestore
        """
        # Determine service name
        self.service_name = service_name or os.getenv("SERVICE_NAME", "unknown-service")

        # Store operation metadata
        self.operation_metadata = operation_metadata or {}

        # Initialize Cloud Logging client
        try:
            cloud_logging_client = cloud_logging.Client()
            self.cloud_logger = cloud_logging_client.logger(self.service_name)
        except Exception as e:
            # Fallback to Python logging if Cloud Logging fails
            logging.warning(f"Failed to initialize Cloud Logging: {e}")
            self.cloud_logger = None

        # Determine if Firestore logging is enabled
        self.firestore_enabled = (
            self.operation_metadata.get("loggingCollectionId")
            and self.operation_metadata.get("loggingDocumentId")
            and self.operation_metadata.get("organizationId")
        )

        # Initialize Firestore client if needed
        self.firestore_client = None
        if self.firestore_enabled:
            try:
                self.firestore_client = firestore.Client()
            except Exception as e:
                # Silent fail - Firestore will be skipped but Cloud Logging continues
                logging.warning(f"Failed to initialize Firestore client: {e}")
                self.firestore_enabled = False

    def log(
        self,
        message: str,
        emoji: str = "📝",
        level: Literal["info", "warn", "error", "debug"] = "info",
        exc_info: bool = False,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Send log to both Cloud Logging and optionally Firestore.

        Args:
            message: Log message content
            emoji: Custom emoji for visual categorization (default: 📝)
            level: Log level - info/warn/error/debug (default: info)
            exc_info: If True, append current exception traceback to message (default: False)
            extra: Additional metadata dict to include in log entry (default: None)

        Example:
            logger.log("Processing started", emoji="🚀", level="info")
            logger.log("Connection failed", emoji="❌", level="error")
            logger.log("Error occurred", emoji="❌", level="error", exc_info=True)
            logger.log("Request processed", extra={"request_id": "123", "status": "success"})
        """
        # Append traceback if exc_info=True
        full_message = message
        if exc_info:
            tb_str = traceback.format_exc()
            full_message = f"{message}\n{tb_str}"

        # Always send to Cloud Logging
        self._send_to_cloud_logging(full_message, emoji, level, extra=extra)

        # Optionally send to Firestore
        if self.firestore_enabled:
            self._append_to_firestore_logs(full_message, emoji, level)

    def info(self, message: str, emoji: str = "ℹ️", exc_info: bool = False, extra: Optional[Dict[str, Any]] = None) -> None:
        """Send info level log with custom emoji (default: ℹ️)"""
        self.log(message, emoji=emoji, level="info", exc_info=exc_info, extra=extra)

    def warn(self, message: str, emoji: str = "⚠️", exc_info: bool = False, extra: Optional[Dict[str, Any]] = None) -> None:
        """Send warning level log with custom emoji (default: ⚠️)"""
        self.log(message, emoji=emoji, level="warn", exc_info=exc_info, extra=extra)

    def error(self, message: str, emoji: str = "❌", exc_info: bool = False, extra: Optional[Dict[str, Any]] = None) -> None:
        """Send error level log with custom emoji (default: ❌)

        Args:
            message: Error message
            emoji: Custom emoji (default: ❌)
            exc_info: If True, append current exception traceback (default: False)
            extra: Additional metadata dict to include in log entry (default: None)
        """
        self.log(message, emoji=emoji, level="error", exc_info=exc_info, extra=extra)

    def debug(self, message: str, emoji: str = "🔍", exc_info: bool = False, extra: Optional[Dict[str, Any]] = None) -> None:
        """Send debug level log with custom emoji (default: 🔍)"""
        self.log(message, emoji=emoji, level="debug", exc_info=exc_info, extra=extra)

    def _send_to_cloud_logging(
        self,
        message: str,
        emoji: str,
        level: Literal["info", "warn", "error", "debug"],
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Send log to Google Cloud Logging.

        Maps Python log levels to Cloud Logging severity levels.

        Args:
            message: Log message
            emoji: Custom emoji for visual categorization
            level: Log level
            extra: Additional metadata dict to include in log entry
        """
        if not self.cloud_logger:
            # Fallback to console if Cloud Logger unavailable
            severity_map = {
                "info": "INFO",
                "warn": "WARNING",
                "error": "ERROR",
                "debug": "DEBUG",
            }
            print(f"[{severity_map.get(level, 'INFO')}] {emoji} {message}")
            return

        try:
            # Map Python log levels to Cloud Logging severity
            severity_map = {
                "info": "INFO",
                "warn": "WARNING",
                "error": "ERROR",
                "debug": "DEBUG",
            }
            severity = severity_map.get(level, "INFO")

            # Create structured log entry
            log_entry = {
                "message": message,
                "emoji": emoji,
                "level": level,
                "service": self.service_name,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            # Merge extra metadata if provided
            if extra and isinstance(extra, dict):
                log_entry.update(extra)

            # Send to Cloud Logging
            self.cloud_logger.log_struct(log_entry, severity=severity)

        except Exception as e:
            # Silent fail for Cloud Logging errors
            logging.warning(f"Failed to send log to Cloud Logging: {e}")

    def _append_to_firestore_logs(
        self,
        message: str,
        emoji: str,
        level: Literal["info", "warn", "error", "debug"],
    ) -> None:
        """
        Append log to Firestore logs array in the request document.

        Uses Firestore ArrayUnion to safely append to logs array.
        Silently fails if Firestore operations fail (Cloud Logging continues).

        Path structure:
            organizations/{orgId}/{loggingCollectionId}/{loggingDocumentId}
        """
        if not self.firestore_client or not self.firestore_enabled:
            return

        try:
            org_id = self.operation_metadata.get("organizationId")
            collection_id = self.operation_metadata.get("loggingCollectionId")
            doc_id = self.operation_metadata.get("loggingDocumentId")

            if not all([org_id, collection_id, doc_id]):
                logging.warning("Missing required metadata fields for Firestore logging")
                return

            # Generate Firestore path using ParentPathCreator
            firestore_path = ParentPathCreator.returnParentOrgFirestorePath(
                organizationId=org_id,
                path=f"{collection_id}/{doc_id}"
            )

            # Create log entry
            log_entry = {
                "timestamp": datetime.now(timezone.utc),
                "emoji": emoji,
                "message": message,
                "level": level,
                "service": self.service_name,
            }

            # Append to logs array using ArrayUnion
            self.firestore_client.document(firestore_path).update(
                {
                    "logs": firestore.ArrayUnion([log_entry])
                }
            )

        except Exception as e:
            # Silent fail: Firestore error doesn't affect Cloud Logging
            # Log the error only to Python logging for debugging
            logging.warning(f"Failed to append log to Firestore: {e}")


# ============================================================================
# Backward Compatibility Functions (Deprecated)
# ============================================================================

def setup_logger(
    service_name: Optional[str] = None,
    operation_metadata: Optional[Dict[str, Any]] = None
) -> Logger:
    """
    DEPRECATED: Use Logger class directly instead.

    Backward compatibility wrapper for legacy code.

    Example:
        logger = setup_logger("report-generator")
        logger.info("Started", emoji="🚀")
    """
    return Logger(service_name=service_name, operation_metadata=operation_metadata)


class LogMessage(BaseModel):
    """
    DEPRECATED: Use Logger.log() with emoji parameter instead.

    Legacy LogMessage structure for backward compatibility.
    """
    type: Literal["info", "warn", "error", "debug"]
    message: str


def add_log_to_cloud_logging(
    log_message: LogMessage,
    add_console_log: bool = True
) -> None:
    """
    DEPRECATED: Use Logger class directly instead.

    Legacy function for backward compatibility.
    """
    level = log_message.type
    logger = Logger(service_name=os.getenv("SERVICE_NAME", "unknown-service"))

    if add_console_log:
        print(f"[Cloud Logging] {log_message.message}")

    logger.log(
        message=log_message.message,
        emoji="📝",
        level=level
    )


# ============================================================================
# Module Initialization
# ============================================================================

# Set up Python logging for fallback/debugging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
