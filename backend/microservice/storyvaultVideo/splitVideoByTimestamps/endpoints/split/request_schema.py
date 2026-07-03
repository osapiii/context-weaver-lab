"""
/split エンドポイントのリクエストスキーマ

RequestDocアーキテクチャ黄金テンプレート準拠。
Firebase Background関数から送信される input/systemMetadata 構造を受け取る。
"""

from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any


class SplitRequestInput(BaseModel):
    """
    input セクション: コマンド（入力パラメータ）

    Firebase Background関数の request_data['input'] に対応
    """
    sourceBucketName: str = Field(
        ...,
        description="ソース動画のGCSバケット名",
        pattern=r"^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$|^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]\.firebasestorage\.app$",
        examples=["storyvault-videos", "storyvault-dev-adk-artifacts"]
    )

    sourceFilePath: str = Field(
        ...,
        description="ソース動画のGCSファイルパス",
        min_length=1,
        examples=["videos/abc123/original.mp4"]
    )

    outputBucketName: str = Field(
        ...,
        description="出力動画のGCSバケット名",
        pattern=r"^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$|^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]\.firebasestorage\.app$",
        examples=["storyvault-videos", "storyvault-dev-adk-artifacts"]
    )

    # 🔧 変更: 文字列から配列に変更
    outputFilePath: List[str] = Field(
        ...,
        description="各セグメントの出力先GCSファイルパスの配列（cutoffSeconds.length + 1 の長さ）",
        min_length=1,
        examples=[["sections/section-0/section.mp4", "sections/section-1/section.mp4", "sections/section-2/section.mp4"]]
    )

    cutoffSeconds: List[float] = Field(
        ...,
        description="分割するタイムスタンプの配列（秒単位、昇順）",
        min_length=1,
        max_length=100,
        examples=[[10, 30, 60, 90]]
    )

    videoId: str = Field(
        ...,
        description="動画ID"
    )

    projectId: str = Field(
        ...,
        description="プロジェクトID"
    )

    outputVariant: Optional[str] = Field(
        default=None,
        description="出力バリアント。convertedのときsplitVideoConvertedへ書き込む（最終出力用）"
    )

    # 🔧 セクションIDのリスト（sections/{sectionId}/section.mp4 用）
    sectionIds: Optional[List[str]] = Field(
        default=None,
        description="セクションIDのリスト（セグメント番号からセクションIDをマッピングするため）"
    )

    @model_validator(mode='after')
    def validate_output_file_paths(self) -> 'SplitRequestInput':
        """outputFilePathの長さがcutoffSeconds.length + 1と一致することを検証"""
        expected_length = len(self.cutoffSeconds) + 1
        if len(self.outputFilePath) != expected_length:
            raise ValueError(
                f"outputFilePath length ({len(self.outputFilePath)}) must equal "
                f"cutoffSeconds.length + 1 ({expected_length})"
            )
        return self


class SplitRequestSystemMetadata(BaseModel):
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


class SplitRequest(BaseModel):
    """
    /split エンドポイントのリクエストスキーマ（RequestDoc黄金テンプレート準拠）

    Firebase Background関数から送信される input/systemMetadata 構造を受け取る。
    """
    request_id: str = Field(
        ...,
        description="リクエストID（Firebase Background関数で生成）"
    )

    input: SplitRequestInput = Field(
        ...,
        description="入力パラメータ（Command）"
    )

    systemMetadata: SplitRequestSystemMetadata = Field(
        ...,
        description="システムメタデータ"
    )

    class Config:
        """Pydantic設定"""
        json_schema_extra = {
            "example": {
                "request_id": "splitVideoRequest_1234567890",
                "input": {
                    "sourceBucketName": "storyvault-sandbox",
                    "sourceFilePath": "videos/abc123/original.mp4",
                    "outputBucketName": "storyvault-sandbox",
                    "outputFilePath": [
                        "sections/section-0/section.mp4",
                        "sections/section-1/section.mp4",
                        "sections/section-2/section.mp4",
                        "sections/section-3/section.mp4"
                    ],
                    "cutoffSeconds": [10, 30, 60],
                    "videoId": "video_456",
                    "projectId": "project_789"
                },
                "systemMetadata": {
                    "organizationId": "org_123",
                    "spaceId": "space_456",
                    "loggingCollectionId": "requestLogs",
                    "loggingDocumentId": "splitVideoLogs",
                    "requestedBy": {"email": "system@example.com", "role": 2},
                    "isCommand": False,
                    "isOouiCrud": True,
                    "isLlmCall": False,
                    "isAdminCrud": False
                }
            }
        }
