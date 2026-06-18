"""
Request Schema for Delete Document Endpoint

RequestDoc標準構造準拠のリクエストスキーマ定義
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from common import StandardOperationMetadata


class DeleteDocumentInput(BaseModel):
    """Document削除の入力パラメータ"""
    force: Optional[bool] = Field(
        default=True,
        description="強制削除フラグ（デフォルト: True）。trueに設定すると、このDocumentに関連するChunkとオブジェクトも削除されます。"
    )
    
    model_config = ConfigDict(populate_by_name=False)


class DeleteDocumentRequest(BaseModel):
    """RequestDoc標準構造準拠"""
    request_id: str = Field(..., description="リクエスト識別子")
    input: DeleteDocumentInput = Field(..., description="入力パラメータ")
    operation_metadata: StandardOperationMetadata = Field(
        ...,
        description="操作メタデータ"
    )
    
    model_config = ConfigDict(populate_by_name=False)

