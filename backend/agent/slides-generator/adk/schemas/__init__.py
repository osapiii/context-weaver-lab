"""adk.schemas — Pydantic モデル.

2026-05 大胆刷新: 旧 PPTX 関連 schema (Plan / Section / Slide / Doc /
HtmlSupplement / Outline) を全廃し、research.json 用 schema に集約.
"""
from .question import Question, QuestionKind
from .research import (
    RESEARCH_SCHEMA_ID,
    SCHEMA_VERSION,
    Research,
    ResearchDeck,
    ResearchMeta,
    ResearchSection,
    ResearchConcern,
    ResearchSvgSpec,
    ResearchSvgAsset,
    ResearchReference,
    NextAction,
    NextActionPath,
    SvgKind,
    normalize_reference_id,
)

__all__ = [
    "Question",
    "QuestionKind",
    "RESEARCH_SCHEMA_ID",
    "SCHEMA_VERSION",
    "Research",
    "ResearchDeck",
    "ResearchMeta",
    "ResearchSection",
    "ResearchConcern",
    "ResearchSvgSpec",
    "ResearchSvgAsset",
    "ResearchReference",
    "NextAction",
    "NextActionPath",
    "SvgKind",
    "normalize_reference_id",
]
