"""
TranscribeリクエストスキーマDefinition（Aqua Voice版）

RequestDoc黄金テンプレートに準拠したPydanticスキーマを定義します。
YouTube URLモードは非対応で、GCS音声/動画ファイルのみをサポートします。
"""

from typing import Optional, Literal, Any
from pydantic import BaseModel, Field, ConfigDict


class TranscribeInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    """
    入力パラメータ（Command）
    
    文字起こし実行に必要なパラメータを定義します。
    """
    mode: Literal["videoFile", "audioFile"] = Field(
        ...,
        description="文字起こしモード（youtubeは非対応）"
    )
    sourceFileBucketName: str = Field(
        ...,
        min_length=1,
        description="ソースファイルのGCSバケット名"
    )
    sourceFilePath: str = Field(
        ...,
        min_length=1,
        description="ソースファイルのGCSパス"
    )
    outputBucketName: str = Field(
        ...,
        min_length=1,
        description="出力先のGCSバケット名"
    )
    outputFilePath: str = Field(
        ...,
        min_length=1,
        description="出力ファイルのGCSパス"
    )
    enableParagraphFormatting: bool = Field(
        default=True,
        description="Gemini段落整形を有効化"
    )
    videoId: Optional[str] = Field(
        None,
        description="動画ID"
    )
    projectId: Optional[str] = Field(
        None,
        description="プロジェクトID"
    )
    sectionId: Optional[str] = Field(
        None,
        description="AIナレーション用セクションID"
    )
    sectionIndex: Optional[int] = Field(
        None,
        description="AIナレーション用セクションインデックス"
    )


class TranscribeSystemMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    """
    システムメタデータ

    ロギングや組織管理に必要なシステムメタデータを定義します。
    """
    organizationId: str = Field(
        ...,
        description="組織ID"
    )
    spaceId: str = Field(
        ...,
        description="スペースID（マルチテナント対応）"
    )
    loggingCollectionId: str = Field(
        ...,
        description="ロギングコレクションID"
    )
    loggingDocumentId: str = Field(
        ...,
        description="ロギングドキュメントID"
    )

    requestedBy: dict[str, Any] = Field(
        ...,
        description="リクエスト実行者情報（email, role等を含む）"
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


class TranscribeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    """
    RequestDoc黄金テンプレート準拠のリクエストスキーマ
    
    構造:
    - request_id: リクエスト一意識別子
    - input: 入力パラメータ（Command）
    - systemMetadata: システムメタデータ
    """
    request_id: str = Field(
        ...,
        min_length=1,
        description="リクエスト一意識別子"
    )
    input: TranscribeInput = Field(
        ...,
        description="入力パラメータ"
    )
    systemMetadata: TranscribeSystemMetadata = Field(
        ...,
        description="システムメタデータ"
    )


class TranscribeResult(BaseModel):
    """
    文字起こし結果スキーマ（TypeScript RequestDocのoutput型定義に完全準拠）
    
    ⚠️ CloudRunはPython内部でsnake_caseだが、ResponseFormatter.success()でcamelCaseに変換
    """
    transcriptionPath: str = Field(
        ...,
        description="文字起こし結果のGCSパス（TypeScript RequestDoc準拠）"
    )
    transcriptionBucketName: str = Field(
        ...,
        description="文字起こし結果のGCSバケット名（TypeScript RequestDoc準拠）"
    )
    transcriptionFilePath: str = Field(
        ...,
        description="文字起こし結果のGCSファイルパス（TypeScript RequestDoc準拠）"
    )
    transcriptionId: str = Field(
        ...,
        description="Aqua Voice transcription ID（TypeScript RequestDoc準拠）"
    )
    processingTime: float = Field(
        ...,
        description="処理時間（秒）（TypeScript RequestDoc準拠）"
    )
    statistics: dict = Field(
        ...,
        description="文字起こし統計情報（TypeScript RequestDoc準拠）"
    )
    paragraphCount: Optional[int] = Field(
        None,
        description="段落数（Gemini処理実行時のみ）（TypeScript RequestDoc準拠）"
    )
