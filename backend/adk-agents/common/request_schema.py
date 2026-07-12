"""EN AIstudio ADK agent request / event schemas (Pydantic v2)."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class HistoryTurn(BaseModel):
    role: Literal["user", "model"]
    text: str


class ModeStateSheet(BaseModel):
    """sheet モード時のみ意味を持つ. URL を貼り終えた後にセットされる."""

    spreadsheet_id: Optional[str] = None
    spreadsheet_url: Optional[str] = None


class InvokeRequest(BaseModel):
    """`POST /v1/agents/{mode}/invoke` の body.

    Frontend (app/stores/enAssistant.ts の sendViaAdk) と整合させること.
    """

    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(..., min_length=1, alias="sessionId")
    user_id: Optional[str] = Field(default=None, alias="userId")
    organization_id: str = Field(..., min_length=1, alias="organizationId")
    space_id: str = Field(..., min_length=1, alias="spaceId")
    file_space_id: Optional[str] = None
    """テナント分離キー: Vertex AI Search の data store id."""


    prompt: str
    model: Optional[str] = None
    """RequestDoc Command `input.model` と同じ選択キー or `gemini-*` API 名。未指定時は mode 既定."""
    history: list[HistoryTurn] = Field(default_factory=list)
    mode_state: dict[str, Any] = Field(default_factory=dict)
    """mode 別 state. sheet / writing / image などの追加状態を FE が注入."""
    system_prompt: Optional[str] = None
    """@deprecated FE からの override 用。通常は auth で Firestore から読む."""
    response_id: Optional[str] = None
    """FE が付与する assistant message id。grounding_metadata の map key."""
    attachments: list["AttachmentRef"] = Field(default_factory=list)
    """ヒアリングで添付された参考資料. 1 ターン目のみ LLM の Content に inject される."""
    selected_knowledge: list["KnowledgeRef"] = Field(default_factory=list)
    """取り込み済み FileSpace 資料. 各ターンで GCS から動的コンテキストとして inject される."""
    reference_images: list["ImageReferenceRef"] = Field(default_factory=list)
    """image モード: 生成用リファレンス画像 (会話 attachments とは分離)."""


class ImageReferenceRef(BaseModel):
    """画像生成用リファレンス (knowledge / clipboard / upload)."""

    id: str
    source: Literal["knowledge", "clipboard", "upload"]
    name: str
    mime_type: str = ""
    gcs_path: Optional[str] = None
    url: Optional[str] = None
    knowledge_doc_id: Optional[str] = None


class KnowledgeRef(BaseModel):
    """ユーザーが UI で選択した取り込み済み知識."""

    id: str
    name: str
    gcs_path: str
    mime_type: str = ""


class AttachmentRef(BaseModel):
    """FE で Firebase Storage にアップロードした参考資料の参照.

    RequestDoc 経路では gcs_path (gs://) を優先。url は後方互換.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    gcs_path: str = Field(default="", alias="gcsPath")
    url: str = ""
    mime_type: str = Field(default="", alias="mimeType")
    size: int = 0


# 前方参照解決
InvokeRequest.model_rebuild()


class SseTextDelta(BaseModel):
    text: str


class SseArtifact(BaseModel):
    """UI で kind 別にカード描画する成果物.

    - image:              生成画像 (url + prompt)
    - sheet_op:           シート操作の summary + 範囲 + status
    - text_block:         コピー単位のテキストブロック (title + body)
    - markdown_document:  Markdown 成果物 (title + body)
    - html_document:      HTML 成果物 (title + body)
    - json_document:      JSON 成果物 (title + body)
    - csv_document:       CSV 成果物 (title + body)
    - en_aistudio_data_analysis_result: データ分析結果 JSON
    - citation:           consultation の grounding citation (title + snippet + uri)
    """

    kind: Literal[
        "image",
        "sheet_op",
        "text_block",
        "markdown_document",
        "html_document",
        "json_document",
        "csv_document",
        "en_aistudio_data_analysis_result",
        "citation",
    ]
    # image
    url: Optional[str] = None
    prompt: Optional[str] = None
    mime_type: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    # sheet_op
    summary: Optional[str] = None
    range: Optional[str] = None
    status: Optional[Literal["proposed", "applied", "failed"]] = None
    # text_block / citation
    title: Optional[str] = None
    body: Optional[str] = None
    # citation 固有
    snippet: Optional[str] = None
    uri: Optional[str] = None


class SseError(BaseModel):
    message: str


class SseImageReferenceState(BaseModel):
    status: Literal["incomplete", "draft", "complete"]
    references: list[dict[str, Any]] = Field(default_factory=list)
    min_count: int = 1
    confirmed_at: Optional[str] = None


class SseDone(BaseModel):
    session_id: str
    image_reference: Optional[SseImageReferenceState] = None
