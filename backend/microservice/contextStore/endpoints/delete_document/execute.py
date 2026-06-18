"""
Orchestrator for Delete Document Endpoint

Document削除エンドポイントのオーケストレーター
"""

from common import ExecutionContext, ResponseFormatter, FatalStepError
from endpoints.delete_document.steps import step1_delete_document


async def handle(context: ExecutionContext) -> dict:
    """
    Document削除エンドポイントのOrchestrator
    
    Args:
        context: ExecutionContext
        
    Returns:
        レスポンス辞書
    """
    try:
        step1_delete_document.execute(context)
        
        delete_result = context.get('delete_result')
        return ResponseFormatter.success(
            request_id=context.request_id,
            output=delete_result
        )
    except FatalStepError as e:
        if context.logger:
            context.logger.error(
                f"❌ Fatal error in delete_document: {str(e)}",
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

