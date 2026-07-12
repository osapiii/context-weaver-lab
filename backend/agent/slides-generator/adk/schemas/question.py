"""QA 駆動モード (doc.qa_driven=true) の questions[] 要素.

v12 では Phase 1 で 2〜15 件の疑問を立て、Phase 2 で各 slide が
answers_questions[] でどの Q を解消するか宣言する設計に再定義された.
StructQA-50〜56 が機械強制する.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


QuestionKind = Literal[
    "definitional",
    "comparative",
    "decisional",
    "how_to",
    "risk",
    "other",
]


class Question(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(..., description="Q1, Q2, ... の形式")
    text: str = Field(..., min_length=10, max_length=80, description="疑問文 10-80 字")
    kind: QuestionKind
    provisionalDirection: str = Field(
        ..., description="Phase 1 段階の暫定回答方向性 (必須)"
    )
    shortSummary: Optional[str] = Field(
        default=None, max_length=30,
        description="QA-INDEX 早見表用 1 行回答 (Phase 2 で必須)",
    )
    refIndex: Optional[List[str]] = Field(
        default=None, description="doc.references[].id への参照"
    )
    sectionIndex: Optional[List[str]] = Field(
        default=None, description="この Q を解消する section / slide の id 配列"
    )

    @field_validator("id")
    @classmethod
    def _qid_format(cls, v: str) -> str:
        if not v.startswith("Q") or not v[1:].isdigit():
            raise ValueError("id は Q1, Q2, ... の形式")
        return v
