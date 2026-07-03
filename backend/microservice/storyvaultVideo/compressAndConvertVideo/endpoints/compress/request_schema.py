"""
/compress エンドポイントのリクエストスキーマ

RequestDocアーキテクチャ準拠。
"""

from pydantic import BaseModel, Field
from typing import Optional


class CompressRequestInput(BaseModel):
    """input セクション"""
    sourceBucketName: str = Field(..., description="ソース動画のGCSバケット名")
    sourceFilePath: str = Field(..., min_length=1, description="ソース動画のGCSファイルパス")
    outputBucketName: str = Field(..., description="出力先GCSバケット名")
    videoId: str = Field(..., description="動画ID")
    organizationId: str = Field(..., description="組織ID")
    spaceId: str = Field(..., description="スペースID")


class CompressRequestSystemMetadata(BaseModel):
    """systemMetadata セクション"""
    loggingCollectionId: str = Field(..., description="ログ保存先Collection ID")
    loggingDocumentId: str = Field(..., description="ログ保存先Document ID")
    requestedBy: dict = Field(..., description="リクエスト実行者情報")
    isCommand: bool = Field(..., description="コマンド実行フラグ")
    isOouiCrud: bool = Field(..., description="OOUI CRUDフラグ")
    isLlmCall: bool = Field(default=False, description="LLM呼び出しフラグ")
    isAdminCrud: bool = Field(..., description="管理者CRUDフラグ")


class CompressRequest(BaseModel):
    """/compress エンドポイントのリクエストスキーマ"""
    request_id: str = Field(..., description="リクエストID")
    input: CompressRequestInput = Field(..., description="入力パラメータ")
    systemMetadata: CompressRequestSystemMetadata = Field(..., description="システムメタデータ")
