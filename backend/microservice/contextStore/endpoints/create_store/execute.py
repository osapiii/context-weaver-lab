"""
Orchestrator for Create FileSearchStore Endpoint

FileSearchStore作成エンドポイントのオーケストレーター
"""

from common import ExecutionContext, ResponseFormatter, FatalStepError
from endpoints.create_store.steps import step1_create_store


async def handle(context: ExecutionContext) -> dict:
    """
    FileSearchStore作成エンドポイントのOrchestrator
    
    Args:
        context: ExecutionContext
        
    Returns:
        レスポンス辞書
    """
    try:
        step1_create_store.execute(context)
        
        store_info = context.get('store_info')
        # ✅ CORRECT: store_info["response"]を直接outputに設定（階層を減らす）
        # store_infoは{"status_code": 200, "response": {...}}の構造なので、
        # response部分を直接outputに設定
        output_data = store_info.get('response', store_info) if isinstance(store_info, dict) else store_info
        
        return ResponseFormatter.success(
            request_id=context.request_id,
            output=output_data
        )
    except FatalStepError as e:
        if context.logger:
            context.logger.error(
                f"❌ Fatal error in create_store: {str(e)}",
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

