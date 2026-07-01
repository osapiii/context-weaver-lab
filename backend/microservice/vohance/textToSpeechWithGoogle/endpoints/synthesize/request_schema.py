"""
/synthesize エンドポイントのリクエストスキーマ

RequestDocアーキテクチャ黄金テンプレート準拠。
Firebase Background関数から送信される input/systemMetadata 構造を受け取る。
"""

from pydantic import BaseModel, Field
from typing import Optional


class SynthesizeRequestInput(BaseModel):
    """
    input セクション: コマンド（入力パラメータ）

    Firebase Background関数の request_data['input'] に対応
    """
    text: str = Field(
        ...,
        description="音声に変換するテキスト",
        min_length=1,
        max_length=5000,
        examples=["こんにちは、Gemini Text-to-Speechへようこそ"]
    )

    voiceName: str = Field(
        ...,
        description="音声モデル名（Zephyr, Puck, Charon, Aoede, Fenrir, Kore, Perse）",
        examples=["Aoede"]
    )

    tonePrompt: Optional[str] = Field(
        None,
        description="トーン指示（自然言語。指定時はそのまま、未指定時はデフォルトの一貫性用指示を使用）",
        examples=["Read in a calm, professional narrator voice with consistent pace and tone."]
    )

    outputBucketName: str = Field(
        ...,
        description="出力先のGCSバケット名",
        pattern=r"^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$|^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]\.firebasestorage\.app$",
        examples=["vohance-audio", "vohance-dev.firebasestorage.app"]
    )

    outputFilePath: str = Field(
        ...,
        description="出力ファイルのGCSパス",
        min_length=1,
        examples=["audio/narration/output.mp3"]
    )

    projectId: Optional[str] = Field(
        None,
        description="プロジェクトID"
    )


class SynthesizeRequestSystemMetadata(BaseModel):
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


class SynthesizeRequest(BaseModel):
    """
    /synthesize エンドポイントのリクエストスキーマ（RequestDoc黄金テンプレート準拠）

    Firebase Background関数から送信される input/systemMetadata 構造を受け取る。
    """
    request_id: str = Field(
        ...,
        description="リクエストID（Firebase Background関数で生成）"
    )

    input: SynthesizeRequestInput = Field(
        ...,
        description="入力パラメータ（Command）"
    )

    systemMetadata: SynthesizeRequestSystemMetadata = Field(
        ...,
        description="システムメタデータ"
    )

    class Config:
        """Pydantic設定"""
        json_schema_extra = {
            "example": {
                "request_id": "ttsRequest_1234567890",
                "input": {
                    "text": "こんにちは、Gemini Text-to-Speechへようこそ",
                    "voiceName": "Aoede",
                    "outputBucketName": "vohance-audio",
                    "outputFilePath": "audio/output.mp3",
                    "projectId": "project_456"
                },
                "systemMetadata": {
                    "organizationId": "org_123",
                    "spaceId": "space_456",
                    "loggingCollectionId": "requestLogs",
                    "loggingDocumentId": "tts_log_123",
                    "requestedBy": {"email": "system@example.com", "role": 2},
                    "isCommand": False,
                    "isOouiCrud": True,
                    "isLlmCall": False,
                    "isAdminCrud": False
                }
            }
        }
