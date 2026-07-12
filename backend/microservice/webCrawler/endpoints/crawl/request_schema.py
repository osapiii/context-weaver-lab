"""
Request Schema for Crawl Endpoint

RequestDoc標準構造準拠のリクエストスキーマ定義
Phase R-1c: drive_config を撤去 (GCS が SSOT、Drive 経由は廃止)
"""

from pydantic import BaseModel, Field, ConfigDict, HttpUrl
from typing import Optional, Dict, Any
from common import StandardOperationMetadata


class CrawlInput(BaseModel):
    """WEBページクロールの入力パラメータ"""

    url: HttpUrl = Field(..., description="クロール対象のURL")
    bucket_name: str = Field(
        ..., description="保存先GCSバケット名 (実 upload 時は step 内で再決定)"
    )
    folder_path: str = Field(..., description="GCS バックアップ用フォルダパス")
    max_depth: int = Field(
        ..., description="クロールの階層の深さ（必須）", gt=0, le=10
    )
    max_urls: int = Field(
        ..., description="最大URL数（必須）", gt=0, le=10000
    )
    options: Optional[Dict[str, Any]] = Field(None, description="追加オプション (任意)")

    # Phase R-1c: Drive 出力は廃止。fileSpaceId と include_images だけ残す
    file_space_id: str = Field(
        ..., description="同期先 FileSpace (Gemini storeId)"
    )
    include_images: bool = Field(
        default=True, description="画像取得を行うか (default: true)"
    )

    model_config = ConfigDict(populate_by_name=False)


class CrawlRequest(BaseModel):
    """RequestDoc標準構造準拠"""

    request_id: str = Field(..., description="リクエスト識別子")
    input: CrawlInput = Field(..., description="入力パラメータ")
    operation_metadata: StandardOperationMetadata = Field(
        ..., description="操作メタデータ"
    )

    model_config = ConfigDict(populate_by_name=False)
