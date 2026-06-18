"""
Request Schema for Create FileSearchStore Endpoint

RequestDoc標準構造準拠のリクエストスキーマ定義
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from common import StandardOperationMetadata


class CreateStoreInput(BaseModel):
    """Agent Search datastore 作成の入力パラメータ"""
    display_name: Optional[str] = Field(
        None,
        description="Datastore の表示名",
    )
    data_store_id: Optional[str] = Field(
        None,
        description="Datastore ID (= FileSpace ID). 未指定時は自動生成",
    )

    model_config = ConfigDict(populate_by_name=False)


class CreateStoreRequest(BaseModel):
    """RequestDoc標準構造準拠"""
    request_id: str = Field(..., description="リクエスト識別子")
    input: CreateStoreInput = Field(..., description="入力パラメータ")
    operation_metadata: StandardOperationMetadata = Field(
        ...,
        description="操作メタデータ"
    )
    
    model_config = ConfigDict(populate_by_name=False)

