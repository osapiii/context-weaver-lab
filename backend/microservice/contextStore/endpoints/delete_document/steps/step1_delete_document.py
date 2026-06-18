"""Step 1: Delete document from Agent Search datastore."""

from common import ExecutionContext, FatalStepError
from localPackages.core.discovery_engine_client import get_discovery_engine_client


def execute(context: ExecutionContext) -> None:
    try:
        store_id = context.get("store_id")
        document_id = context.get("document_id")
        if not store_id:
            raise FatalStepError(
                step_name="step1_delete_document",
                message="store_id is required",
                error_code="MISSING_STORE_ID",
            )
        if not document_id:
            raise FatalStepError(
                step_name="step1_delete_document",
                message="document_id is required",
                error_code="MISSING_DOCUMENT_ID",
            )
        client = get_discovery_engine_client()
        result = client.delete_document(store_id, document_id)
        context.set("delete_result", result)
        if context.logger:
            context.logger.info(
                f"✅ Document deleted from datastore: {store_id}/{document_id}",
                emoji="✅",
            )
    except FatalStepError:
        raise
    except Exception as e:
        raise FatalStepError(
            step_name="step1_delete_document",
            message=f"Unexpected error: {str(e)}",
            error_code="UNEXPECTED_ERROR",
        ) from e
