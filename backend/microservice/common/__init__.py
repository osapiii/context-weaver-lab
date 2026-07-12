"""
CloudRun Microservice Common Module

Unified, DRY-compliant common modules for all CloudRun microservices.

Core Modules:
- logger: Unified logging (Cloud Logging + Firestore) with custom emoji support
- schemas: Standardized request metadata and response structures
- request_validation: Request validation helpers and error formatting
- parent_path_creator: Multi-tenant path generation for Firestore and GCS

External Service Clients (Phase 2):
- gcs_storage: Unified GCS operations (unified from 23 services)
- firestore: Unified Firestore client management (ClientManager singleton)
- bigquery: Unified BigQuery client management (ClientManager singleton)

Design Principles:
1. DRY: Single source of truth (consolidates ~9,000 lines from 25 services)
2. Multi-tenant: organizationId/spaceId isolation throughout
3. Type safety: Pydantic models for all request/response structures
4. Error resilience: Silent failures on non-critical operations (e.g., Firestore logging)
5. Backward compatibility: Deprecated functions retained for smooth migration

Usage Examples:

    # Logging with custom emoji
    from common import Logger
    logger = Logger(
        service_name="report-generator",
        operation_metadata=request.metadata.dict()
    )
    logger.info("Processing started", emoji="🚀")
    logger.error("Connection failed", emoji="❌")

    # Request validation
    from common import validate_operation_metadata_required_fields
    is_valid, error = validate_operation_metadata_required_fields(metadata)

    # Standardized paths
    from common import ParentPathCreator
    path = ParentPathCreator.returnParentOrgSpaceFirestorePath(
        "org_123", "space_456", "documents/reports"
    )

Version: 1.0
Status: Phase 1 Complete (Core modules) - Phase 2 Pending (External service clients)
"""

# Core Logging
from .logger import (
    Logger,
    setup_logger,  # Deprecated
    LogMessage,  # Deprecated
    add_log_to_cloud_logging,  # Deprecated
)

# Metadata and Schemas
from .schemas import (
    StandardOperationMetadata,
    ExtendedOperationMetadata,
    OperationMetadata,  # Alias
    OperationMetadataBase,  # Alias
    RequestedBy,
    BaseRequest,
    BaseResponse,
    GcsMetadata,
)

# Request Validation
from .request_validation import (
    validate_operation_metadata_required_fields,
    validate_firestore_logging_metadata,
    validate_and_parse_operation_metadata,
    extract_organization_id,
    extract_space_id,
    extract_request_id,
    extract_user_id,
    format_validation_errors,
    handle_validation_error,
    create_metadata_from_request,
)

# Path Generation
from .parent_path_creator import ParentPathCreator

# External Service Clients (Phase 2)
from .gcs_storage import (
    get_storage_client,
    download_blob_to_file,
    download_blob_as_bytes,
    download_blob_as_text,
    upload_file_to_gcs,
    upload_bytes_to_gcs,
    upload_string_to_gcs,
    upload_bytes_to_gcs_async,
    download_blob_as_bytes_async,
    batch_upload_files,
    blob_exists,
    get_blob_metadata,
    delete_blob,
    list_blobs,
    validate_gcs_path,
    construct_gcs_url,
    # Backward compatibility
    upload_to_gcs,
    download_from_gcs,
)

from .firestore import (
    FirestoreClientManager,
    get_firestore_client,
    get_firestore_manager,
)

from .bigquery import (
    BigQueryClientManager,
    get_bigquery_client,
    get_bigquery_manager,
)

# Response Formatting and Utilities
from .response_formatter import ResponseFormatter
from .case_converter import to_camel_case, convert_keys_to_camel_case

# Logger Compatibility Layer (backward compatibility functions)
from .logger_compat import (
    log_request,
    log_response,
    log_error,
    log_validation_error,
)

# Unified Architecture (Phase 3 - Execution Context and Initialization)
from .context import ExecutionContext
from .errors import (
    MicroserviceError,
    StepExecutionError,
    FatalStepError,
    RecoverableStepError,
    ValidationError as MicroserviceValidationError,
    InitializationError,
    ResourceAccessError,
    BigQueryError,
    GCSError,
    FirestoreError,
    TimeoutError as MicroserviceTimeoutError,
    RetryExhaustedError,
    ExternalServiceError,
    LLMProxyError,
    EmailServiceError,
    classify_error,
    should_retry,
    log_error_with_context,
)
from .initializer import (
    initialize,
    initialize_with_error_handling,
    validate_request,
    create_test_context,
)

# ============================================================================
# Public API
# ============================================================================

__all__ = [
    # Logger
    "Logger",
    "setup_logger",  # Deprecated
    "LogMessage",  # Deprecated
    "add_log_to_cloud_logging",  # Deprecated
    # Logger Compatibility Functions (module-level)
    "log_request",  # Backward compatibility
    "log_response",  # Backward compatibility
    "log_error",  # Backward compatibility
    "log_validation_error",  # Backward compatibility
    # Schemas
    "StandardOperationMetadata",
    "ExtendedOperationMetadata",
    "OperationMetadata",  # Alias
    "OperationMetadataBase",  # Alias
    "RequestedBy",
    "BaseRequest",
    "BaseResponse",
    "GcsMetadata",
    # Validation
    "validate_operation_metadata_required_fields",
    "validate_firestore_logging_metadata",
    "validate_and_parse_operation_metadata",
    "extract_organization_id",
    "extract_space_id",
    "extract_request_id",
    "extract_user_id",
    "format_validation_errors",
    "handle_validation_error",
    "create_metadata_from_request",
    # Path Creation
    "ParentPathCreator",
    # GCS Storage
    "get_storage_client",
    "download_blob_to_file",
    "download_blob_as_bytes",
    "download_blob_as_text",
    "upload_file_to_gcs",
    "upload_bytes_to_gcs",
    "upload_string_to_gcs",
    "upload_bytes_to_gcs_async",
    "download_blob_as_bytes_async",
    "batch_upload_files",
    "blob_exists",
    "get_blob_metadata",
    "delete_blob",
    "list_blobs",
    "validate_gcs_path",
    "construct_gcs_url",
    "upload_to_gcs",  # Deprecated
    "download_from_gcs",  # Deprecated
    # Firestore
    "FirestoreClientManager",
    "get_firestore_client",
    "get_firestore_manager",
    # BigQuery
    "BigQueryClientManager",
    "get_bigquery_client",
    "get_bigquery_manager",
    # Response Formatting and Utilities
    "ResponseFormatter",
    "to_camel_case",
    "convert_keys_to_camel_case",
    # Unified Architecture (Phase 3)
    "ExecutionContext",
    "MicroserviceError",
    "StepExecutionError",
    "FatalStepError",
    "RecoverableStepError",
    "MicroserviceValidationError",
    "InitializationError",
    "ResourceAccessError",
    "BigQueryError",
    "GCSError",
    "FirestoreError",
    "MicroserviceTimeoutError",
    "RetryExhaustedError",
    "ExternalServiceError",
    "LLMProxyError",
    "EmailServiceError",
    "classify_error",
    "should_retry",
    "log_error_with_context",
    "initialize",
    "initialize_with_error_handling",
    "validate_request",
    "create_test_context",
]

__version__ = "1.1.0"
__phase__ = "3"
__phase_description__ = "Phase 3: Unified Architecture with ExecutionContext, Error Hierarchy, and Initialization Factory"
