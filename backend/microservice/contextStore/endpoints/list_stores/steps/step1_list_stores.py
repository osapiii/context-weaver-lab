"""Step 1: List Agent Search datastores."""

from common import ExecutionContext, FatalStepError
from localPackages.core.discovery_engine_client import get_discovery_engine_client


def execute(context: ExecutionContext) -> None:
    try:
        client = get_discovery_engine_client()
        result = client.list_data_stores()
        context.set("stores_info", result)
    except FatalStepError:
        raise
    except Exception as e:
        raise FatalStepError(
            step_name="step1_list_stores",
            message=f"Unexpected error: {str(e)}",
            error_code="UNEXPECTED_ERROR",
        ) from e
