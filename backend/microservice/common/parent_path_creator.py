"""
Parent Path Creator - CloudRun Microservice Common Module

This module provides unified path generation methods for Firebase Firestore and
Google Cloud Storage operations across all CloudRun microservices.

Complies with: DOC_07_インフラ管理_parentPathCreator実装規約

All methods follow the standard naming convention: return[Purpose][Service]Path

Design Principles:
    1. Multi-tenant support: organizationId/spaceId-based data isolation
    2. Explicit arguments: All parameters must be explicitly passed
    3. MECE classification: Organization-only, Space-isolated, GCS, and Logging paths
    4. Standard naming: Consistent method names across all environments
    5. Validation: All inputs are validated before path generation

Usage:
    For microservices, use explicit argument passing:

    >>> # Static method approach (recommended for simple cases)
    >>> path = ParentPathCreator.returnParentOrgSpaceFirestorePath(
    ...     organizationId="org_123",
    ...     spaceId="space_456",
    ...     path="documents/reports/monthly"
    ... )

    >>> # Instance-based approach (recommended for multiple operations)
    >>> creator = ParentPathCreator(organization_id="org_123", space_id="space_456")
    >>> firestore_path = creator.returnParentOrgSpaceFirestorePath("documents/reports")
    >>> gcs_path = creator.returnParentOrgSpaceGcsPath("bucket-name", "files/data.csv")
"""

from typing import Optional, Dict, Any


class ParentPathCreator:
    """
    Unified ParentPathCreator implementation for CloudRun microservices.

    Provides both static methods (explicit arguments) and instance methods
    (store organizationId/spaceId in instance) for flexible usage.
    """

    def __init__(self, organization_id: str, space_id: str):
        """
        Initialize ParentPathCreator with organization and space IDs.

        Args:
            organization_id: Organization ID (required)
            space_id: Space ID (required)

        Raises:
            ValueError: If organization_id or space_id is None or empty

        Note:
            Instance-based approach is recommended when making multiple path
            operations for the same organization/space combination.
        """
        if not organization_id:
            raise ValueError("organization_id cannot be None or empty")
        if not space_id:
            raise ValueError("space_id cannot be None or empty")

        self.organization_id = organization_id
        self.space_id = space_id

    # ============================================================================
    # Organization-level Paths (No Space Isolation)
    # ============================================================================

    @staticmethod
    def returnParentOrgFirestorePath(
        organizationId: str,
        path: str
    ) -> str:
        """
        Generate Organization-level Firestore path (no space isolation).

        Usage Pattern:
            1. Request logs (e.g., "requests/createReportRequests/logs")
            2. AdminUser documents (e.g., "adminUsers/profiles")
            3. Other organization-wide documents without space isolation

        Args:
            organizationId: Organization ID (explicit)
            path: Collection path string (joined by caller)

        Returns:
            str: Path in format organizations/{orgId}/{path}

        Raises:
            ValueError: If organizationId or path is None or empty

        Example:
            >>> ParentPathCreator.returnParentOrgFirestorePath(
            ...     "org_123",
            ...     "requests/reportGenerationRequests/logs"
            ... )
            'organizations/org_123/requests/reportGenerationRequests/logs'
        """
        if not organizationId:
            raise ValueError("organizationId cannot be None or empty")
        if not path:
            raise ValueError("path cannot be None or empty")

        return f"organizations/{organizationId}/{path}"

    # ============================================================================
    # Space-isolated Firestore Paths
    # ============================================================================

    @staticmethod
    def returnParentOrgSpaceFirestorePath(
        organizationId: str,
        spaceId: str,
        path: str
    ) -> str:
        """
        Generate Space-isolated Firestore collection path.

        Args:
            organizationId: Organization ID (explicit)
            spaceId: Space ID (explicit)
            path: Collection path string (joined by caller)

        Returns:
            str: Path in format organizations/{orgId}/spaces/{spaceId}/{path}

        Raises:
            ValueError: If organizationId, spaceId or path is None or empty

        Example:
            >>> ParentPathCreator.returnParentOrgSpaceFirestorePath(
            ...     "org_123",
            ...     "space_456",
            ...     "documents/reports/2024"
            ... )
            'organizations/org_123/spaces/space_456/documents/reports/2024'
        """
        if not organizationId or not spaceId:
            raise ValueError("organizationId and spaceId cannot be None or empty")
        if not path:
            raise ValueError("path cannot be None or empty")

        return f"organizations/{organizationId}/spaces/{spaceId}/{path}"

    def returnParentOrgSpaceFirestorePath_instance(self, path: str) -> str:
        """
        Instance method version of returnParentOrgSpaceFirestorePath.
        Uses organization_id and space_id from instance initialization.

        Args:
            path: Collection path string (joined by caller)

        Returns:
            str: Space-isolated Firestore path

        Example:
            >>> creator = ParentPathCreator("org_123", "space_456")
            >>> creator.returnParentOrgSpaceFirestorePath_instance("documents/reports")
            'organizations/org_123/spaces/space_456/documents/reports'
        """
        return self.returnParentOrgSpaceFirestorePath(
            self.organization_id,
            self.space_id,
            path
        )

    # ============================================================================
    # Organization-level GCS Paths (No Space Isolation)
    # ============================================================================

    @staticmethod
    def returnParentOrgGcsPath(
        bucketName: str,
        organizationId: str,
        path: str
    ) -> str:
        """
        Generate Organization-level GCS path (no space isolation).

        Usage Pattern:
            1. Organization-wide job logs
            2. Shared resources across spaces
            3. System-level files

        Args:
            bucketName: GCS bucket name (explicit)
            organizationId: Organization ID (explicit)
            path: Path string (joined by caller)

        Returns:
            str: Path in format {bucketName}/organizations/{orgId}/{path}

        Raises:
            ValueError: If any parameter is None or empty

        Example:
            >>> ParentPathCreator.returnParentOrgGcsPath(
            ...     "facthub-dev.firebasestorage.app",
            ...     "org_123",
            ...     "jobLogs/reportGeneration/job_789/screenshot.png"
            ... )
            'facthub-dev.firebasestorage.app/organizations/org_123/jobLogs/reportGeneration/job_789/screenshot.png'
        """
        if not all([bucketName, organizationId]):
            raise ValueError("bucketName and organizationId cannot be None or empty")
        if not path:
            raise ValueError("path cannot be None or empty")

        return f"{bucketName}/organizations/{organizationId}/{path}"

    # ============================================================================
    # Space-isolated GCS Paths
    # ============================================================================

    @staticmethod
    def returnParentOrgSpaceGcsPath(
        bucketName: str,
        organizationId: str,
        spaceId: str,
        path: str
    ) -> str:
        """
        Generate Space-isolated GCS path.

        Args:
            bucketName: GCS bucket name (explicit)
            organizationId: Organization ID (explicit)
            spaceId: Space ID (explicit)
            path: Path string (joined by caller)

        Returns:
            str: Path in format {bucketName}/organizations/{orgId}/spaces/{spaceId}/{path}

        Raises:
            ValueError: If any parameter is None or empty

        Example:
            >>> ParentPathCreator.returnParentOrgSpaceGcsPath(
            ...     "facthub-reports-bucket",
            ...     "org_123",
            ...     "space_456",
            ...     "monthly-reports/2024-10/report.pdf"
            ... )
            'facthub-reports-bucket/organizations/org_123/spaces/space_456/monthly-reports/2024-10/report.pdf'
        """
        if not all([bucketName, organizationId, spaceId]):
            raise ValueError("bucketName, organizationId and spaceId cannot be None or empty")
        if not path:
            raise ValueError("path cannot be None or empty")

        # Note: bucketName is included as part of the path for GCS
        return f"{bucketName}/organizations/{organizationId}/spaces/{spaceId}/{path}"

    def returnParentOrgSpaceGcsPath_instance(
        self,
        bucketName: str,
        path: str
    ) -> str:
        """
        Instance method version of returnParentOrgSpaceGcsPath.
        Uses organization_id and space_id from instance initialization.

        Args:
            bucketName: GCS bucket name (explicit)
            path: Path string (joined by caller)

        Returns:
            str: Space-isolated GCS path

        Example:
            >>> creator = ParentPathCreator("org_123", "space_456")
            >>> creator.returnParentOrgSpaceGcsPath_instance(
            ...     "facthub-reports-bucket",
            ...     "reports/monthly.pdf"
            ... )
            'facthub-reports-bucket/organizations/org_123/spaces/space_456/reports/monthly.pdf'
        """
        return self.returnParentOrgSpaceGcsPath(
            bucketName,
            self.organization_id,
            self.space_id,
            path
        )

    # ============================================================================
    # Logging Paths
    # ============================================================================

    @staticmethod
    def returnLoggingFirestorePath(
        organizationId: str,
        spaceId: str,
        loggingPath: str
    ) -> str:
        """
        Generate logging-specific Firestore path.

        Args:
            organizationId: Organization ID (explicit)
            spaceId: Space ID (explicit)
            loggingPath: Logging path string (joined by caller)

        Returns:
            str: Space-isolated logging path

        Raises:
            ValueError: If any parameter is None or empty

        Example:
            >>> ParentPathCreator.returnLoggingFirestorePath(
            ...     "org_123",
            ...     "space_456",
            ...     "microservices/report-generator/logs/log_789"
            ... )
            'organizations/org_123/spaces/space_456/logs/microservices/report-generator/logs/log_789'
        """
        if not all([organizationId, spaceId, loggingPath]):
            raise ValueError("All parameters cannot be None or empty")

        return f"organizations/{organizationId}/spaces/{spaceId}/logs/{loggingPath}"

    def returnLoggingFirestorePath_instance(self, loggingPath: str) -> str:
        """
        Instance method version of returnLoggingFirestorePath.
        Uses organization_id and space_id from instance initialization.

        Args:
            loggingPath: Logging path string (joined by caller)

        Returns:
            str: Space-isolated logging path

        Example:
            >>> creator = ParentPathCreator("org_123", "space_456")
            >>> creator.returnLoggingFirestorePath_instance(
            ...     "microservices/auth-service/executions/exec_123"
            ... )
            'organizations/org_123/spaces/space_456/logs/microservices/auth-service/executions/exec_123'
        """
        return self.returnLoggingFirestorePath(
            self.organization_id,
            self.space_id,
            loggingPath
        )

    # ============================================================================
    # Backward Compatibility Methods (Deprecated)
    # ============================================================================

    def build_firestore_collection_path(
        self, collection_type: str, subcollection: Optional[str] = None
    ) -> str:
        """
        DEPRECATED: Use returnParentOrgSpaceFirestorePath_instance instead.
        Backward compatibility wrapper for existing code.

        Args:
            collection_type: Collection type (e.g., "videos", "transcriptions")
            subcollection: Optional subcollection name

        Returns:
            str: Firestore collection path
        """
        if subcollection:
            path = f"{collection_type}/{subcollection}"
        else:
            path = collection_type

        return self.returnParentOrgSpaceFirestorePath_instance(path)

    def build_gcs_parent_path(
        self, resource_type: str, additional_segments: Optional[list] = None
    ) -> str:
        """
        DEPRECATED: Use returnParentOrgSpaceGcsPath_instance instead.
        Backward compatibility wrapper for existing code.

        Note: This method returns path WITHOUT bucket name for backward compatibility.
        The new standard method includes bucket name in the path.

        Args:
            resource_type: Resource type (e.g., "videos", "audio")
            additional_segments: Optional additional path segments

        Returns:
            str: GCS parent path (without bucket name)
        """
        if additional_segments:
            segments_str = "/".join(additional_segments)
            path = f"{resource_type}/{segments_str}"
        else:
            path = resource_type

        # Return path without bucket name for backward compatibility
        return f"{self.organization_id}/{self.space_id}/{path}"

    def build_logging_path(
        self, logging_collection_id: str, logging_document_id: str
    ) -> Dict[str, str]:
        """
        DEPRECATED: Use returnLoggingFirestorePath_instance instead.
        Backward compatibility wrapper for existing code.

        Args:
            logging_collection_id: Logging collection ID
            logging_document_id: Logging document ID

        Returns:
            Dict[str, str]: Logging path information
        """
        if not logging_collection_id:
            raise ValueError("logging_collection_id is required for build_logging_path")
        if not logging_document_id:
            raise ValueError("logging_document_id is required for build_logging_path")

        full_path = f"{logging_collection_id}/{logging_document_id}"

        return {
            "collection_path": logging_collection_id,
            "document_id": logging_document_id,
            "full_path": full_path,
        }

    def validate_metadata(self, metadata: Dict[str, Any]) -> tuple:
        """
        Validate required fields in metadata.

        Args:
            metadata: Request metadata dictionary

        Returns:
            tuple[bool, Optional[str]]: (validation_success, error_message)

        Example:
            >>> creator = ParentPathCreator("org_123", "space_456")
            >>> valid, error = creator.validate_metadata({
            ...     "organizationId": "org_123",
            ...     "spaceId": "space_456",
            ...     "loggingCollectionId": "logs/requests",
            ...     "loggingDocumentId": "req_123"
            ... })
            >>> print(valid)
            True
        """
        # Required fields: organizationId, spaceId
        if not metadata.get("organizationId"):
            return False, "metadata.organizationId is required"
        if not metadata.get("spaceId"):
            return False, "metadata.spaceId is required"

        # Check if IDs match initialization
        if metadata["organizationId"] != self.organization_id:
            return (
                False,
                f"metadata.organizationId mismatch: expected {self.organization_id}, "
                f"got {metadata['organizationId']}",
            )
        if metadata["spaceId"] != self.space_id:
            return (
                False,
                f"metadata.spaceId mismatch: expected {self.space_id}, "
                f"got {metadata['spaceId']}",
            )

        # Logging fields (optional, but must be paired)
        has_logging_collection = "loggingCollectionId" in metadata
        has_logging_document = "loggingDocumentId" in metadata

        if has_logging_collection and not has_logging_document:
            return (
                False,
                "metadata.loggingDocumentId is required when loggingCollectionId is provided",
            )
        if has_logging_document and not has_logging_collection:
            return (
                False,
                "metadata.loggingCollectionId is required when loggingDocumentId is provided",
            )

        return True, None


# Backward compatibility class alias
class ParentPathManager(ParentPathCreator):
    """
    DEPRECATED: Use ParentPathCreator instead.
    Backward compatibility alias for existing code.
    """
    pass
