"""adk.agent_tools — Coordinator + sub_agents から呼ばれる function tool 群.

2026-05 大胆刷新: 旧 PPTX パイプライン (plan.json → deck → preview → narration → QA)
を全廃し、research.{json,html} 一級成果物パイプラインに集約.

公開関数の戻り値は **dict (JSON シリアライズ可能)** に統一する.
ADK は tool 戻り値を function response part として LLM に戻すため、Pydantic
モデルや Path をそのまま返すと serialization エラーになる.
"""
from __future__ import annotations

# subprocess wrappers (将来必要になる可能性ありで残す)
from .run_subprocess import run_node_script, run_python_script, SubprocessError

# Storage / state helpers
from .storage import ensure_deck_dir, list_deck_artifacts

# 新パイプライン: research.{json,html} 一級成果物
from .research_writer import (
    parse_and_validate,
    write_research_json,
    read_research_json,
    update_research_json,
    format_validation_error,
)
from .svg_generator import generate_svgs_for_research
from .html_builder import build_research_html

# ADK Coordinator / sub_agents 用 wrapper (primitive 引数のみ — Gemini tool schema 互換)
from ._adk_tools import (
    # 基本 / state utility
    ensure_deck_dir as ensure_deck_dir_tool,
    list_deck_artifacts as list_deck_artifacts_tool,
    update_progress_tool,
    _log_job as log_job,
    # Sub_agent (phase1_8_research) が使う
    save_research_tool,
    # post-step (Coordinator が都度承認モードで呼ぶ)
    generate_svgs_tool,
    build_research_html_tool,
)

__all__ = [
    # subprocess
    "run_node_script", "run_python_script", "SubprocessError",
    # storage
    "ensure_deck_dir", "list_deck_artifacts",
    # research pipeline
    "parse_and_validate",
    "write_research_json",
    "read_research_json",
    "update_research_json",
    "format_validation_error",
    "generate_svgs_for_research",
    "build_research_html",
    # ADK tools
    "ensure_deck_dir_tool",
    "list_deck_artifacts_tool",
    "update_progress_tool",
    "log_job",
    "save_research_tool",
    "generate_svgs_tool",
    "build_research_html_tool",
]
