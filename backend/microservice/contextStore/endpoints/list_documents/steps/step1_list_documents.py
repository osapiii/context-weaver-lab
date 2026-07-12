"""Step 1: List documents in datastore."""

from common import ExecutionContext, FatalStepError
from localPackages.core.discovery_engine_client import get_discovery_engine_client


def execute(context: ExecutionContext) -> None:
    try:
        store_id = context.get("store_id")
        if not store_id:
            raise FatalStepError(
                step_name="step1_list_documents",
                message="store_id is required",
                error_code="MISSING_STORE_ID",
            )
        client = get_discovery_engine_client()
        result = client.list_documents(store_id)
        context.set("documents_info", result)
    except FatalStepError:
        raise
    except Exception as e:
        raise FatalStepError(
            step_name="step1_list_documents",
            message=f"Unexpected error: {str(e)}",
            error_code="UNEXPECTED_ERROR",
        ) from e
