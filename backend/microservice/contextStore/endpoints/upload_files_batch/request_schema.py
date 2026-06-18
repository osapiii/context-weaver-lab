"""
Request Schema for Upload Files Batch to FileSearchStore Endpoint

RequestDoc標準構造準拠のバッチリクエストスキーマ定義
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List
from common import StandardOperationMetadata


class FileInput(BaseModel):
    """バッチ登録用のファイル入力パラメータ"""
    bucket_name: str = Field(
        ...,
        description="GCSバケット名",
        alias="bucketName"
    )
    file_path: str = Field(
        ...,
        description="GCS内のファイルパス（バケット名を除く）",
        alias="filePath"
    )
    mime_type: Optional[str] = Field(
        None,
        description="ファイルのMIMEタイプ（例: application/pdf, image/jpeg）",
        alias="mimeType"
    )
    
    model_config = ConfigDict(populate_by_name=True)


class UploadFilesBatchInput(BaseModel):
    """バッチファイルアップロードの入力パラメータ"""
    files: List[FileInput] = Field(
        ...,
        description="アップロードするファイルのリスト（最大50件）",
        min_length=1,
        max_length=50
    )
    
    @field_validator('files')
    @classmethod
    def validate_files_count(cls, v):
        if len(v) > 50:
            raise ValueError('files配列は最大50件までです')
        return v


class UploadFilesBatchRequest(BaseModel):
    """RequestDoc標準構造準拠"""
    request_id: str = Field(..., description="リクエスト識別子")
    input: UploadFilesBatchInput = Field(..., description="入力パラメータ")
    operation_metadata: StandardOperationMetadata = Field(
        ...,
        description="操作メタデータ"
    )
    
    model_config = ConfigDict(populate_by_name=False)

