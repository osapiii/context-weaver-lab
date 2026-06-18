"""
Orchestrator for Upload Files Batch to FileSearchStore Endpoint

バッチファイルアップロードエンドポイントのオーケストレーター
既存のupload_file/execute.pyを参考に実装
"""

from common import ExecutionContext, ResponseFormatter, FatalStepError
from endpoints.upload_files_batch.steps import step1_upload_files_batch


async def handle(context: ExecutionContext) -> dict:
    """
    バッチファイルアップロードエンドポイントのOrchestrator
    
    Args:
        context: ExecutionContext
        
    Returns:
        レスポンス辞書
    """
    try:
        step1_upload_files_batch.execute(context)
        
        batch_results = context.get('batch_results')
        return ResponseFormatter.success(
            request_id=context.request_id,
            output={
                'results': batch_results
            }
        )
    except FatalStepError as e:
        if context.logger:
            context.logger.error(
                f"❌ Fatal error in upload_files_batch: {str(e)}",
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

