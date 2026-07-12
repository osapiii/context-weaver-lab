"""Step 1: Get document from datastore."""

from common import ExecutionContext, FatalStepError
from localPackages.core.discovery_engine_client import get_discovery_engine_client


def execute(context: ExecutionContext) -> None:
    try:
        store_id = context.get("store_id")
        document_id = context.get("document_id")
        if not store_id or not document_id:
            raise FatalStepError(
                step_name="step1_get_document",
                message="store_id and document_id are required",
                error_code="MISSING_PARAMS",
            )
        client = get_discovery_engine_client()
        result = client.get_document(store_id, document_id)
        context.set("document_info", result)
    except FatalStepError:
        raise
    except Exception as e:
        raise FatalStepError(
            step_name="step1_get_document",
            message=f"Unexpected error: {str(e)}",
            error_code="UNEXPECTED_ERROR",
        ) from e
