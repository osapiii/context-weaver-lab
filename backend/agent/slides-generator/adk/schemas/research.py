"""Research 一級成果物の Pydantic v2 schema (research-v13).

設計コンセプト:
    `research.json` (構造化 SoT) + `research.html` (Notion 風読み物) の
    **2 ファイル体制**. Phase 1.8 sub_agent が Gemini structured output で
    直接出力し、Pydantic validation で型違反を即検出する.

フロー:
    1. phase1_8_research → Research json
    2. save_research_tool → deck_dir/research.json
    3. generate_svgs_tool → svg_asset[]
    4. build_research_html_tool → research.html
"""
from __future__ import annotations

import re
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

RESEARCH_SCHEMA_ID = "research-v13"
SCHEMA_VERSION = "13"
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

SvgKind = Literal[
    "concept-diagram",
    "flow",
    "comparison",
    "list",
    "data-chart",
    "timeline",
    "matrix",
]

DeckType = Literal["learning", "proposal", "report", "catalog"]


def normalize_reference_id(ref_id: str) -> str:
    """reference id を数字文字列に正規化 (例: '1', '[1]' → '1')."""
    stripped = ref_id.strip()
    if stripped.startswith("[") and stripped.endswith("]"):
        stripped = stripped[1:-1]
    if not stripped.isdigit():
        raise ValueError(f"reference id は数字のみ: {ref_id!r}")
    return stripped


class ResearchSvgSpec(BaseModel):
    """SVG 1 枚分の仕様 (= 設計図)."""

    model_config = ConfigDict(extra="allow")

    kind: SvgKind = Field(..., description="図の種類")
    intent: str = Field(..., min_length=10, description="挿絵の意図 1-2 文")
    key_elements: List[str] = Field(default_factory=list)


class ResearchSvgAsset(BaseModel):
    """generate_svgs_tool が生成した実 SVG."""

    model_config = ConfigDict(extra="allow")

    svg_text: str = Field(..., description="raw <svg ...>...</svg>")
    alt: str = Field(..., description="代替テキスト (a11y)")
    generated_at: float = Field(..., description="UNIX 秒")


class ResearchReference(BaseModel):
    """引用文献. 本文中の (N) 表記と紐づく."""

    model_config = ConfigDict(extra="allow")

    n: int = Field(..., ge=1, description="表示順の通し番号")
    id: str = Field(..., description="例: '1' (数字文字列)")
    title: str = Field(..., min_length=1)
    url: str = Field(..., description="ソース URL")
    medium: str = Field(..., min_length=1, description="出典種別 (公式ドキュメント 等)")
    retrieved_at: str = Field(..., description="取得日 YYYY-MM-DD")

    @field_validator("id")
    @classmethod
    def _id_format(cls, v: str) -> str:
        return normalize_reference_id(v)

    @field_validator("retrieved_at")
    @classmethod
    def _date_format(cls, v: str) -> str:
        if not DATE_PATTERN.match(v):
            raise ValueError("retrieved_at は YYYY-MM-DD 形式")
        return v


class ResearchDeck(BaseModel):
    """デッキメタ (v13 canonical)."""

    model_config = ConfigDict(extra="allow")

    title: str = Field(..., min_length=1)
    slug: str = Field(..., min_length=1, description="URL スラッグ (kebab-case)")
    intent: str = Field(..., min_length=1)
    target_reader: str = Field(..., min_length=1)
    deck_structure: str = Field(
        default="learning-deck",
        description="learning-deck / proposal-deck 等",
    )
    deck_type: DeckType = Field(default="learning")
    date: str = Field(..., description="レポート日 YYYY-MM-DD")

    @field_validator("date")
    @classmethod
    def _date_format(cls, v: str) -> str:
        if not DATE_PATTERN.match(v):
            raise ValueError("deck.date は YYYY-MM-DD 形式")
        return v


class ResearchMeta(BaseModel):
    """スキーマバージョン."""

    model_config = ConfigDict(extra="allow")

    schema_version: Literal["13"] = Field(default="13")


class ResearchConcern(BaseModel):
    """ユーザーが Phase 1 で挙げた懸念点への回答."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(..., description="C1, C2, ...")
    text: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=30, max_length=180)
    addressing_md: str = Field(..., min_length=80)
    reference_ids: List[str] = Field(default_factory=list)
    related_section_ids: List[str] = Field(default_factory=list)

    @field_validator("id")
    @classmethod
    def _id_format(cls, v: str) -> str:
        if not v.startswith("C") or not v[1:].isdigit():
            raise ValueError("id は C1, C2, ... の形式")
        return v

    @field_validator("reference_ids")
    @classmethod
    def _ref_ids(cls, v: List[str]) -> List[str]:
        return [normalize_reference_id(rid) for rid in v]


class ResearchSection(BaseModel):
    """Q1, Q2, ... に対応する 1 章."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(..., description="Q1, Q2, ...")
    question: str = Field(..., min_length=5)
    kind: Literal[
        "definitional",
        "comparative",
        "decisional",
        "how_to",
        "risk",
        "other",
    ]
    answer: str = Field(..., min_length=30, max_length=180)
    body_md: str = Field(..., min_length=300)
    reference_ids: List[str] = Field(default_factory=list)
    svg_spec: Optional[ResearchSvgSpec] = None
    svg_asset: Optional[ResearchSvgAsset] = None

    @field_validator("id")
    @classmethod
    def _qid_format(cls, v: str) -> str:
        if not v.startswith("Q") or not v[1:].isdigit():
            raise ValueError("id は Q1, Q2, ... の形式")
        return v

    @field_validator("reference_ids")
    @classmethod
    def _ref_ids(cls, v: List[str]) -> List[str]:
        return [normalize_reference_id(rid) for rid in v]


class NextActionPath(BaseModel):
    """Next Action の 1 シナリオ."""

    model_config = ConfigDict(extra="allow")

    condition: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    related_section_ids: List[str] = Field(default_factory=list)
    reference_ids: List[str] = Field(default_factory=list)

    @field_validator("reference_ids")
    @classmethod
    def _ref_ids(cls, v: List[str]) -> List[str]:
        return [normalize_reference_id(rid) for rid in v]


class NextAction(BaseModel):
    """レポート末尾の行動指針."""

    model_config = ConfigDict(extra="allow")

    summary: str = Field(..., min_length=30, max_length=400)
    paths: List[NextActionPath] = Field(default_factory=list)
    svg_spec: Optional[ResearchSvgSpec] = None
    svg_asset: Optional[ResearchSvgAsset] = None
    skipped: bool = False
    skip_reason: str = ""


class Research(BaseModel):
    """research.json の最上位 schema (v13)."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    schema_: str = Field(
        default=RESEARCH_SCHEMA_ID,
        alias="$schema",
        description="固定: research-v13",
    )
    deck: ResearchDeck
    references: List[ResearchReference] = Field(default_factory=list)
    sections: List[ResearchSection] = Field(..., min_length=2)
    concerns: List[ResearchConcern] = Field(default_factory=list)
    next_action: Optional[NextAction] = None
    generated_at: float = Field(...)
    svg_done: bool = False
    html_path: Optional[str] = None
    meta: ResearchMeta = Field(default_factory=ResearchMeta)
    theme: str = Field(..., min_length=1)
    intent: str = Field(..., min_length=1)
    reader: str = Field(..., min_length=1)
    deck_id: str = Field(default="", description="YYYY-MM-DD_8hex (writer が埋める)")

    @model_validator(mode="after")
    def _validate_deck_aliases(self) -> Research:
        if self.deck.title != self.theme:
            raise ValueError(
                f"deck.title と theme が不一致: {self.deck.title!r} != {self.theme!r}"
            )
        if self.deck.intent != self.intent:
            raise ValueError("deck.intent と intent が不一致")
        if self.deck.target_reader != self.reader:
            raise ValueError("deck.target_reader と reader が不一致")
        return self

    @model_validator(mode="after")
    def _validate_reference_ids(self) -> Research:
        refs_set = {r.id for r in self.references}
        if not refs_set:
            return self

        def check_ids(params: dict) -> None:
            label = params["label"]
            ids = params["ids"]
            for rid in ids:
                if rid not in refs_set:
                    raise ValueError(
                        f"{label} の reference_ids に存在しない id '{rid}'. "
                        f"登録済: {sorted(refs_set)}"
                    )

        for section in self.sections:
            check_ids({"label": f"section {section.id}", "ids": section.reference_ids})
        for concern in self.concerns:
            check_ids({"label": f"concern {concern.id}", "ids": concern.reference_ids})
        if self.next_action:
            for i, path in enumerate(self.next_action.paths):
                check_ids(
                    {
                        "label": f"next_action.paths[{i}]",
                        "ids": path.reference_ids,
                    }
                )

        for ref in self.references:
            if str(ref.n) != ref.id:
                raise ValueError(
                    f"reference n={ref.n} と id={ref.id!r} が不一致"
                )

        return self
