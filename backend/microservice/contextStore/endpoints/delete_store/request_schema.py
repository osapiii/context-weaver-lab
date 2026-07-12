"""
Request Schema for Delete FileSearchStore Endpoint

RequestDoc標準構造準拠のリクエストスキーマ定義
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from common import StandardOperationMetadata


class DeleteStoreInput(BaseModel):
    """FileSearchStore削除の入力パラメータ"""
    force: Optional[bool] = Field(
        default=True,
        description="強制削除フラグ（デフォルト: True）"
    )
    
    model_config = ConfigDict(populate_by_name=False)


class DeleteStoreRequest(BaseModel):
    """RequestDoc標準構造準拠"""
    request_id: str = Field(..., description="リクエスト識別子")
    input: DeleteStoreInput = Field(..., description="入力パラメータ")
    operation_metadata: StandardOperationMetadata = Field(
        ...,
        description="操作メタデータ"
    )
    
    model_config = ConfigDict(populate_by_name=False)

