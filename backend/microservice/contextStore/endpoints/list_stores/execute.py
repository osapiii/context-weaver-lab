"""
Orchestrator for List FileSearchStores Endpoint

FileSearchStore一覧取得エンドポイントのオーケストレーター
"""

from common import ExecutionContext, ResponseFormatter, FatalStepError
from endpoints.list_stores.steps import step1_list_stores


async def handle(context: ExecutionContext) -> dict:
    """
    FileSearchStore一覧取得エンドポイントのOrchestrator
    
    Args:
        context: ExecutionContext
        
    Returns:
        レスポンス辞書
    """
    try:
        step1_list_stores.execute(context)
        
        stores_info = context.get('stores_info')
        return ResponseFormatter.success(
            request_id=context.request_id,
            output=stores_info
        )
    except FatalStepError as e:
        if context.logger:
            context.logger.error(
                f"❌ Fatal error in list_stores: {str(e)}",
                emoji="❌"
            )
        return ResponseFormatter.error(
            request_id=context.request_id,
            error_type="StepExecutionError",
            message=str(e),
            status_code=500
        )
    except Exception as e:
        if context.logger:
            context.logger.error(
                f"❌ Unexpected error: {str(e)}",
                emoji="❌",
                exc_info=True
            )
        return ResponseFormatter.error(
            request_id=context.request_id,
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )
