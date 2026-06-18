"""
Unified BigQuery Client Manager for CloudRun Microservices

Provides centralized BigQuery operations with:
- Singleton ClientManager pattern
- Query execution (synchronous and asynchronous)
- Data loading from GCS and pandas DataFrames
- Table and schema metadata operations
- Cost estimation and query optimization helpers

Consolidates 3+ separate BigQuery implementations into single source.

Design Principles:
- Singleton pattern for ClientManager (one client per process)
- Type-safe operations with proper error handling
- Integration with GCS for data import/export
- Query parameter support for security

Usage:
    from bigquery import BigQueryClientManager

    # Get singleton client manager
    manager = BigQueryClientManager.get_instance()

    # Execute query
    results = manager.execute_query(
        "SELECT * FROM `project.dataset.table` WHERE year = @year",
        parameters=[("year", "INTEGER", 2024)]
    )

    # Load data from GCS
    manager.load_csv_from_gcs(
        "gs://bucket/data.csv",
        "project:dataset.table"
    )

    # Get table schema
    schema = manager.get_table_schema("project:dataset.table")
"""

import logging
from typing import Optional, Dict, Any, List, Tuple, Union
from threading import Lock
from datetime import datetime, timedelta
import pandas as pd
from google.cloud import bigquery
from google.cloud.exceptions import NotFound, BadRequest
from google.api_core.exceptions import Forbidden


# ============================================================================
# Singleton Client Manager
# ============================================================================

class BigQueryClientManager:
    """
    Singleton manager for BigQuery operations.

    Ensures only one client instance exists per process.
    Provides thread-safe access to BigQuery service.
    """

    _instance: Optional["BigQueryClientManager"] = None
    _lock = Lock()

    def __init__(self):
        """Initialize BigQuery client (called once)."""
        self.client = bigquery.Client()
        self.logger = logging.getLogger(__name__)

    @classmethod
    def get_instance(cls) -> "BigQueryClientManager":
        """
        Get or create singleton instance.

        Returns:
            BigQueryClientManager: Singleton instance

        Example:
            manager = BigQueryClientManager.get_instance()
        """
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # ========================================================================
    # Query Execution (Synchronous)
    # ========================================================================

    def execute_query(
        self,
        query: str,
        parameters: Optional[List[Tuple[str, str, Any]]] = None,
        use_legacy_sql: bool = False,
        location: str = "US"
    ) -> List[Dict[str, Any]]:
        """
        Execute BigQuery query synchronously.

        Args:
            query: SQL query string (use @param for parameterized queries)
            parameters: List of (name, type, value) tuples for query parameters
            use_legacy_sql: Use legacy SQL dialect (default: False - Standard SQL)
            location: BigQuery location (default: US)

        Returns:
            List of result rows as dicts

        Example:
            results = manager.execute_query(
                "SELECT * FROM `project.dataset.table` WHERE year = @year",
                parameters=[("year", "INTEGER", 2024)]
            )
            for row in results:
                print(row["name"])
        """
        try:
            # Configure job
            job_config = bigquery.QueryJobConfig(
                use_legacy_sql=use_legacy_sql,
                location=location
            )

            # Add parameters if provided
            if parameters:
                job_config.query_parameters = [
                    bigquery.ScalarQueryParameter(name, param_type, value)
                    for name, param_type, value in parameters
                ]

            # Execute query
            query_job = self.client.query(query, job_config=job_config)
            results = list(query_job.result())

            self.logger.info(f"✅ Query executed: {len(results)} rows returned")
            return [dict(row) for row in results]

        except BadRequest as e:
            self.logger.error(f"❌ Invalid query: {e}")
            return []
        except Forbidden as e:
            self.logger.error(f"❌ Permission denied: {e}")
            return []
        except Exception as e:
            self.logger.error(f"❌ Error executing query: {e}")
            return []

    def execute_query_to_dataframe(
        self,
        query: str,
        parameters: Optional[List[Tuple[str, str, Any]]] = None,
        use_legacy_sql: bool = False
    ) -> Optional[pd.DataFrame]:
        """
        Execute BigQuery query and return as pandas DataFrame.

        Args:
            query: SQL query string
            parameters: List of (name, type, value) tuples for query parameters
            use_legacy_sql: Use legacy SQL dialect (default: False)

        Returns:
            pandas DataFrame or None if query fails

        Example:
            df = manager.execute_query_to_dataframe(
                "SELECT name, sales FROM `project.dataset.sales` WHERE year = @year",
                parameters=[("year", "INTEGER", 2024)]
            )
            if df is not None:
                print(df.head())
        """
        try:
            job_config = bigquery.QueryJobConfig(use_legacy_sql=use_legacy_sql)

            if parameters:
                job_config.query_parameters = [
                    bigquery.ScalarQueryParameter(name, param_type, value)
                    for name, param_type, value in parameters
                ]

            df = self.client.query_and_wait(query, job_config=job_config).to_dataframe()
            self.logger.info(f"✅ Query executed: {len(df)} rows to DataFrame")
            return df

        except Exception as e:
            self.logger.error(f"❌ Error executing query to DataFrame: {e}")
            return None

    # ========================================================================
    # Data Loading
    # ========================================================================

    def load_csv_from_gcs(
        self,
        gcs_path: str,
        table_id: str,
        schema: Optional[List[bigquery.SchemaField]] = None,
        skip_leading_rows: int = 1,
        write_disposition: str = "WRITE_TRUNCATE"
    ) -> bool:
        """
        Load CSV from GCS into BigQuery table.

        Args:
            gcs_path: GCS path (e.g., "gs://bucket/data.csv")
            table_id: BigQuery table ID (e.g., "project:dataset.table")
            schema: Table schema (auto-detected if not provided)
            skip_leading_rows: Skip first N rows (default: 1)
            write_disposition: Write mode - "WRITE_TRUNCATE" or "WRITE_APPEND"

        Returns:
            bool: True if successful, False otherwise

        Example:
            manager.load_csv_from_gcs(
                "gs://my-bucket/sales_data.csv",
                "myproject:mydataset.sales"
            )
        """
        try:
            job_config = bigquery.LoadJobConfig(
                skip_leading_rows=skip_leading_rows,
                autodetect=schema is None,
                write_disposition=write_disposition
            )

            if schema:
                job_config.schema = schema

            load_job = self.client.load_table_from_uri(
                gcs_path,
                table_id,
                job_config=job_config
            )
            load_job.result()

            self.logger.info(f"✅ Loaded data from {gcs_path} to {table_id}")
            return True

        except NotFound:
            self.logger.error(f"❌ Table not found: {table_id}")
            return False
        except Exception as e:
            self.logger.error(f"❌ Error loading CSV: {e}")
            return False

    def load_dataframe(
        self,
        dataframe: pd.DataFrame,
        table_id: str,
        write_disposition: str = "WRITE_TRUNCATE"
    ) -> bool:
        """
        Load pandas DataFrame into BigQuery table.

        Args:
            dataframe: pandas DataFrame to load
            table_id: BigQuery table ID (e.g., "project:dataset.table")
            write_disposition: Write mode - "WRITE_TRUNCATE" or "WRITE_APPEND"

        Returns:
            bool: True if successful, False otherwise

        Example:
            import pandas as pd
            df = pd.DataFrame({
                "name": ["Alice", "Bob"],
                "score": [95, 87]
            })
            manager.load_dataframe(df, "myproject:mydataset.scores")
        """
        try:
            job_config = bigquery.LoadJobConfig(
                write_disposition=write_disposition
            )

            load_job = self.client.load_table_from_dataframe(
                dataframe,
                table_id,
                job_config=job_config
            )
            load_job.result()

            self.logger.info(f"✅ Loaded {len(dataframe)} rows to {table_id}")
            return True

        except NotFound:
            self.logger.error(f"❌ Table not found: {table_id}")
            return False
        except Exception as e:
            self.logger.error(f"❌ Error loading DataFrame: {e}")
            return False

    # ========================================================================
    # Table and Schema Operations
    # ========================================================================

    def table_exists(self, table_id: str) -> bool:
        """
        Check if table exists in BigQuery.

        Args:
            table_id: BigQuery table ID (e.g., "project:dataset.table")

        Returns:
            bool: True if exists, False otherwise

        Example:
            if manager.table_exists("myproject:mydataset.users"):
                print("Table exists")
        """
        try:
            self.client.get_table(table_id)
            return True
        except NotFound:
            return False
        except Exception as e:
            self.logger.error(f"❌ Error checking table existence: {e}")
            return False

    def get_table_schema(self, table_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get BigQuery table schema.

        Args:
            table_id: BigQuery table ID (e.g., "project:dataset.table")

        Returns:
            List of field dicts or None if table not found

        Example:
            schema = manager.get_table_schema("myproject:mydataset.users")
            for field in schema:
                print(f"{field['name']}: {field['type']}")
        """
        try:
            table = self.client.get_table(table_id)
            schema_fields = []

            for field in table.schema:
                schema_fields.append({
                    "name": field.name,
                    "type": field.field_type,
                    "mode": field.mode,
                    "description": field.description
                })

            return schema_fields

        except NotFound:
            self.logger.error(f"❌ Table not found: {table_id}")
            return None
        except Exception as e:
            self.logger.error(f"❌ Error getting schema: {e}")
            return None

    def get_table_info(self, table_id: str) -> Optional[Dict[str, Any]]:
        """
        Get comprehensive BigQuery table information.

        Args:
            table_id: BigQuery table ID (e.g., "project:dataset.table")

        Returns:
            Dict with table metadata or None if not found

        Example:
            info = manager.get_table_info("myproject:mydataset.users")
            print(f"Rows: {info['num_rows']}, Size: {info['num_bytes']} bytes")
        """
        try:
            table = self.client.get_table(table_id)

            return {
                "table_id": table.table_id,
                "dataset_id": table.dataset_id,
                "project": table.project,
                "num_rows": table.num_rows,
                "num_bytes": table.num_bytes,
                "created": table.created,
                "expires": table.expires,
                "modified": table.modified,
                "schema": [
                    {
                        "name": f.name,
                        "type": f.field_type,
                        "mode": f.mode
                    }
                    for f in table.schema
                ]
            }

        except NotFound:
            self.logger.error(f"❌ Table not found: {table_id}")
            return None
        except Exception as e:
            self.logger.error(f"❌ Error getting table info: {e}")
            return None

    def create_table(
        self,
        table_id: str,
        schema: List[bigquery.SchemaField],
        description: Optional[str] = None
    ) -> bool:
        """
        Create new BigQuery table.

        Args:
            table_id: BigQuery table ID (e.g., "project:dataset.table")
            schema: List of SchemaField objects defining table structure
            description: Table description (optional)

        Returns:
            bool: True if successful, False otherwise

        Example:
            schema = [
                bigquery.SchemaField("name", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("age", "INTEGER", mode="NULLABLE"),
            ]
            manager.create_table("myproject:mydataset.users", schema)
        """
        try:
            table = bigquery.Table(table_id, schema=schema)
            if description:
                table.description = description

            self.client.create_table(table)
            self.logger.info(f"✅ Table created: {table_id}")
            return True

        except Exception as e:
            self.logger.error(f"❌ Error creating table: {e}")
            return False

    def delete_table(self, table_id: str) -> bool:
        """
        Delete BigQuery table.

        Args:
            table_id: BigQuery table ID (e.g., "project:dataset.table")

        Returns:
            bool: True if successful, False otherwise

        Warning:
            This operation is irreversible!

        Example:
            manager.delete_table("myproject:mydataset.old_table")
        """
        try:
            self.client.delete_table(table_id, not_found_ok=True)
            self.logger.info(f"✅ Table deleted: {table_id}")
            return True

        except Exception as e:
            self.logger.error(f"❌ Error deleting table: {e}")
            return False

    # ========================================================================
    # Utility Functions
    # ========================================================================

    def convert_dataframe_to_dict(
        self,
        dataframe: pd.DataFrame
    ) -> List[Dict[str, Any]]:
        """
        Convert pandas DataFrame to list of dicts.

        Args:
            dataframe: pandas DataFrame

        Returns:
            List of row dicts

        Example:
            df = pd.DataFrame({"name": ["Alice"], "age": [30]})
            rows = manager.convert_dataframe_to_dict(df)
            # [{"name": "Alice", "age": 30}]
        """
        return dataframe.to_dict(orient="records")

    def estimate_query_cost(
        self,
        query: str,
        parameters: Optional[List[Tuple[str, str, Any]]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Estimate cost of query (dry run).

        Dry run doesn't actually execute the query, just estimates cost.

        Args:
            query: SQL query string
            parameters: List of (name, type, value) tuples for query parameters

        Returns:
            Dict with cost estimate or None if estimate fails

        Example:
            cost = manager.estimate_query_cost(
                "SELECT * FROM `project.dataset.large_table`"
            )
            if cost:
                print(f"Bytes scanned: {cost['bytes_processed']}")
        """
        try:
            job_config = bigquery.QueryJobConfig(dry_run=True)

            if parameters:
                job_config.query_parameters = [
                    bigquery.ScalarQueryParameter(name, param_type, value)
                    for name, param_type, value in parameters
                ]

            query_job = self.client.query(query, job_config=job_config)

            return {
                "bytes_processed": query_job.total_bytes_processed,
                "bytes_billed": query_job.total_bytes_billed,
                "estimated_cost_usd": (query_job.total_bytes_billed or 0) / (1024 ** 4) * 5.0  # $5 per TB
            }

        except Exception as e:
            self.logger.error(f"❌ Error estimating query cost: {e}")
            return None

    def get_query_job_info(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a BigQuery job.

        Args:
            job_id: BigQuery job ID

        Returns:
            Dict with job information or None if job not found

        Example:
            info = manager.get_query_job_info("job_abc123")
            print(f"State: {info['state']}, Bytes processed: {info['bytes_processed']}")
        """
        try:
            job = self.client.get_job(job_id)

            return {
                "job_id": job.job_id,
                "state": job.state,
                "started": job.started,
                "ended": job.ended,
                "total_bytes_processed": job.total_bytes_processed,
                "total_bytes_billed": job.total_bytes_billed,
                "errors": job.errors if job.errors else []
            }

        except NotFound:
            self.logger.error(f"❌ Job not found: {job_id}")
            return None
        except Exception as e:
            self.logger.error(f"❌ Error getting job info: {e}")
            return None


# ============================================================================
# Module-level convenience functions
# ============================================================================

def get_bigquery_client() -> bigquery.Client:
    """
    Get BigQuery client from singleton manager.

    Returns:
        bigquery.Client: BigQuery client instance
    """
    return BigQueryClientManager.get_instance().client


def get_bigquery_manager() -> BigQueryClientManager:
    """
    Get singleton BigQueryClientManager instance.

    Returns:
        BigQueryClientManager: Singleton instance
    """
    return BigQueryClientManager.get_instance()
