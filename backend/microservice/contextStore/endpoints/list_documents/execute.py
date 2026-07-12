"""
Orchestrator for List Documents Endpoint

Document一覧取得エンドポイントのオーケストレーター
"""

from common import ExecutionContext, ResponseFormatter, FatalStepError
from endpoints.list_documents.steps import step1_list_documents


async def handle(context: ExecutionContext) -> dict:
    """
    Document一覧取得エンドポイントのOrchestrator
    
    Args:
        context: ExecutionContext
        
    Returns:
        レスポンス辞書
    """
    try:
        step1_list_documents.execute(context)
        
        result = context.get('documents_info')
        next_page_token = context.get('next_page_token')
        
        # resultはstatus_codeとresponseを含む辞書形式
        output = result
        if next_page_token:
            # responseにnextPageTokenを追加
            if 'response' in output:
                output['response']['nextPageToken'] = next_page_token
        
        return ResponseFormatter.success(
            request_id=context.request_id,
            output=output
        )
    except FatalStepError as e:
        if context.logger:
            context.logger.error(
                f"❌ Fatal error in list_documents: {str(e)}",
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
