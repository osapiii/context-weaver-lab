"""
Unified Operation Metadata Schemas for CloudRun Microservices

Provides standardized operation metadata structures with proper camelCase/snake_case
conversion for JSON serialization while maintaining Python naming conventions.

Complies with: DOC_06_RequestDoc_OperationMetadata

Design Principles:
- Multi-tenant support (organizationId/spaceId)
- Type safety via Pydantic models
- Automatic camelCase ↔ snake_case conversion via Field aliases
- Optional logging fields (loggingCollectionId, loggingDocumentId)
- Extensible via inheritance

Usage:
    from schemas import StandardOperationMetadata, ExtendedOperationMetadata

    # Basic metadata (from JSON with camelCase)
    metadata = StandardOperationMetadata.model_validate({
        "organizationId": "org_123",
        "spaceId": "space_456",
        "requestedBy": {
            "userId": "user_123",
            "email": "user@example.com",
            "role": "admin"
        }
    })

    # Extended metadata with logging
    extended = ExtendedOperationMetadata.model_validate({
        "organizationId": "org_123",
        "spaceId": "space_456",
        "requestedBy": {...},
        "loggingCollectionId": "requests/reportRequests",
        "loggingDocumentId": "req_abc123"
    })
"""

from typing import Optional, Dict, Any, List, Union
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict


class RequestedBy(BaseModel):
    """Information about who requested the operation"""
    user_id: Optional[str] = Field(default=None, alias="userId", description="User identifier")
    email: str = Field(description="User email address")
    role: Optional[Union[str, int]] = Field(default=None, description="User role (e.g., admin, user, or numeric role ID)")

    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={datetime: lambda v: v.isoformat()}
    )


class StandardOperationMetadata(BaseModel):
    """
    Minimal required metadata for all operations.

    This is the base metadata structure that all operations must provide.
    It includes organization/space isolation and requester information.

    Firestore Path (reference):
        organizations/{organizationId}/spaces/{spaceId}/...
    """
    organization_id: str = Field(
        ...,
        alias="organizationId",
        description="Organization ID (tenant isolation)"
    )
    space_id: str = Field(
        ...,
        alias="spaceId",
        description="Space ID (workspace isolation within organization)"
    )
    requested_by: RequestedBy = Field(
        ...,
        alias="requestedBy",
        description="Information about the requester"
    )

    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={datetime: lambda v: v.isoformat()}
    )

    def dict_snake_case(self) -> Dict[str, Any]:
        """Return dict with snake_case keys (Python convention)"""
        return self.model_dump(by_alias=False, exclude_none=True)

    def dict_camel_case(self) -> Dict[str, Any]:
        """Return dict with camelCase keys (JSON convention)"""
        return self.model_dump(by_alias=True, exclude_none=True)


class ExtendedOperationMetadata(StandardOperationMetadata):
    """
    Extended metadata including logging configuration.

    Extends StandardOperationMetadata with optional Firestore logging fields.
    When both loggingCollectionId and loggingDocumentId are present,
    Logger will automatically append logs to Firestore.

    Firestore Logging Path:
        organizations/{organizationId}/requests/{loggingCollectionId}/{loggingDocumentId}/logs
    """
    logging_collection_id: Optional[str] = Field(
        default=None,
        alias="loggingCollectionId",
        description="Firestore collection path for logs (e.g., 'requests/reportRequests')"
    )
    logging_document_id: Optional[str] = Field(
        default=None,
        alias="loggingDocumentId",
        description="Firestore document ID for logs"
    )
    request_id: Optional[str] = Field(
        default=None,
        alias="requestId",
        description="Unique request identifier"
    )
    operation_mode: Optional[str] = Field(
        default=None,
        alias="operationMode",
        description="Operation mode (e.g., 'async', 'sync', 'batch')"
    )

    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={datetime: lambda v: v.isoformat()}
    )


class GcsMetadata(BaseModel):
    """Metadata for GCS operations"""
    bucket_name: str = Field(..., alias="bucketName", description="GCS bucket name")
    base_path: str = Field(..., alias="basePath", description="Base path in GCS")

    model_config = ConfigDict(populate_by_name=True)


class BaseRequest(BaseModel):
    """
    Base request class for all CloudRun service endpoints.

    Provides common request structure with operationMetadata.
    Extend this class for service-specific request bodies.

    Example:
        class ReportGenerationRequest(BaseRequest):
            report_type: str = Field(..., alias="reportType")
            parameters: Dict[str, Any]
    """
    operation_metadata: ExtendedOperationMetadata = Field(
        ...,
        alias="operationMetadata",
        description="Operation metadata (organization, user, logging)"
    )

    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={datetime: lambda v: v.isoformat()}
    )


class BaseResponse(BaseModel):
    """
    Base response class for all CloudRun service endpoints.

    Provides common response structure with status and metadata.
    """
    status: str = Field(..., description="Response status (success/error/processing)")
    message: Optional[str] = Field(default=None, description="Response message")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Response data")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Response timestamp"
    )

    model_config = ConfigDict(
        json_encoders={datetime: lambda v: v.isoformat()}
    )


# ============================================================================
# Backward Compatibility Aliases
# ============================================================================

# Allow import of different names for flexibility
OperationMetadata = ExtendedOperationMetadata
OperationMetadataBase = StandardOperationMetadata

# Legacy aliases (for backward compatibility during migration)
RequestMetadata = ExtendedOperationMetadata
RequestMetadataBase = StandardOperationMetadata
