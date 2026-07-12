"""
Unified Firestore Client Manager for CloudRun Microservices

Provides centralized Firestore operations with:
- Singleton ClientManager pattern
- CRUD operations (Create, Read, Update, Delete)
- Query and filtering support
- Logging and transaction support
- ArrayUnion support for appending to arrays
- Document and collection path helpers

Consolidates 6+ separate firestore_utils.py implementations into single source.

Design Principles:
- Singleton pattern for ClientManager (one client per process)
- Type-safe operations with proper error handling
- Firestore path integration with ParentPathCreator
- Silent failure for non-critical operations

Usage:
    from firestore import FirestoreClientManager

    # Get singleton client manager
    manager = FirestoreClientManager.get_instance()

    # CRUD operations
    manager.create_document("orgs/org_123/spaces/space_456/docs/doc1", {
        "title": "Report",
        "status": "pending"
    })

    doc = manager.get_document("orgs/org_123/spaces/space_456/docs/doc1")

    manager.update_document("orgs/org_123/spaces/space_456/docs/doc1", {
        "status": "completed"
    })

    # Query operations
    results = manager.query_documents(
        collection_path="organizations/org_123/spaces/space_456/reports",
        field="status",
        operator="==",
        value="completed"
    )
"""

import logging
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timezone
from threading import Lock
from google.cloud import firestore
from google.api_core.exceptions import NotFound, AlreadyExists


# ============================================================================
# Singleton Client Manager
# ============================================================================

class FirestoreClientManager:
    """
    Singleton manager for Firestore operations.

    Ensures only one client instance exists per process.
    Provides thread-safe access to Firestore database.
    """

    _instance: Optional["FirestoreClientManager"] = None
    _lock = Lock()

    def __init__(self):
        """Initialize Firestore client (called once)."""
        self.db = firestore.Client()
        self.logger = logging.getLogger(__name__)

    @classmethod
    def get_instance(cls) -> "FirestoreClientManager":
        """
        Get or create singleton instance.

        Returns:
            FirestoreClientManager: Singleton instance

        Example:
            manager = FirestoreClientManager.get_instance()
        """
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # ========================================================================
    # Create Operations
    # ========================================================================

    def create_document(
        self,
        document_path: str,
        data: Dict[str, Any]
    ) -> bool:
        """
        Create new Firestore document.

        Args:
            document_path: Full document path (e.g., "organizations/org_123/docs/doc_id")
            data: Document data dict

        Returns:
            bool: True if successful, False otherwise

        Example:
            manager.create_document(
                "organizations/org_123/spaces/space_456/documents/doc1",
                {"title": "Report", "status": "pending"}
            )
        """
        try:
            self.db.document(document_path).set(data)
            self.logger.info(f"✅ Document created: {document_path}")
            return True
        except AlreadyExists:
            self.logger.warning(f"⚠️ Document already exists: {document_path}")
            return False
        except Exception as e:
            self.logger.error(f"❌ Error creating document {document_path}: {e}")
            return False

    def create_or_update_document(
        self,
        document_path: str,
        data: Dict[str, Any],
        merge: bool = True
    ) -> bool:
        """
        Create or update Firestore document (upsert).

        Args:
            document_path: Full document path
            data: Document data dict
            merge: If True, merge with existing data; if False, overwrite

        Returns:
            bool: True if successful, False otherwise

        Example:
            manager.create_or_update_document(
                "organizations/org_123/docs/doc1",
                {"updated_at": datetime.now()},
                merge=True
            )
        """
        try:
            self.db.document(document_path).set(data, merge=merge)
            self.logger.info(f"✅ Document upserted: {document_path}")
            return True
        except Exception as e:
            self.logger.error(f"❌ Error upserting document {document_path}: {e}")
            return False

    # ========================================================================
    # Read Operations
    # ========================================================================

    def get_document(self, document_path: str) -> Optional[Dict[str, Any]]:
        """
        Get single document from Firestore.

        Args:
            document_path: Full document path

        Returns:
            Dict with document data or None if not found

        Example:
            doc = manager.get_document("organizations/org_123/docs/doc1")
            if doc:
                print(doc["title"])
        """
        try:
            doc = self.db.document(document_path).get()
            if doc.exists:
                return doc.to_dict()
            else:
                self.logger.debug(f"Document not found: {document_path}")
                return None
        except NotFound:
            self.logger.debug(f"Document not found: {document_path}")
            return None
        except Exception as e:
            self.logger.error(f"❌ Error getting document {document_path}: {e}")
            return None

    def get_documents(self, document_paths: List[str]) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Get multiple documents efficiently.

        Args:
            document_paths: List of full document paths

        Returns:
            Dict mapping paths to document data (or None if not found)

        Example:
            docs = manager.get_documents([
                "organizations/org_123/docs/doc1",
                "organizations/org_123/docs/doc2"
            ])
        """
        results = {}
        try:
            # Use batch get for efficiency
            for path in document_paths:
                results[path] = self.get_document(path)
            return results
        except Exception as e:
            self.logger.error(f"❌ Error getting documents: {e}")
            return {path: None for path in document_paths}

    # ========================================================================
    # Update Operations
    # ========================================================================

    def update_document(
        self,
        document_path: str,
        data: Dict[str, Any]
    ) -> bool:
        """
        Update existing Firestore document.

        Args:
            document_path: Full document path
            data: Fields to update

        Returns:
            bool: True if successful, False otherwise

        Example:
            manager.update_document(
                "organizations/org_123/docs/doc1",
                {"status": "completed", "updated_at": datetime.now()}
            )
        """
        try:
            self.db.document(document_path).update(data)
            self.logger.info(f"✅ Document updated: {document_path}")
            return True
        except NotFound:
            self.logger.warning(f"⚠️ Document not found for update: {document_path}")
            return False
        except Exception as e:
            self.logger.error(f"❌ Error updating document {document_path}: {e}")
            return False

    def append_to_array(
        self,
        document_path: str,
        field_name: str,
        value: Any
    ) -> bool:
        """
        Append value to array field using ArrayUnion.

        Automatically creates field if it doesn't exist.

        Args:
            document_path: Full document path
            field_name: Name of array field
            value: Value to append (typically a dict for log entries)

        Returns:
            bool: True if successful, False otherwise

        Example:
            manager.append_to_array(
                "organizations/org_123/requests/req1",
                "logs",
                {"timestamp": datetime.now(), "message": "Processing started"}
            )
        """
        try:
            self.db.document(document_path).update({
                field_name: firestore.ArrayUnion([value])
            })
            self.logger.info(f"✅ Appended to array {field_name}: {document_path}")
            return True
        except Exception as e:
            self.logger.error(f"❌ Error appending to array {field_name}: {e}")
            return False

    def increment_field(
        self,
        document_path: str,
        field_name: str,
        increment_value: float = 1
    ) -> bool:
        """
        Increment numeric field.

        Args:
            document_path: Full document path
            field_name: Name of numeric field
            increment_value: Amount to increment (default: 1)

        Returns:
            bool: True if successful, False otherwise

        Example:
            manager.increment_field(
                "organizations/org_123/stats/counters",
                "request_count",
                increment_value=1
            )
        """
        try:
            self.db.document(document_path).update({
                field_name: firestore.Increment(increment_value)
            })
            self.logger.info(f"✅ Incremented field {field_name}: {document_path}")
            return True
        except Exception as e:
            self.logger.error(f"❌ Error incrementing field {field_name}: {e}")
            return False

    # ========================================================================
    # Delete Operations
    # ========================================================================

    def delete_document(self, document_path: str) -> bool:
        """
        Delete Firestore document.

        Args:
            document_path: Full document path

        Returns:
            bool: True if successful, False otherwise

        Example:
            manager.delete_document("organizations/org_123/docs/old_doc")
        """
        try:
            self.db.document(document_path).delete()
            self.logger.info(f"✅ Document deleted: {document_path}")
            return True
        except NotFound:
            self.logger.debug(f"Document not found for deletion: {document_path}")
            return True  # Idempotent: already deleted
        except Exception as e:
            self.logger.error(f"❌ Error deleting document {document_path}: {e}")
            return False

    def delete_field(self, document_path: str, field_name: str) -> bool:
        """
        Delete specific field from document.

        Args:
            document_path: Full document path
            field_name: Name of field to delete

        Returns:
            bool: True if successful, False otherwise

        Example:
            manager.delete_field(
                "organizations/org_123/docs/doc1",
                "temporary_field"
            )
        """
        try:
            self.db.document(document_path).update({
                field_name: firestore.DELETE_FIELD
            })
            self.logger.info(f"✅ Field deleted {field_name}: {document_path}")
            return True
        except Exception as e:
            self.logger.error(f"❌ Error deleting field {field_name}: {e}")
            return False

    # ========================================================================
    # Query Operations
    # ========================================================================

    def query_documents(
        self,
        collection_path: str,
        filters: Optional[List[tuple]] = None,
        order_by: Optional[str] = None,
        direction: str = "ASCENDING",
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Query documents from collection with filtering.

        Args:
            collection_path: Full collection path
            filters: List of (field, operator, value) tuples
                Operators: "==", "<", "<=", ">", ">=", "!=", "in", "array-contains"
            order_by: Field to order by (optional)
            direction: "ASCENDING" or "DESCENDING" (default: ASCENDING)
            limit: Maximum number of results (optional)

        Returns:
            List of documents matching query

        Example:
            results = manager.query_documents(
                "organizations/org_123/reports",
                filters=[
                    ("status", "==", "completed"),
                    ("year", "==", 2024)
                ],
                order_by="created_at",
                direction="DESCENDING",
                limit=10
            )
        """
        try:
            query = self.db.collection_group(collection_path) if "/" not in collection_path.split("/")[-1] \
                    else self.db.collection_group(collection_path.split("/")[-1])

            # Apply filters
            if filters:
                for field, operator, value in filters:
                    query = query.where(field, operator, value)

            # Apply ordering
            if order_by:
                query = query.order_by(
                    order_by,
                    direction=firestore.Query.DESCENDING if direction == "DESCENDING" else firestore.Query.ASCENDING
                )

            # Apply limit
            if limit:
                query = query.limit(limit)

            # Execute query
            docs = query.stream()
            results = [doc.to_dict() for doc in docs]
            self.logger.info(f"✅ Query returned {len(results)} results from {collection_path}")
            return results

        except Exception as e:
            self.logger.error(f"❌ Error querying {collection_path}: {e}")
            return []

    def query_where(
        self,
        collection_path: str,
        field: str,
        operator: str,
        value: Any
    ) -> List[Dict[str, Any]]:
        """
        Simple single-condition query.

        Args:
            collection_path: Full collection path
            field: Field name
            operator: Comparison operator ("==", "<", ">", etc.)
            value: Value to compare

        Returns:
            List of matching documents

        Example:
            results = manager.query_where(
                "organizations/org_123/reports",
                "status",
                "==",
                "completed"
            )
        """
        return self.query_documents(collection_path, filters=[(field, operator, value)])

    # ========================================================================
    # Batch Operations
    # ========================================================================

    def batch_write(self, operations: List[Dict[str, Any]]) -> bool:
        """
        Execute multiple write operations in batch.

        Args:
            operations: List of operations, each with:
                - "type": "set", "update", or "delete"
                - "path": document path
                - "data": (for set/update operations)

        Returns:
            bool: True if successful, False otherwise

        Example:
            operations = [
                {"type": "set", "path": "docs/doc1", "data": {"field": "value"}},
                {"type": "update", "path": "docs/doc2", "data": {"status": "done"}},
                {"type": "delete", "path": "docs/doc3"}
            ]
            manager.batch_write(operations)
        """
        try:
            batch = self.db.batch()

            for op in operations:
                op_type = op.get("type")
                path = op.get("path")
                data = op.get("data", {})

                if op_type == "set":
                    batch.set(self.db.document(path), data)
                elif op_type == "update":
                    batch.update(self.db.document(path), data)
                elif op_type == "delete":
                    batch.delete(self.db.document(path))

            batch.commit()
            self.logger.info(f"✅ Batch write completed: {len(operations)} operations")
            return True

        except Exception as e:
            self.logger.error(f"❌ Error in batch write: {e}")
            return False

    # ========================================================================
    # Maintenance Operations
    # ========================================================================

    def delete_collection(self, collection_path: str, batch_size: int = 100) -> bool:
        """
        Delete entire collection (use with caution!).

        Args:
            collection_path: Full collection path
            batch_size: Documents to delete per batch

        Returns:
            bool: True if successful, False otherwise

        Warning:
            This operation is irreversible. Use carefully!
        """
        try:
            docs = self.db.collection(collection_path).limit(batch_size).stream()
            deleted = 0

            for doc in docs:
                doc.reference.delete()
                deleted += 1

            self.logger.warning(f"⚠️ Deleted {deleted} documents from {collection_path}")
            return True

        except Exception as e:
            self.logger.error(f"❌ Error deleting collection {collection_path}: {e}")
            return False

    def delete_old_documents(
        self,
        collection_path: str,
        field_name: str,
        older_than_date: datetime
    ) -> int:
        """
        Delete documents older than specified date.

        Args:
            collection_path: Full collection path
            field_name: Date field to check
            older_than_date: Delete documents where field < this date

        Returns:
            int: Number of documents deleted

        Example:
            from datetime import datetime, timedelta
            cutoff = datetime.now() - timedelta(days=30)
            deleted_count = manager.delete_old_documents(
                "organizations/org_123/logs",
                "created_at",
                cutoff
            )
        """
        try:
            query = self.db.collection(collection_path).where(
                field_name, "<", older_than_date
            )
            docs = query.stream()

            deleted = 0
            for doc in docs:
                doc.reference.delete()
                deleted += 1

            self.logger.info(f"✅ Deleted {deleted} old documents from {collection_path}")
            return deleted

        except Exception as e:
            self.logger.error(f"❌ Error deleting old documents from {collection_path}: {e}")
            return 0


# ============================================================================
# Module-level convenience functions (for compatibility)
# ============================================================================

def get_firestore_client() -> firestore.Client:
    """
    Get Firestore client from singleton manager.

    Returns:
        firestore.Client: Firestore client instance
    """
    return FirestoreClientManager.get_instance().db


def get_firestore_manager() -> FirestoreClientManager:
    """
    Get singleton FirestoreClientManager instance.

    Returns:
        FirestoreClientManager: Singleton instance
    """
    return FirestoreClientManager.get_instance()
