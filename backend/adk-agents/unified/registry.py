"""Unified ADK service — mode 別 agent 定義のレジストリ."""
from __future__ import annotations

from common.server_base import UNIFIED_APP_NAME, AgentBundle  # type: ignore

from consultation.agent import build_root_agent as build_consultation_agent
from image.agent import build_root_agent as build_image_agent
from sheet.agent import build_root_agent as build_sheet_agent
from writing.agent import build_root_agent as build_writing_agent
from research.agent import build_root_agent as build_research_agent
from business_partner.agent import build_root_agent as build_business_partner_agent
from data_analysis.agent import build_root_agent as build_data_analysis_agent
from web_page.agent import build_root_agent as build_web_page_agent
from storyvault.agent import build_root_agent as build_storyvault_agent
from storyvault_capability_structuring.agent import (
    build_root_agent as build_storyvault_capability_structuring_agent,
)
from storyvault_related_context.agent import (
    build_root_agent as build_storyvault_related_context_agent,
)
from storyvault_zapping_analysis.agent import (
    build_root_agent as build_storyvault_zapping_analysis_agent,
)
from storyvault_story_generation.agent import (
    build_root_agent as build_storyvault_story_generation_agent,
)


def build_agent_registry() -> dict[str, AgentBundle]:
    return {
        "writing": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_writing_agent(),
        ),
        "sheet": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_sheet_agent(),
        ),
        "image": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_image_agent(),
        ),
        "consultation": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_consultation_agent(),
        ),
        "research": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_research_agent(),
        ),
        "business_partner": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_business_partner_agent(),
        ),
        "data_analysis": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_data_analysis_agent(),
        ),
        "web_page": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_web_page_agent(),
        ),
        "storyvault": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_storyvault_agent(),
        ),
        "storyvault_capability_structuring": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_storyvault_capability_structuring_agent(),
        ),
        "storyvault_related_context": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_storyvault_related_context_agent(),
        ),
        "storyvault_zapping_analysis": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_storyvault_zapping_analysis_agent(),
        ),
        "storyvault_story_generation": AgentBundle(
            app_name=UNIFIED_APP_NAME,
            root_agent=build_storyvault_story_generation_agent(),
        ),
    }
