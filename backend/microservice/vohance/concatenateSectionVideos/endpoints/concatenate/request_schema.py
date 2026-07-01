"""
/concatenate エンドポイントのリクエストスキーマ

RequestDocアーキテクチャ黄金テンプレート準拠。
Firebase Background関数から送信される input/systemMetadata 構造を受け取る。
"""

from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any


class SectionVideoPath(BaseModel):
    """セクション動画のパス情報"""
    bucketName: str = Field(
        ...,
        description="セクション動画のGCSバケット名",
        pattern=r"^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$|^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]\.firebasestorage\.app$",
        examples=["vohance-videos", "vohance-dev.firebasestorage.app"]
    )
    filePath: str = Field(
        ...,
        description="セクション動画のGCSファイルパス",
        min_length=1,
        examples=["sections/section-0/merged_video.mp4"]
    )
    expectedDurationSeconds: Optional[float] = Field(
        default=None,
        ge=0.1,
        description="セクション定義上の正しい長さ。指定時は連結前にこの長さへ正規化する"
    )
    sectionId: Optional[str] = Field(default=None, description="セクションID")
    sectionIndex: Optional[int] = Field(default=None, ge=0, description="セクション順序")
    sectionStartSeconds: Optional[float] = Field(default=None, ge=0, description="元動画上の開始秒")
    sectionEndSeconds: Optional[float] = Field(default=None, ge=0, description="元動画上の終了秒")


class ConcatenateRequestInput(BaseModel):
    """
    input セクション: コマンド（入力パラメータ）

    Firebase Background関数の request_data['input'] に対応
    """
    sectionVideoPaths: List[SectionVideoPath] = Field(
        ...,
        description="連結するセクション動画のパス情報の配列",
        min_length=1,
        examples=[[
            {"bucketName": "vohance-videos", "filePath": "sections/section-0/merged_video.mp4"},
            {"bucketName": "vohance-videos", "filePath": "sections/section-1/merged_video.mp4"}
        ]]
    )

    outputBucketName: str = Field(
        ...,
        description="出力動画のGCSバケット名",
        pattern=r"^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$|^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]\.firebasestorage\.app$",
        examples=["vohance-videos", "vohance-dev.firebasestorage.app"]
    )

    outputFilePath: str = Field(
        ...,
        description="出力動画のGCSファイルパス",
        min_length=1,
        examples=["projects/project-123/final_merged_video.mp4"]
    )

    videoId: str = Field(
        ...,
        description="動画ID"
    )

    projectId: str = Field(
        ...,
        description="プロジェクトID"
    )
    expectedTotalDurationSeconds: Optional[float] = Field(
        default=None,
        ge=0.1,
        description="全セクション合計の期待再生時間"
    )


class ConcatenateRequestSystemMetadata(BaseModel):
    """
    systemMetadata セクション: システムメタデータ

    Firebase Background関数の request_data['systemMetadata'] に対応
    """
    organizationId: str = Field(
        ...,
        description="組織ID（マルチテナント対応）"
    )
    spaceId: str = Field(
        ...,
        description="スペースID（マルチテナント対応）"
    )

    loggingCollectionId: str = Field(
        ...,
        description="ログ保存先Collection ID"
    )

    loggingDocumentId: str = Field(
        ...,
        description="ログ保存先Document ID"
    )

    requestedBy: dict = Field(
        ...,
        description="リクエスト実行者情報"
    )

    isCommand: bool = Field(
        ...,
        description="コマンド実行フラグ"
    )

    isOouiCrud: bool = Field(
        ...,
        description="OOUI CRUDフラグ"
    )

    isLlmCall: bool = Field(
        ...,
        description="LLM呼び出しフラグ"
    )

    isAdminCrud: bool = Field(
        ...,
        description="管理者CRUDフラグ"
    )


class ConcatenateRequest(BaseModel):
    """
    /concatenate エンドポイントのリクエストスキーマ（RequestDoc黄金テンプレート準拠）

    Firebase Background関数から送信される input/systemMetadata 構造を受け取る。
    """
    request_id: str = Field(
        ...,
        description="リクエストID（Firebase Background関数で生成）"
    )

    input: ConcatenateRequestInput = Field(
        ...,
        description="入力パラメータ（Command）"
    )

    systemMetadata: ConcatenateRequestSystemMetadata = Field(
        ...,
        description="システムメタデータ"
    )

    class Config:
        """Pydantic設定"""
        json_schema_extra = {
            "example": {
                "request_id": "concatenateSectionVideosRequest_1234567890",
                "input": {
                    "sectionVideoPaths": [
                        {
                            "bucketName": "vohance-sandbox",
                            "filePath": "sections/section-0/merged_video.mp4"
                        },
                        {
                            "bucketName": "vohance-sandbox",
                            "filePath": "sections/section-1/merged_video.mp4"
                        }
                    ],
                    "outputBucketName": "vohance-sandbox",
                    "outputFilePath": "projects/project_789/final_merged_video.mp4",
                    "videoId": "video_456",
                    "projectId": "project_789"
                },
                "systemMetadata": {
                    "organizationId": "org_123",
                    "spaceId": "space_456",
                    "loggingCollectionId": "requestLogs",
                    "loggingDocumentId": "concatenateSectionVideosLogs",
                    "requestedBy": {"email": "system@example.com", "role": 2},
                    "isCommand": False,
                    "isOouiCrud": True,
                    "isLlmCall": False,
                    "isAdminCrud": False
                }
            }
        }
