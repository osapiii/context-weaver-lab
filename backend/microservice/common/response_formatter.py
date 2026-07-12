"""
Unified Response Formatter for All CloudRun Microservices

Provides standardized response formatting with automatic snake_case → camelCase conversion.
All services must use ResponseFormatter for consistent JSON responses.

Design Principles:
- Standardized response structure (status, request_id, output/error)
- Automatic snake_case → camelCase conversion for frontend compatibility
- Consistent error handling across all services
- FastAPI JSONResponse integration
"""

from typing import Dict, Any, Optional
from fastapi.responses import JSONResponse
from case_converter import convert_keys_to_camel_case
import json


class ResponseFormatter:
    """
    Unified response formatter for CloudRun microservices.

    Provides static methods for creating consistent JSON responses with:
    - Automatic snake_case → camelCase conversion
    - Standard error handling
    - Request ID tracking
    - Proper HTTP status codes

    Usage:
        # Success response
        return ResponseFormatter.success(
            request_id="req_123",
            output={"dataset_name": "my_dataset"},  # snake_case OK
            status_code=200
        )

        # Error response
        return ResponseFormatter.error(
            request_id="req_123",
            error_type="ValidationError",
            message="Invalid input",
            status_code=400
        )
    """

    @staticmethod
    def success(request_id: str, output: Dict[str, Any], status_code: int = 200):
        """
        Create successful response with automatic camelCase conversion.

        Args:
            request_id: Unique request identifier
            output: Response data (snake_case keys are auto-converted to camelCase)
            status_code: HTTP status code (default: 200)

        Returns:
            FastAPI JSONResponse

        Notes:
            - Output dict keys should be snake_case (Python convention)
            - Automatically converted to camelCase for JSON response
            - Nested objects and arrays also converted recursively

        Example:
            return ResponseFormatter.success(
                request_id="req_123",
                output={
                    "dataset_names": ["dataset1", "dataset2"],
                    "total_count": 2
                }
            )
            # JSON output: {
            #   "status": "success",
            #   "requestId": "req_123",
            #   "output": {
            #     "datasetNames": ["dataset1", "dataset2"],
            #     "totalCount": 2
            #   }
            # }
        """
        # ✅ CRITICAL: snake_case → camelCase automatic conversion
        camel_case_output = convert_keys_to_camel_case(output)

        response_data = {
            "status": "success",
            "request_id": request_id,
            "output": camel_case_output
        }

        # Debug logging
        print(f"🔍 Final Response: {json.dumps(response_data, ensure_ascii=False, indent=2)}")

        return JSONResponse(
            content=response_data,
            status_code=status_code
        )

    @staticmethod
    def error(
        request_id: Optional[str],
        error_type: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = 500
    ):
        """
        Create error response with consistent structure.

        Args:
            request_id: Request identifier (can be None for pre-validation errors)
            error_type: Error classification (ValidationError, ProcessingError, StorageError, InternalError)
            message: Human-readable error message
            details: Additional error context (optional)
            status_code: HTTP status code (default: 500)

        Returns:
            FastAPI JSONResponse

        Example:
            return ResponseFormatter.error(
                request_id="req_123",
                error_type="ValidationError",
                message="Missing required field: organizationId",
                details={"field": "organizationId"},
                status_code=400
            )
        """
        error_response = {
            "status": "error",
            "request_id": request_id,
            "error": {
                "type": error_type,
                "message": message
            }
        }

        if details:
            error_response["error"]["details"] = details

        return JSONResponse(
            content=error_response,
            status_code=status_code
        )

    @staticmethod
    def validation_error(
        request_id: Optional[str],
        endpoint: str,
        validation_errors: list
    ):
        """
        Create validation error response.

        Args:
            request_id: Request identifier (can be None if request_id validation failed)
            endpoint: API endpoint path
            validation_errors: List of Pydantic validation error dicts

        Returns:
            FastAPI JSONResponse (400 Bad Request)

        Example:
            return ResponseFormatter.validation_error(
                request_id="req_123",
                endpoint="/list-datasets",
                validation_errors=[
                    {"field": "metadata.organizationId", "message": "field required", "type": "value_error.missing"}
                ]
            )
        """
        return ResponseFormatter.error(
            request_id=request_id,
            error_type="ValidationError",
            message="Request validation failed",
            details={
                "endpoint": endpoint,
                "validation_errors": validation_errors
            },
            status_code=400
        )

    @staticmethod
    def processing_error(
        request_id: str,
        step: str,
        reason: str,
        additional_details: Optional[Dict[str, Any]] = None
    ):
        """
        Create processing error response.

        Args:
            request_id: Request identifier
            step: Processing step where error occurred
            reason: Reason for failure
            additional_details: Extra context about the failure

        Returns:
            FastAPI JSONResponse (422 Unprocessable Entity)

        Example:
            return ResponseFormatter.processing_error(
                request_id="req_123",
                step="fetching_datasets",
                reason="BigQuery project not accessible",
                additional_details={"project_id": "facthub-dev"}
            )
        """
        details = {
            "step": step,
            "reason": reason
        }

        if additional_details:
            details.update(additional_details)

        return ResponseFormatter.error(
            request_id=request_id,
            error_type="ProcessingError",
            message=f"Processing failed at {step}",
            details=details,
            status_code=422
        )

    @staticmethod
    def storage_error(
        request_id: str,
        resource: str,
        operation: str,
        reason: str,
        additional_details: Optional[Dict[str, Any]] = None
    ):
        """
        Create storage operation error response (GCS, Firestore, etc.).

        Args:
            request_id: Request identifier
            resource: Resource type (GCS, Firestore, BigQuery, etc.)
            operation: Operation type (download, upload, read, write, query, etc.)
            reason: Reason for failure
            additional_details: Extra context

        Returns:
            FastAPI JSONResponse (500 Internal Server Error)

        Example:
            return ResponseFormatter.storage_error(
                request_id="req_123",
                resource="GCS",
                operation="download",
                reason="Bucket access denied",
                additional_details={"bucket": "my-bucket", "path": "reports/file.pdf"}
            )
        """
        details = {
            "resource": resource,
            "operation": operation,
            "reason": reason
        }

        if additional_details:
            details.update(additional_details)

        return ResponseFormatter.error(
            request_id=request_id,
            error_type="StorageError",
            message=f"{resource} {operation} operation failed",
            details=details,
            status_code=500
        )
