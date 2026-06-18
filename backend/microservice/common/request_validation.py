"""
Request Validation Helper Module for CloudRun Microservices

Provides utility functions for validating request metadata and handling
validation errors in a standardized way.

RESPONSIBILITIES:
- Request payload parsing and validation (empty body, JSON parsing)
- Comprehensive debug logging for validation failures
- Pydantic error mapping and detailed error reporting
- Request structure validation with detailed context

Usage:
    from request_validation import validate_and_parse_request, validate_pydantic_request
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse

    app = FastAPI()

    @app.post("/endpoint")
    async def endpoint(request: Request):
        request_dict, parse_error = await validate_and_parse_request(
            request,
            endpoint="/endpoint"
        )
        if parse_error:
            return JSONResponse(
                status_code=400,
                content={"error": parse_error}
            )

        # Now validate against Pydantic schema
        try:
            validated = SomeRequest(**request_dict)
        except ValidationError as e:
            error_summary = format_validation_errors_detailed(
                request_id=request_dict.get("request_id", "unknown"),
                endpoint="/endpoint",
                validation_error=e
            )
            return JSONResponse(
                status_code=422,
                content={"errors": error_summary}
            )
"""

import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timezone
from pydantic import ValidationError
from .schemas import StandardOperationMetadata, ExtendedOperationMetadata

logger = logging.getLogger(__name__)


# ============================================================================
# CORE REQUEST VALIDATION AND PARSING (with comprehensive logging)
# ============================================================================

async def validate_and_parse_request(
    request,
    endpoint: str
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Validate and parse incoming FastAPI Request with comprehensive debug logging.

    Handles:
    1. Empty request body detection
    2. JSON parsing failures
    3. Detailed logging of all errors

    Args:
        request: FastAPI Request object
        endpoint: Endpoint path for logging context (e.g., "/list-datasets")

    Returns:
        Tuple[dict|None, error_message|None]:
            - (dict, None): Successfully parsed request dict
            - (None, error_message): Parse error with detailed message

    Example:
        request_dict, parse_error = await validate_and_parse_request(request, "/list-datasets")
        if parse_error:
            return ResponseFormatter.error(request_id="unknown", error_type="PayloadError", message=parse_error)
    """
    try:
        request_body_bytes = await request.body()

        # ========== Check for empty body ==========
        if not request_body_bytes:
            logger.error(
                "❌ Empty request body received",
                extra={
                    "event_type": "empty_payload_error",
                    "endpoint": endpoint,
                    "content_type": request.headers.get("content-type"),
                    "content_length": request.headers.get("content-length", 0),
                    "request_method": request.method,
                    "remote_addr": request.client.host if request.client else "unknown"
                }
            )
            return None, "Request body is empty. Expected JSON payload with request_id, input, and operation_metadata."

        # ========== Try JSON parsing ==========
        try:
            request_dict = await request.json()

            # Log successful parse with structure info
            logger.debug(
                f"✅ Request parsed successfully (endpoint: {endpoint})",
                extra={
                    "event_type": "request_parsed",
                    "endpoint": endpoint,
                    "request_keys": list(request_dict.keys()),
                    "has_request_id": "request_id" in request_dict,
                    "has_input": "input" in request_dict,
                    "has_operation_metadata": "operation_metadata" in request_dict,
                    "body_size_bytes": len(request_body_bytes)
                }
            )

            return request_dict, None

        except Exception as json_error:
            logger.error(
                "❌ JSON parsing failed",
                extra={
                    "event_type": "json_parse_error",
                    "endpoint": endpoint,
                    "error_type": type(json_error).__name__,
                    "error_message": str(json_error),
                    "raw_body_preview": request_body_bytes[:500].decode("utf-8", errors="ignore"),
                    "body_size_bytes": len(request_body_bytes),
                    "content_type": request.headers.get("content-type"),
                    "remote_addr": request.client.host if request.client else "unknown"
                }
            )
            return None, f"Failed to parse JSON: {str(json_error)}"

    except Exception as e:
        logger.error(
            "❌ Unexpected error reading request body",
            extra={
                "event_type": "request_read_error",
                "endpoint": endpoint,
                "error_type": type(e).__name__,
                "error_message": str(e),
                "request_method": request.method
            }
        )
        return None, f"Failed to read request: {str(e)}"


def log_pydantic_validation_error(
    request_id: str,
    endpoint: str,
    validation_error: ValidationError,
    request_dict: Optional[Dict[str, Any]] = None
) -> None:
    """
    Log Pydantic validation errors with comprehensive debug information.

    This function is called when Pydantic schema validation fails in initializer.py.
    It logs all error details for debugging request_validator issues.

    Logs:
    - Total error count and all error types
    - Missing required fields (payloadNotset indicates missing field)
    - Type validation errors (field has wrong type)
    - Value validation errors (field value doesn't pass constraints)
    - All error details with field paths and messages
    - Request structure (which fields were provided)

    Args:
        request_id: Request identifier for correlation
        endpoint: Endpoint path for context
        validation_error: Pydantic ValidationError exception
        request_dict: Original request dict (for context on what was provided)

    Example:
        try:
            validated = ListDatasetsRequest(**request_data_dict)
        except ValidationError as e:
            log_pydantic_validation_error("req_123", "/list-datasets", e, request_data_dict)
    """
    errors = validation_error.errors()

    # Categorize errors by type
    missing_fields = []
    type_errors = []
    value_errors = []
    constraint_errors = []
    other_errors = []

    for err in errors:
        field_path = ".".join(str(l) for l in err.get("loc", []))
        error_type = err.get("type", "unknown")
        error_msg = err.get("msg", "No message")

        error_detail = {
            "field": field_path,
            "type": error_type,
            "message": error_msg,
            "location": list(err.get("loc", []))
        }

        if "missing" in error_type:
            missing_fields.append(error_detail)
        elif "type_error" in error_type or "enum" in error_type:
            type_errors.append(error_detail)
        elif "value_error" in error_type or "assertion_error" in error_type:
            value_errors.append(error_detail)
        elif "greater_than" in error_type or "less_than" in error_type or "string_pattern" in error_type:
            constraint_errors.append(error_detail)
        else:
            other_errors.append(error_detail)

    # Extract request structure info
    request_info = {}
    if request_dict:
        request_info = {
            "provided_fields": list(request_dict.keys()),
            "has_request_id": "request_id" in request_dict,
            "has_input": "input" in request_dict,
            "has_operation_metadata": "operation_metadata" in request_dict,
            "request_size_bytes": len(str(request_dict))
        }

    # Log comprehensive validation error details
    logger.error(
        f"❌ Pydantic schema validation failed (request_id: {request_id}, endpoint: {endpoint})",
        extra={
            "event_type": "pydantic_validation_error",
            "request_id": request_id,
            "endpoint": endpoint,
            "error_count": len(errors),
            "error_count_by_type": {
                "missing_fields": len(missing_fields),
                "type_errors": len(type_errors),
                "value_errors": len(value_errors),
                "constraint_errors": len(constraint_errors),
                "other_errors": len(other_errors)
            },
            "missing_fields": missing_fields,
            "type_errors": type_errors,
            "value_errors": value_errors,
            "constraint_errors": constraint_errors,
            "other_errors": other_errors,
            "request_structure": request_info,
            "all_errors": [
                {
                    "field": ".".join(str(l) for l in err["loc"]),
                    "type": err["type"],
                    "message": err["msg"]
                }
                for err in errors
            ]
        }
    )


def format_validation_errors_detailed(
    request_id: str,
    endpoint: str,
    validation_error: ValidationError
) -> List[Dict[str, Any]]:
    """
    Format Pydantic validation errors for API response.

    Args:
        request_id: Request identifier for correlation
        endpoint: Endpoint path for context
        validation_error: Pydantic ValidationError exception

    Returns:
        List of error summaries with field, message, type, and location info
    """
    errors = validation_error.errors()

    error_summary = [
        {
            "field": ".".join(str(loc) for loc in err["loc"]),
            "message": err["msg"],
            "type": err["type"],
            "location": list(err.get("loc", []))
        }
        for err in errors
    ]

    return error_summary


def validate_operation_metadata_required_fields(
    operation_metadata: Dict[str, Any],
    require_logging: bool = False
) -> Tuple[bool, Optional[str]]:
    """
    Validate that request metadata contains all required fields.

    Args:
        operation_metadata: Request metadata dict (camelCase keys expected)
        require_logging: If True, also require loggingCollectionId and loggingDocumentId

    Returns:
        Tuple[bool, Optional[str]]: (is_valid, error_message)

    Example:
        is_valid, error = validate_operation_metadata_required_fields(metadata)
        if not is_valid:
            raise ValueError(error)
    """
    if not operation_metadata:
        return False, "operation_metadata is required"

    # Check standard required fields
    required_fields = ["organizationId", "spaceId", "requestedBy"]
    for field in required_fields:
        if field not in operation_metadata or not operation_metadata[field]:
            return False, f"operation_metadata.{field} is required"

    # Check requestedBy structure
    requested_by = operation_metadata.get("requestedBy", {})
    if isinstance(requested_by, dict):
        if "userId" not in requested_by or not requested_by.get("userId"):
            return False, "operation_metadata.requestedBy.userId is required"
        if "email" not in requested_by or not requested_by.get("email"):
            return False, "operation_metadata.requestedBy.email is required"

    # Check logging fields if required
    if require_logging:
        if not operation_metadata.get("loggingCollectionId"):
            return False, "operation_metadata.loggingCollectionId is required"
        if not operation_metadata.get("loggingDocumentId"):
            return False, "operation_metadata.loggingDocumentId is required"

    return True, None


def extract_organization_id(operation_metadata: Dict[str, Any]) -> Optional[str]:
    """
    Extract organizationId from request metadata.

    Args:
        operation_metadata: Request metadata dict (camelCase keys)

    Returns:
        Optional[str]: organizationId or None if not found

    Example:
        org_id = extract_organization_id(metadata)
        if not org_id:
            raise ValueError("organizationId required")
    """
    if not operation_metadata:
        return None
    return operation_metadata.get("organizationId")


def extract_space_id(operation_metadata: Dict[str, Any]) -> Optional[str]:
    """
    Extract spaceId from request metadata.

    Args:
        operation_metadata: Request metadata dict (camelCase keys)

    Returns:
        Optional[str]: spaceId or None if not found
    """
    if not operation_metadata:
        return None
    return operation_metadata.get("spaceId")


def extract_request_id(operation_metadata: Dict[str, Any]) -> Optional[str]:
    """
    Extract requestId from request metadata.

    Args:
        operation_metadata: Request metadata dict (camelCase keys)

    Returns:
        Optional[str]: requestId or None if not found
    """
    if not operation_metadata:
        return None
    return operation_metadata.get("requestId")


def extract_user_id(operation_metadata: Dict[str, Any]) -> Optional[str]:
    """
    Extract userId from request metadata.

    Args:
        operation_metadata: Request metadata dict (camelCase keys)

    Returns:
        Optional[str]: userId or None if not found
    """
    if not operation_metadata:
        return None

    requested_by = operation_metadata.get("requestedBy", {})
    if isinstance(requested_by, dict):
        return requested_by.get("userId")

    return None


def format_validation_errors(errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Format Pydantic validation errors into a human-readable structure.

    Args:
        errors: List of error dicts from Pydantic ValidationError

    Returns:
        Dict with formatted errors by location

    Example:
        from fastapi.exceptions import RequestValidationError

        @app.exception_handler(RequestValidationError)
        async def handler(request, exc):
            formatted = format_validation_errors(exc.errors())
            return JSONResponse(
                status_code=422,
                content={"status": "error", "errors": formatted}
            )
    """
    formatted = {
        "body": [],
        "query": [],
        "header": [],
        "path": [],
        "other": []
    }

    for error in errors:
        location = error.get("type", "other")
        loc = error.get("loc", [])
        msg = error.get("msg", "Unknown error")

        # Map Pydantic error types to readable messages
        error_type = error.get("type", "")
        if "type" in error_type or "value_error" in error_type:
            full_msg = f"{'.'.join(str(l) for l in loc)}: {msg}"
        elif "missing" in error_type:
            full_msg = f"Missing required field: {'.'.join(str(l) for l in loc)}"
        else:
            full_msg = f"{'.'.join(str(l) for l in loc)}: {msg}"

        # Categorize error by location
        if loc:
            first_loc = loc[0]
            if first_loc in formatted:
                formatted[first_loc].append(full_msg)
            else:
                formatted["other"].append(full_msg)
        else:
            formatted["other"].append(full_msg)

    # Remove empty categories
    return {k: v for k, v in formatted.items() if v}


def handle_validation_error(exc: Exception) -> Dict[str, Any]:
    """
    Handle validation errors and return standardized error response.

    Args:
        exc: Exception (typically RequestValidationError)

    Returns:
        Dict with standardized error structure

    Example:
        from fastapi.exceptions import RequestValidationError

        try:
            model = SomeModel(**data)
        except RequestValidationError as e:
            error_response = handle_validation_error(e)
            return JSONResponse(status_code=422, content=error_response)
    """
    error_response = {
        "status": "error",
        "message": "Request validation failed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "errors": {}
    }

    # Try to extract and format errors
    if hasattr(exc, "errors"):
        error_response["errors"] = format_validation_errors(exc.errors())
    else:
        error_response["errors"] = {"other": [str(exc)]}

    return error_response


def validate_firestore_logging_metadata(
    operation_metadata: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Validate that Firestore logging configuration is complete.

    For logging to Firestore, both loggingCollectionId and loggingDocumentId
    must be present together. Logging is optional (can be skipped).

    Args:
        operation_metadata: Request metadata dict (camelCase keys)

    Returns:
        Tuple[bool, Optional[str]]: (is_valid, error_message)

    Example:
        is_valid, error = validate_firestore_logging_metadata(metadata)
        if not is_valid:
            logger.warn(f"Firestore logging will be skipped: {error}")
    """
    has_collection = "loggingCollectionId" in operation_metadata
    has_document = "loggingDocumentId" in operation_metadata

    # Either both present or both absent
    if has_collection and not has_document:
        return False, "loggingDocumentId required when loggingCollectionId is specified"

    if has_document and not has_collection:
        return False, "loggingCollectionId required when loggingDocumentId is specified"

    return True, None


def create_metadata_from_request(
    organization_id: str,
    space_id: str,
    user_id: str,
    email: str,
    role: Optional[str] = None,
    logging_collection_id: Optional[str] = None,
    logging_document_id: Optional[str] = None,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Helper to create a valid request metadata dict.

    Args:
        organization_id: Organization ID
        space_id: Space ID
        user_id: User ID
        email: User email
        role: User role (optional)
        logging_collection_id: Firestore logging collection path (optional)
        logging_document_id: Firestore logging document ID (optional)
        request_id: Request ID (optional)

    Returns:
        Dict with camelCase keys ready for JSON serialization

    Example:
        metadata = create_metadata_from_request(
            organization_id="org_123",
            space_id="space_456",
            user_id="user_123",
            email="user@example.com",
            role="admin",
            logging_collection_id="requests/reportRequests",
            logging_document_id="req_abc123"
        )
    """
    metadata = {
        "organizationId": organization_id,
        "spaceId": space_id,
        "requestedBy": {
            "userId": user_id,
            "email": email,
        }
    }

    if role:
        metadata["requestedBy"]["role"] = role

    if logging_collection_id:
        metadata["loggingCollectionId"] = logging_collection_id

    if logging_document_id:
        metadata["loggingDocumentId"] = logging_document_id

    if request_id:
        metadata["requestId"] = request_id

    return metadata


# ============================================================================
# Pydantic Model Validators
# ============================================================================

def validate_and_parse_operation_metadata(
    raw_metadata: Dict[str, Any],
    extended: bool = False
) -> Optional[Any]:
    """
    Validate and parse raw metadata dict into Pydantic model.

    Args:
        raw_metadata: Raw metadata dict (camelCase keys)
        extended: If True, use ExtendedOperationMetadata; else StandardOperationMetadata

    Returns:
        Parsed Pydantic model or None if invalid

    Example:
        metadata = validate_and_parse_operation_metadata(
            raw_metadata=request.metadata,
            extended=True
        )
        if not metadata:
            raise ValueError("Invalid metadata")
    """
    try:
        ModelClass = ExtendedOperationMetadata if extended else StandardOperationMetadata
        return ModelClass.model_validate(raw_metadata)
    except Exception as e:
        # Return None on validation failure (caller can decide how to handle)
        return None
