"""Step 1: Get Agent Search datastore."""

from common import ExecutionContext, FatalStepError
from localPackages.core.discovery_engine_client import get_discovery_engine_client


def execute(context: ExecutionContext) -> None:
    try:
        store_id = context.get("store_id")
        if not store_id:
            raise FatalStepError(
                step_name="step1_get_store",
                message="store_id is required",
                error_code="MISSING_STORE_ID",
            )
        client = get_discovery_engine_client()
        result = client.get_data_store(store_id)
        context.set("store_info", result)
    except FatalStepError:
        raise
    except Exception as e:
        raise FatalStepError(
            step_name="step1_get_store",
            message=f"Unexpected error: {str(e)}",
            error_code="UNEXPECTED_ERROR",
        ) from e
