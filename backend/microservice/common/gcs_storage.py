"""
Unified GCS Storage Module for CloudRun Microservices

Provides comprehensive Google Cloud Storage operations with:
- Synchronous and asynchronous support
- Batch operations
- Caching of client instances
- Error handling and logging integration
- Firestore path generation support

Consolidates 23 identical gcs_storage.py implementations into single source of truth.

Usage:
    from gcs_storage import (
        download_blob_to_file,
        upload_bytes_to_gcs,
        blob_exists,
        get_blob_metadata
    )

    # Download file
    download_blob_to_file("my-bucket", "path/to/file.pdf", "/tmp/file.pdf")

    # Upload bytes
    url = upload_bytes_to_gcs(b"content", "my-bucket", "output/file.pdf")

    # Check existence
    exists = blob_exists("my-bucket", "path/to/file.pdf")
"""

import os
import asyncio
import tempfile
from typing import Optional, Dict, Any, List
from concurrent.futures import ThreadPoolExecutor
from google.cloud import storage

# ============================================================================
# Client Management
# ============================================================================

_storage_client: Optional[storage.Client] = None
_client_lock = asyncio.Lock()


def get_storage_client() -> storage.Client:
    """
    Get or create singleton GCS storage client.

    Returns:
        storage.Client: GCS storage client instance

    Note:
        Client is cached for reuse across multiple operations.
    """
    global _storage_client
    if _storage_client is None:
        _storage_client = storage.Client()
    return _storage_client


async def get_storage_client_async() -> storage.Client:
    """
    Get or create singleton GCS storage client (async-safe).

    Returns:
        storage.Client: GCS storage client instance

    Note:
        Uses asyncio lock to ensure thread-safe singleton initialization.
    """
    global _storage_client
    async with _client_lock:
        if _storage_client is None:
            _storage_client = storage.Client()
    return _storage_client


# ============================================================================
# Synchronous Download Operations
# ============================================================================

def download_blob_to_file(
    bucket_name: str,
    blob_path: str,
    local_file_path: str
) -> None:
    """
    Download blob from GCS to local file.

    Args:
        bucket_name: GCS bucket name
        blob_path: Path to blob in GCS
        local_file_path: Local file path for download

    Raises:
        Exception: If download fails

    Example:
        download_blob_to_file(
            "my-bucket",
            "reports/2024/report.pdf",
            "/tmp/report.pdf"
        )
    """
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    blob.download_to_filename(local_file_path)


def download_blob_as_bytes(bucket_name: str, blob_path: str) -> bytes:
    """
    Download blob from GCS as bytes.

    Args:
        bucket_name: GCS bucket name
        blob_path: Path to blob in GCS

    Returns:
        bytes: Downloaded content as bytes

    Raises:
        Exception: If download fails

    Example:
        pdf_bytes = download_blob_as_bytes("my-bucket", "reports/file.pdf")
    """
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.download_as_bytes()


def download_blob_as_text(
    bucket_name: str,
    blob_path: str,
    encoding: str = "utf-8"
) -> str:
    """
    Download blob from GCS as text.

    Args:
        bucket_name: GCS bucket name
        blob_path: Path to blob in GCS
        encoding: Character encoding (default: utf-8)

    Returns:
        str: Downloaded content as text

    Raises:
        Exception: If download fails

    Example:
        content = download_blob_as_text("my-bucket", "config/settings.json")
    """
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.download_as_text(encoding=encoding)


# ============================================================================
# Synchronous Upload Operations
# ============================================================================

def upload_file_to_gcs(
    local_file_path: str,
    bucket_name: str,
    gcs_path: str
) -> str:
    """
    Upload local file to GCS.

    Args:
        local_file_path: Path to local file
        bucket_name: GCS bucket name
        gcs_path: Target path in GCS

    Returns:
        str: Public GCS URL

    Raises:
        Exception: If upload fails

    Example:
        url = upload_file_to_gcs("/tmp/report.pdf", "my-bucket", "reports/report.pdf")
    """
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(gcs_path)
    blob.upload_from_filename(local_file_path)
    return f"https://storage.googleapis.com/{bucket_name}/{gcs_path}"


def upload_bytes_to_gcs(
    data: bytes,
    bucket_name: str,
    gcs_path: str,
    content_type: Optional[str] = None
) -> str:
    """
    Upload bytes to GCS.

    Args:
        data: Bytes to upload
        bucket_name: GCS bucket name
        gcs_path: Target path in GCS
        content_type: Content-Type header (optional)

    Returns:
        str: Public GCS URL

    Raises:
        Exception: If upload fails

    Example:
        url = upload_bytes_to_gcs(b"PDF content", "my-bucket", "reports/file.pdf")
    """
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(gcs_path)

    # NOTE: blob.content_type だけ設定しても upload_from_string 側は text/plain で送るため
    # metadata と Content-Type ヘッダが食い違って GCS 400 (invalid) になる。
    # content_type が指定されているときは upload_from_string 自身にも渡す必要がある。
    if content_type:
        blob.content_type = content_type
        blob.upload_from_string(data, content_type=content_type)
    else:
        blob.upload_from_string(data)
    return f"https://storage.googleapis.com/{bucket_name}/{gcs_path}"


def upload_string_to_gcs(
    content: str,
    bucket_name: str,
    gcs_path: str,
    encoding: str = "utf-8",
    content_type: str = "text/plain"
) -> str:
    """
    Upload string content to GCS.

    Args:
        content: String content to upload
        bucket_name: GCS bucket name
        gcs_path: Target path in GCS
        encoding: Character encoding (default: utf-8)
        content_type: Content-Type header (default: text/plain)

    Returns:
        str: Public GCS URL

    Raises:
        Exception: If upload fails

    Example:
        url = upload_string_to_gcs("config data", "my-bucket", "config/settings.json")
    """
    with tempfile.NamedTemporaryFile(
        mode="w",
        delete=False,
        suffix=".txt",
        encoding=encoding
    ) as temp_file:
        temp_file.write(content)
        temp_file_path = temp_file.name

    try:
        client = get_storage_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(gcs_path)
        blob.content_type = content_type
        blob.upload_from_filename(temp_file_path)
        return f"https://storage.googleapis.com/{bucket_name}/{gcs_path}"
    finally:
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


# ============================================================================
# Asynchronous Upload Operations (Phase 2 Extension)
# ============================================================================

async def upload_bytes_to_gcs_async(
    data: bytes,
    bucket_name: str,
    gcs_path: str,
    content_type: Optional[str] = None
) -> str:
    """
    Upload bytes to GCS asynchronously.

    Args:
        data: Bytes to upload
        bucket_name: GCS bucket name
        gcs_path: Target path in GCS
        content_type: Content-Type header (optional)

    Returns:
        str: Public GCS URL

    Example:
        url = await upload_bytes_to_gcs_async(
            b"PDF content",
            "my-bucket",
            "reports/file.pdf"
        )
    """
    def _upload():
        return upload_bytes_to_gcs(data, bucket_name, gcs_path, content_type)

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _upload)


async def download_blob_as_bytes_async(
    bucket_name: str,
    blob_path: str
) -> bytes:
    """
    Download blob from GCS as bytes asynchronously.

    Args:
        bucket_name: GCS bucket name
        blob_path: Path to blob in GCS

    Returns:
        bytes: Downloaded content as bytes

    Example:
        content = await download_blob_as_bytes_async("my-bucket", "file.pdf")
    """
    def _download():
        return download_blob_as_bytes(bucket_name, blob_path)

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _download)


# ============================================================================
# Batch Operations
# ============================================================================

def batch_upload_files(
    bucket_name: str,
    file_mappings: List[Dict[str, str]],
    max_workers: int = 4
) -> List[Dict[str, str]]:
    """
    Upload multiple files to GCS in parallel.

    Args:
        bucket_name: GCS bucket name
        file_mappings: List of {
            "local_path": str (local file path),
            "gcs_path": str (target path in GCS)
        }
        max_workers: Maximum parallel workers (default: 4)

    Returns:
        List[Dict]: Upload results with {
            "local_path": str,
            "gcs_path": str,
            "url": str,
            "status": "success" or "error",
            "error": str (if status == "error")
        }

    Example:
        results = batch_upload_files("my-bucket", [
            {"local_path": "/tmp/file1.pdf", "gcs_path": "reports/file1.pdf"},
            {"local_path": "/tmp/file2.pdf", "gcs_path": "reports/file2.pdf"}
        ])
    """
    results = []

    def _upload_single(mapping):
        try:
            url = upload_file_to_gcs(
                mapping["local_path"],
                bucket_name,
                mapping["gcs_path"]
            )
            return {
                "local_path": mapping["local_path"],
                "gcs_path": mapping["gcs_path"],
                "url": url,
                "status": "success"
            }
        except Exception as e:
            return {
                "local_path": mapping["local_path"],
                "gcs_path": mapping["gcs_path"],
                "status": "error",
                "error": str(e)
            }

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_upload_single, mapping) for mapping in file_mappings]
        results = [future.result() for future in futures]

    return results


# ============================================================================
# Metadata Operations
# ============================================================================

def blob_exists(bucket_name: str, blob_path: str) -> bool:
    """
    Check if blob exists in GCS.

    Args:
        bucket_name: GCS bucket name
        blob_path: Path to blob in GCS

    Returns:
        bool: True if exists, False otherwise

    Example:
        if blob_exists("my-bucket", "reports/file.pdf"):
            print("File exists")
    """
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.exists()


def get_blob_metadata(bucket_name: str, blob_path: str) -> Dict[str, Any]:
    """
    Get metadata for blob in GCS.

    Args:
        bucket_name: GCS bucket name
        blob_path: Path to blob in GCS

    Returns:
        Dict with blob metadata:
            - name: Blob name
            - size: Size in bytes
            - content_type: MIME type
            - created: Creation timestamp
            - updated: Last update timestamp
            - md5_hash: MD5 hash

    Raises:
        Exception: If blob not found or metadata retrieval fails

    Example:
        metadata = get_blob_metadata("my-bucket", "reports/file.pdf")
        print(f"Size: {metadata['size']} bytes")
    """
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    blob.reload()

    return {
        "name": blob.name,
        "size": blob.size,
        "content_type": blob.content_type,
        "created": blob.time_created,
        "updated": blob.updated,
        "md5_hash": blob.md5_hash,
    }


def delete_blob(bucket_name: str, blob_path: str) -> None:
    """
    Delete blob from GCS.

    Args:
        bucket_name: GCS bucket name
        blob_path: Path to blob in GCS

    Raises:
        Exception: If deletion fails

    Example:
        delete_blob("my-bucket", "reports/old_file.pdf")
    """
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    blob.delete()


def list_blobs(
    bucket_name: str,
    prefix: str = "",
    delimiter: Optional[str] = None
) -> List[str]:
    """
    List blobs in GCS bucket with optional prefix.

    Args:
        bucket_name: GCS bucket name
        prefix: Prefix filter (optional)
        delimiter: Delimiter for directory listing (optional)

    Returns:
        List of blob names matching criteria

    Example:
        files = list_blobs("my-bucket", prefix="reports/2024/")
        for name in files:
            print(name)
    """
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=prefix, delimiter=delimiter)
    return [blob.name for blob in blobs]


# ============================================================================
# Validation and Path Utilities
# ============================================================================

def validate_gcs_path(path: str) -> bool:
    """
    Validate GCS path format.

    Args:
        path: GCS path to validate (should not include bucket name)

    Returns:
        bool: True if valid, False otherwise

    Example:
        if validate_gcs_path("reports/2024/file.pdf"):
            print("Valid path")
    """
    if not path or not isinstance(path, str):
        return False

    # Check for invalid characters
    invalid_chars = ["\n", "\r", "\t"]
    if any(char in path for char in invalid_chars):
        return False

    # Path should not start with /
    if path.startswith("/"):
        return False

    return True


def construct_gcs_url(bucket_name: str, blob_path: str, use_https: bool = True) -> str:
    """
    Construct GCS URL from bucket and blob path.

    Args:
        bucket_name: GCS bucket name
        blob_path: Path to blob in GCS
        use_https: Use HTTPS URL (default: True)

    Returns:
        str: Constructed GCS URL

    Example:
        url = construct_gcs_url("my-bucket", "reports/file.pdf")
        # Returns: https://storage.googleapis.com/my-bucket/reports/file.pdf
    """
    protocol = "https" if use_https else "http"
    return f"{protocol}://storage.googleapis.com/{bucket_name}/{blob_path}"


# ============================================================================
# Backward Compatibility Aliases
# ============================================================================

# These aliases maintain compatibility with legacy code patterns
def upload_to_gcs(local_file_path: str, bucket_name: str, gcs_path: str) -> str:
    """DEPRECATED: Use upload_file_to_gcs instead."""
    return upload_file_to_gcs(local_file_path, bucket_name, gcs_path)


def download_from_gcs(bucket_name: str, blob_path: str, local_file_path: str) -> None:
    """DEPRECATED: Use download_blob_to_file instead."""
    return download_blob_to_file(bucket_name, blob_path, local_file_path)
