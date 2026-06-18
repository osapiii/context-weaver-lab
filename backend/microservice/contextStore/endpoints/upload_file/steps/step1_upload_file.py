"""Step 1: Import file from GCS into Agent Search datastore."""

import json

from common import ExecutionContext, FatalStepError
from localPackages.core.discovery_engine_client import get_discovery_engine_client


def _struct_data_from_custom_metadata(custom_metadata) -> dict:
    out: dict = {}
    if not custom_metadata:
        return out
    for meta in custom_metadata:
        if isinstance(meta, dict):
            key = meta.get("key") or ""
            val = (
                meta.get("stringValue")
                or meta.get("value")
                or meta.get("numericValue")
            )
            if key and val is not None:
                out[key] = val
        elif hasattr(meta, "key"):
            key = meta.key
            val = getattr(meta, "stringValue", None) or getattr(meta, "value", None)
            if key and val is not None:
                out[key] = val
    return out


def execute(context: ExecutionContext) -> None:
    try:
        input_data = context.input_data
        bucket_name = input_data.bucket_name
        file_path = input_data.file_path
        custom_metadata = getattr(input_data, "custom_metadata", None)
        store_id = context.get("store_id")
        if not store_id:
            raise FatalStepError(
                step_name="step1_upload_file",
                message="store_id is required",
                error_code="MISSING_STORE_ID",
            )
        struct_data = _struct_data_from_custom_metadata(custom_metadata)
        document_id = getattr(input_data, "document_id", None)
        client = get_discovery_engine_client()
        result = client.import_from_gcs(
            data_store_id=store_id,
            bucket_name=bucket_name,
            file_path=file_path,
            document_id=document_id,
            struct_data=struct_data or None,
        )
        context.set("operation_info", result)
        if context.logger:
            context.logger.info(
                f"✅ Imported to Agent Search datastore: {result.get('response', {}).get('name')}",
                emoji="✅",
            )
    except FatalStepError:
        raise
    except Exception as e:
        raise FatalStepError(
            step_name="step1_upload_file",
            message=f"Unexpected error: {str(e)}",
            error_code="UNEXPECTED_ERROR",
        ) from e
