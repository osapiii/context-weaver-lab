"""Per-request ADK agent factory — VertexAiSearchTool + mode tools."""
from __future__ import annotations

import os
from typing import Any

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool, VertexAiSearchTool

from .artifact_tools import add_html_document, add_markdown_document  # noqa: E402
from .global_prompt_scope import current_user_global_prompt
from .instruction_compose import compose_instruction
from .mode_tools import convert_mode  # noqa: E402

MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


def _instruction_with_global_prompt(base_instruction: str):
    """root agent の instruction — リクエスト contextvar から global prompt を合成."""

    def _provider(_ctx) -> str:
        return compose_instruction(
            base_instruction,
            current_user_global_prompt.get(),
        )

    return _provider


def agent_search_datastore_path(file_space_id: str | None) -> str | None:
    if not file_space_id or not file_space_id.strip():
        return None
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project:
        return None
    location = os.environ.get("VERTEX_SEARCH_LOCATION", "global")
    collection = os.environ.get("AGENT_SEARCH_COLLECTION", "default_collection")
    return (
        f"projects/{project}/locations/{location}/collections/{collection}"
        f"/dataStores/{file_space_id.strip()}"
    )


def _search_tool(datastore_path: str | None) -> VertexAiSearchTool | None:
    if not datastore_path:
        return None
    return VertexAiSearchTool(
        data_store_id=datastore_path,
        bypass_multi_tools_limit=True,
    )


def build_agent_for_mode(
    mode: str,
    *,
    datastore_path: str | None,
    model: str,
) -> LlmAgent:
    """Build LlmAgent for mode with Agent Search grounding."""
    search = _search_tool(datastore_path)
    base_tools: list[Any] = [FunctionTool(func=convert_mode)]
    if search is not None:
        base_tools.insert(0, search)

    if mode == "consultation":
        from consultation.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from consultation.tools import add_citation  # type: ignore

        tools = [
            *base_tools,
            FunctionTool(func=add_citation),
            FunctionTool(func=add_markdown_document),
            FunctionTool(func=add_html_document),
        ]
        return LlmAgent(
            name="en_consultation_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
        )

    if mode == "writing":
        from writing.prompts import instruction_for_writing_action  # type: ignore
        from writing.tools import add_text_block  # type: ignore
        from writing.writing_action_scope import current_writing_action  # type: ignore
        from writing.writing_form_tools import (  # type: ignore
            add_json_document,
            confirm_writing_schema,
            read_writing_form_status,
            save_writing_form_schema,
        )

        def _writing_instruction(_ctx) -> str:
            from common.instruction_compose import compose_instruction  # type: ignore
            from common.global_prompt_scope import current_user_global_prompt  # type: ignore

            base = instruction_for_writing_action(current_writing_action.get())
            return compose_instruction(base, current_user_global_prompt.get())

        tools = [
            *base_tools,
            FunctionTool(func=save_writing_form_schema),
            FunctionTool(func=confirm_writing_schema),
            FunctionTool(func=read_writing_form_status),
            FunctionTool(func=add_json_document),
            FunctionTool(func=add_text_block),
            FunctionTool(func=add_markdown_document),
            FunctionTool(func=add_html_document),
        ]
        return LlmAgent(
            name="en_writing_agent",
            model=model,
            instruction=_writing_instruction,
            tools=tools,
        )

    if mode == "sheet":
        from sheet.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from sheet.sheets_tools import (  # type: ignore
            append_rows,
            list_sheets,
            read_range,
            update_range,
        )

        tools = [
            *base_tools,
            FunctionTool(func=list_sheets),
            FunctionTool(func=read_range),
            FunctionTool(func=update_range),
            FunctionTool(func=append_rows),
        ]
        return LlmAgent(
            name="en_sheet_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
        )

    if mode == "image":
        from consultation.tools import add_citation  # type: ignore
        from image.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from image.image_reference_tools import confirm_image_references  # type: ignore
        from image.openai_image_tools import generate_image, retouch_image  # type: ignore

        tools = [
            *base_tools,
            FunctionTool(func=add_citation),
            FunctionTool(func=confirm_image_references),
            FunctionTool(func=generate_image),
            FunctionTool(func=retouch_image),
        ]
        return LlmAgent(
            name="en_image_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
        )

    if mode == "research":
        from research.agent import build_root_agent  # type: ignore

        agent = build_root_agent(datastore_path=datastore_path)
        if agent is None:
            raise ValueError("research agent unavailable (ADK or slides-generator import)")
        return agent

    if mode == "data_analysis":
        from data_analysis.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from data_analysis.tools import analyze_bigquery_data  # type: ignore

        tools = [
            *base_tools,
            FunctionTool(func=analyze_bigquery_data),
            FunctionTool(func=add_markdown_document),
            FunctionTool(func=add_html_document),
        ]
        return LlmAgent(
            name="en_aistudio_data_analysis_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
        )

    if mode == "web_page":
        from web_page.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from web_page.tools import (  # type: ignore
            generate_web_page_asset_image,
            read_web_page_brief,
            save_landing_page_html,
            save_web_page_asset_manifest,
            save_web_page_requirements,
            save_web_page_wireframe,
        )

        tools = [
            *base_tools,
            FunctionTool(func=read_web_page_brief),
            FunctionTool(func=save_web_page_requirements),
            FunctionTool(func=save_web_page_wireframe),
            FunctionTool(func=save_landing_page_html),
            FunctionTool(func=generate_web_page_asset_image),
            FunctionTool(func=save_web_page_asset_manifest),
        ]
        return LlmAgent(
            name="en_aistudio_web_page_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
        )

    if mode == "storyvault":
        from storyvault.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from storyvault.tools import (  # type: ignore
            read_storyvault_sources,
            save_user_story_ssot,
        )

        tools = [
            *base_tools,
            FunctionTool(func=read_storyvault_sources),
            FunctionTool(func=save_user_story_ssot),
            FunctionTool(func=add_markdown_document),
            FunctionTool(func=add_html_document),
        ]
        return LlmAgent(
            name="en_aistudio_storyvault_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
        )

    if mode == "storyvault_capability_structuring":
        from storyvault_capability_structuring.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from storyvault_capability_structuring.tools import (  # type: ignore
            read_capability_structuring_context,
            save_capability_structure,
        )

        tools = [
            *base_tools,
            FunctionTool(func=read_capability_structuring_context),
            FunctionTool(func=save_capability_structure),
            FunctionTool(func=add_markdown_document),
            FunctionTool(func=add_html_document),
        ]
        return LlmAgent(
            name="storyvault_capability_structuring_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
        )

    if mode == "storyvault_related_context":
        from storyvault_related_context.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from storyvault_related_context.schemas import RelatedContextResult  # type: ignore
        from storyvault_related_context.tools import (  # type: ignore
            fetch_github_pull_request_candidates,
            fetch_knowledge_document_candidates,
            fetch_slack_message_candidates,
            read_related_context_request,
        )

        tools = [
            *base_tools,
            FunctionTool(func=read_related_context_request),
            FunctionTool(func=fetch_github_pull_request_candidates),
            FunctionTool(func=fetch_slack_message_candidates),
            FunctionTool(func=fetch_knowledge_document_candidates),
        ]
        return LlmAgent(
            name="storyvault_related_context_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
            output_schema=RelatedContextResult,
            output_key="storyvault_related_context",
        )

    if mode == "storyvault_zapping_analysis":
        from storyvault_zapping_analysis.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from storyvault_zapping_analysis.schemas import ZappingAnalysisResult  # type: ignore
        from storyvault_zapping_analysis.tools import read_zapping_analysis_context  # type: ignore

        tools = [
            *base_tools,
            FunctionTool(func=read_zapping_analysis_context),
            FunctionTool(func=add_markdown_document),
            FunctionTool(func=add_html_document),
        ]
        return LlmAgent(
            name="storyvault_zapping_analysis_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
            output_schema=ZappingAnalysisResult,
            output_key="storyvault_zapping_analysis",
        )

    if mode == "storyvault_story_generation":
        from storyvault_story_generation.prompts import SYSTEM_INSTRUCTION  # type: ignore
        from storyvault_story_generation.tools import (  # type: ignore
            read_story_generation_context,
            save_story_generation,
        )

        tools = [
            *base_tools,
            FunctionTool(func=read_story_generation_context),
            FunctionTool(func=save_story_generation),
            FunctionTool(func=add_markdown_document),
            FunctionTool(func=add_html_document),
        ]
        return LlmAgent(
            name="storyvault_story_generation_agent",
            model=model,
            instruction=_instruction_with_global_prompt(SYSTEM_INSTRUCTION),
            tools=tools,
        )

    if mode == "business_partner":
        from business_partner.agent import build_root_agent  # type: ignore

        return build_root_agent()

    raise ValueError(f"Unknown agent mode: {mode}")
