"""
Request Schema for List FileSearchStores Endpoint

RequestDoc標準構造準拠のリクエストスキーマ定義
"""

from pydantic import BaseModel, Field, ConfigDict
from common import StandardOperationMetadata


class ListStoresInput(BaseModel):
    """FileSearchStore一覧取得の入力パラメータ（パラメータなし）"""
    
    model_config = ConfigDict(populate_by_name=False)


class ListStoresRequest(BaseModel):
    """RequestDoc標準構造準拠"""
    request_id: str = Field(..., description="リクエスト識別子")
    input: ListStoresInput = Field(..., description="入力パラメータ")
    operation_metadata: StandardOperationMetadata = Field(
        ...,
        description="操作メタデータ"
    )
    
    model_config = ConfigDict(populate_by_name=False)

