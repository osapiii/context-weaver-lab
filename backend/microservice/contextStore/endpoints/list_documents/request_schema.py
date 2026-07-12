"""
Request Schema for List Documents Endpoint

RequestDoc標準構造準拠のリクエストスキーマ定義
"""

from pydantic import BaseModel, Field, ConfigDict
from common import StandardOperationMetadata


class ListDocumentsInput(BaseModel):
    """Document一覧取得の入力パラメータ（パラメータなし）"""
    
    model_config = ConfigDict(populate_by_name=False)


class ListDocumentsRequest(BaseModel):
    """RequestDoc標準構造準拠"""
    request_id: str = Field(..., description="リクエスト識別子")
    input: ListDocumentsInput = Field(..., description="入力パラメータ")
    operation_metadata: StandardOperationMetadata = Field(
        ...,
        description="操作メタデータ"
    )
    
    model_config = ConfigDict(populate_by_name=False)

