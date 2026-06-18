"""
Step 1: Create FileSearchStore

FileSearchStoreを作成するステップ
"""

from common import ExecutionContext, FatalStepError
from localPackages.core.discovery_engine_client import get_discovery_engine_client


def execute(context: ExecutionContext) -> None:
    """
    FileSearchStoreを作成
    
    Args:
        context: ExecutionContext
        
    Raises:
        FatalStepError: 処理失敗時
    """
    try:
        input_data = context.input_data
        display_name = input_data.display_name if hasattr(input_data, 'display_name') else None
        data_store_id = getattr(input_data, 'data_store_id', None)

        client = get_discovery_engine_client()
        result = client.create_data_store(
            display_name=display_name,
            data_store_id=data_store_id,
        )
        
        context.set('store_info', result)
        
        if context.logger:
            response = result.get('response', {})
            store_name = response.get('name', 'unknown')
            context.logger.info(
                f"✅ Context store (datastore) created: {store_name}",
                emoji="✅"
            )
    except FatalStepError:
        raise
    except Exception as e:
        raise FatalStepError(
            step_name='step1_create_store',
            message=f'Unexpected error: {str(e)}',
            error_code='UNEXPECTED_ERROR'
        )

