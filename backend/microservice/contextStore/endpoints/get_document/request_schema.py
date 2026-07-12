"""
Request Schema for Get Document Endpoint

RequestDoc標準構造準拠のリクエストスキーマ定義
"""

from pydantic import BaseModel, Field, ConfigDict
from common import StandardOperationMetadata


class GetDocumentInput(BaseModel):
    """Document取得の入力パラメータ（パスパラメータのみ使用）"""
    
    model_config = ConfigDict(populate_by_name=False)


class GetDocumentRequest(BaseModel):
    """RequestDoc標準構造準拠"""
    request_id: str = Field(..., description="リクエスト識別子")
    input: GetDocumentInput = Field(..., description="入力パラメータ")
    operation_metadata: StandardOperationMetadata = Field(
        ...,
        description="操作メタデータ"
    )
    
    model_config = ConfigDict(populate_by_name=False)

