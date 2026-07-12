"""
Request Schema for Upload File to FileSearchStore Endpoint

RequestDoc標準構造準拠のリクエストスキーマ定義
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Union
from common import StandardOperationMetadata


class StringList(BaseModel):
    """文字列リスト（stringListValue用）"""
    values: List[str] = Field(..., description="文字列値のリスト")


class CustomMetadata(BaseModel):
    """
    カスタムメタデータ（公式ドキュメント準拠）
    
    公式ドキュメント: https://ai.google.dev/api/file-search/documents?hl=ja
    CustomMetadataは以下の形式:
    {
      "key": string,
      "stringValue": string,  // または
      "stringListValue": { "values": [string] },  // または
      "numericValue": number
    }
    
    注意: 後方互換性のため、{'key': key, 'value': value}形式のデータは
    step1_upload_file.pyとgemini_client.pyで{'key': key, 'stringValue': value}形式に変換されます。
    """
    key: str = Field(..., description="メタデータのキー")
    stringValue: Optional[str] = Field(None, description="メタデータの文字列値")
    stringListValue: Optional[StringList] = Field(None, description="メタデータの文字列リスト値")
    numericValue: Optional[float] = Field(None, description="メタデータの数値")
    
    model_config = ConfigDict(populate_by_name=True)


class UploadFileInput(BaseModel):
    """ファイルアップロードの入力パラメータ"""
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
    custom_metadata: Optional[List[CustomMetadata]] = Field(
        None,
        description="カスタムメタデータ（key-value形式の配列）",
        alias="customMetadata"
    )
    document_id: Optional[str] = Field(
        None,
        description="Agent Search document ID (省略時は自動生成)",
        alias="documentId",
    )
    
    model_config = ConfigDict(populate_by_name=True)


class UploadFileRequest(BaseModel):
    """RequestDoc標準構造準拠"""
    request_id: str = Field(..., description="リクエスト識別子")
    input: UploadFileInput = Field(..., description="入力パラメータ")
    operation_metadata: StandardOperationMetadata = Field(
        ...,
        description="操作メタデータ"
    )
    
    model_config = ConfigDict(populate_by_name=False)

