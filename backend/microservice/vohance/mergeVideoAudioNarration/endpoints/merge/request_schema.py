"""
Pydantic schemas for mergeVideoAudioNarration service
RequestDoc黄金テンプレート準拠
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional


class AudioSegmentInput(BaseModel):
    """
    音声セグメント入力スキーマ (BucketName/FilePath分離パターン)
    """
    sourceBucketName: str = Field(..., min_length=1, description="音声ファイルバケット名")
    sourceFilePath: str = Field(..., min_length=1, description="音声ファイルパス")
    timestampMs: int = Field(..., ge=0, description="タイムスタンプ（ミリ秒、0以上）")


class CaptionSegmentInput(BaseModel):
    """
    字幕セグメント入力スキーマ
    """
    timestampMs: int = Field(..., ge=0, description="字幕表示開始タイムスタンプ（ミリ秒、0以上）")
    text: str = Field(..., min_length=1, max_length=500, description="字幕テキスト（1-500文字）")


class CaptionStyleInput(BaseModel):
    """
    字幕スタイル設定スキーマ
    """
    position: str = Field(default="bottom", description="字幕位置（top: 画面上, bottom: 画面下）")
    fontName: Optional[str] = Field(default=None, description="フォント名（None: デフォルト日本語フォント）")
    fontSize: int = Field(default=40, ge=10, le=200, description="文字サイズ（10-200）")
    fontColor: str = Field(default="white", description="文字色（CSS color名 or #RRGGBB）")
    strokeColor: str = Field(default="black", description="枠線色（CSS color名 or #RRGGBB）")
    strokeWidth: int = Field(default=2, ge=0, le=10, description="枠線太さ（0-10、0=枠線なし）")

    @field_validator("position")
    @classmethod
    def validate_position(cls, v: str) -> str:
        """字幕位置のバリデーション"""
        if v not in ["top", "bottom"]:
            raise ValueError("position must be 'top' or 'bottom'")
        return v


class MergeInput(BaseModel):
    """
    Input層: Command (RequestDoc黄金テンプレート準拠)
    """
    videoBucketName: str = Field(..., min_length=1, description="動画ファイルバケット名")
    videoFilePath: str = Field(..., description="動画ファイルパス")
    audioSegments: List[AudioSegmentInput] = Field(..., min_length=1, description="音声セグメントリスト（空でないこと）")
    outputBucketName: str = Field(..., min_length=1, description="出力バケット名")
    outputFilePath: str = Field(..., description="出力ファイルパス")
    videoId: str = Field(..., min_length=1, description="動画ID")
    projectId: Optional[str] = Field(None, description="プロジェクトID（オプション）")

    # 字幕機能フィールド
    captionIsEnabled: bool = Field(default=False, description="字幕機能を有効化")
    captionSegments: Optional[List[CaptionSegmentInput]] = Field(
        default=None,
        description="字幕セグメントリスト（captionIsEnabled=trueの場合に必須）"
    )
    captionStyle: Optional[CaptionStyleInput] = Field(
        default=None,
        description="字幕スタイル設定（オプション、未指定時はデフォルトスタイル適用）"
    )

    @field_validator("videoFilePath")
    @classmethod
    def validate_video_file_path(cls, v: str) -> str:
        """動画ファイルパスのバリデーション（.mp4拡張子）"""
        if not v.endswith(".mp4"):
            raise ValueError("Video file path must end with .mp4")
        return v

    @field_validator("outputFilePath")
    @classmethod
    def validate_output_file_path(cls, v: str) -> str:
        """出力ファイルパスのバリデーション（.mp4拡張子）"""
        if not v.endswith(".mp4"):
            raise ValueError("Output file path must end with .mp4")
        return v

    # 字幕機能は非サポート。captionIsEnabled/captionSegments/captionStyleはAPI互換のため残すが無視する


class MergeSystemMetadata(BaseModel):
    """
    SystemMetadata層: システムメタデータ
    """
    organizationId: str = Field(..., min_length=1, description="組織ID（マルチテナント対応、必須）")
    spaceId: str = Field(..., min_length=1, description="スペースID（マルチテナント対応、必須）")
    loggingCollectionId: str = Field(..., min_length=1, description="ログ保存先Collection")
    loggingDocumentId: str = Field(..., min_length=1, description="ログ保存先DocumentID")
    requestedBy: dict = Field(..., description="リクエスト実行者情報")
    isCommand: bool = Field(..., description="コマンド実行フラグ")
    isOouiCrud: bool = Field(..., description="OOUI CRUDフラグ")
    isLlmCall: bool = Field(..., description="LLM呼び出しフラグ")
    isAdminCrud: bool = Field(..., description="管理者CRUDフラグ")


class ProcessRequest(BaseModel):
    """
    Cloud Run リクエストスキーマ (RequestDoc黄金テンプレート準拠)
    """
    request_id: str = Field(..., min_length=1, description="リクエストID")
    input: MergeInput = Field(..., description="Input層")
    systemMetadata: MergeSystemMetadata = Field(..., description="SystemMetadata層")


class MergeStatistics(BaseModel):
    """
    統計情報（オプショナル）
    """
    totalAudioSegments: Optional[int] = Field(None, description="音声セグメント総数")
    totalDurationSeconds: Optional[float] = Field(None, ge=0, description="総再生時間（秒）")
    outputFileSizeBytes: Optional[int] = Field(None, ge=0, description="出力ファイルサイズ（バイト）")


class MergeOutput(BaseModel):
    """
    Output層: Query (RequestDoc黄金テンプレート準拠)
    Firebase Background関数に返却するOutputのみ
    """
    resultBucketName: str = Field(..., description="結果ファイルバケット名")
    resultFilePath: str = Field(..., description="結果ファイルパス")
    processingTime: float = Field(..., ge=0, description="処理時間（秒）")
    statistics: Optional[MergeStatistics] = Field(None, description="統計情報（オプショナル）")


class ProcessResponse(BaseModel):
    """
    Cloud Run レスポンススキーマ (RequestDoc黄金テンプレート準拠)
    statusフィールドは含めない（Firebase Background関数が管理）
    """
    output: MergeOutput = Field(..., description="Output層のみ返却")
    processing_time: float = Field(..., ge=0, description="処理時間（メタデータ）")
