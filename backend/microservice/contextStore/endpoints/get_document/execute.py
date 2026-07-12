"""
Orchestrator for Get Document Endpoint

Document情報取得エンドポイントのオーケストレーター
"""

from common import ExecutionContext, ResponseFormatter, FatalStepError
from endpoints.get_document.steps import step1_get_document


async def handle(context: ExecutionContext) -> dict:
    """
    Document情報取得エンドポイントのOrchestrator
    
    Args:
        context: ExecutionContext
        
    Returns:
        レスポンス辞書
    """
    try:
        step1_get_document.execute(context)
        
        document_info = context.get('document_info')
        return ResponseFormatter.success(
            request_id=context.request_id,
            output=document_info
        )
    except FatalStepError as e:
        if context.logger:
            context.logger.error(
                f"❌ Fatal error in get_document: {str(e)}",
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

