"""FastAPI server base — mode 別の `server.py` から create_app(...) を呼ぶ.

役割:
    - CORS + healthz
    - POST /v1/agents/{mode}/invoke
        * Firebase ID Token 検証
        * Session state に file_space_id / spreadsheet_id 等を流し込む
        * ADK Runner を呼んで、event stream を SSE に変換して返す

ADK イベントの変換ルール:
    LlmResponse.text (delta)            → event: text_delta   data: {"text": "..."}
    Tool function_call                  → event: tool_call    data: {"name": "...", "status": "running"}
    Tool function_response              → event: tool_result  data: {"name": "...", "status": "completed"|"failed"}
    Tool 完了で返した artifact dict     → event: artifact     data: {...}
    convert_mode tool 完了              → event: mode_change  data: {"mode": "...", "reason": "..."}
      (同一 invoke 内で切替先エージェントへハンドオフ可)
    Exception                            → event: error        data: {"message": "..."}
    Stream 終了                          → event: done         data: {"session_id": "...", "mode": "..."}
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from google.adk.runners import Runner
from google.genai import types as gtypes

from .agent_builder import agent_search_datastore_path, build_agent_for_mode
from .model_resolve import resolve_model_for_invoke
from .platform_guide import platform_guide_store_id
from .attachments import prepare_attachment_parts
from .knowledge_context import (
    merge_knowledge_refs,
    prepare_agent_search_turn_instruction,
    prepare_image_agent_search_turn_instruction,
    prepare_research_agent_search_turn_instruction,
    prepare_writing_agent_search_turn_instruction,
    prepare_knowledge_context_parts,
)
from .auth import require_user
from .invoke_internal_auth import require_user_or_internal_invoke
from .byok_scope import (
    activate_byok,
    deactivate_byok,
    gemini_api_key_from_user,
    resume_byok,
    suspend_byok,
)
from .byok_auth import resolve_request_openai_api_key
from .openai_byok_scope import (
    activate_openai_byok,
    deactivate_openai_byok,
    openai_api_key_from_user,
)
from .global_prompt_scope import (
    activate_global_prompt,
    deactivate_global_prompt,
    resolve_global_prompt,
)
from .discovery_to_grounding import extract_grounding_from_tool_response
from .grounding_merge import merge_grounding_metadata
from .grounding_sse import grounding_event_payload
from .request_schema import InvokeRequest
from .services import (
    AdkServices,
    create_runner,
    init_adk_app_state,
    register_adk_artifact_routes,
)
from .session_routes import register_session_routes
from .adk_artifact_io import (
    emit_tool_artifact_events,
    resolve_artifact_ref_for_sse,
)
from .image_reference import (
    empty_image_reference_state,
    fe_requests_image_workflow,
    image_reference_state_for_mode_handoff,
    image_turn_context_summary,
    merge_image_reference_on_invoke,
    resolve_image_creation_mode,
    validate_image_workflow_invoke,
)
from .image_creation_mode_scope import (
    activate_invoke_image_creation_mode,
    deactivate_invoke_image_creation_mode,
)
from .image_workflow_phase_scope import (
    activate_invoke_image_workflow_phase,
    deactivate_invoke_image_workflow_phase,
)
from .image_reference_scope import (
    activate_invoke_image_reference,
    deactivate_invoke_image_reference,
)
from .image_studio_workflow import (
    image_studio_state_patch_from_mode_state,
    image_studio_turn_context_summary,
    merge_image_invoke_mode_state,
    resolve_image_workflow_phase,
    validate_image_studio_invoke,
)
from .research_workflow import (
    RESEARCH_AUTONOMOUS_CONTINUE_MESSAGE,
    RESEARCH_AUTONOMOUS_MAX_TURNS,
    is_research_plan_only,
    is_research_pipeline_autonomous,
    is_research_pipeline_terminal,
    research_autonomous_instruction_text,
    research_plan_only_instruction_text,
    research_state_patch_from_mode_state,
    research_turn_context_summary,
    validate_research_invoke,
)
from .sheet_workflow import (
    sheet_state_patch_from_mode_state,
    sheet_turn_context_summary,
    validate_sheet_invoke,
)
from .writing_workflow import (
    merge_writing_invoke_mode_state,
    resolve_writing_action_from_mode_state,
    validate_writing_invoke,
    writing_state_patch_from_mode_state,
    writing_turn_context_summary,
)
from .guide_workflow import (
    guide_state_patch_from_mode_state,
    merge_guide_invoke_mode_state,
    patch_guide_bucket,
)
from .business_partner_workflow import (
    business_partner_state_patch_from_mode_state,
    business_partner_turn_context_summary,
    finalize_business_partner_bucket,
    merge_business_partner_invoke_mode_state,
    patch_business_partner_bucket,
    validate_business_partner_invoke,
)
from .application_scan_workflow import application_scan_state_patch_from_mode_state
from .vibe_control_workflow import (
    vibe_capability_structuring_state_patch_from_mode_state,
    vibe_story_generation_state_patch_from_mode_state,
)
from .writing_action_scope import activate_writing_action, deactivate_writing_action
from .artifact_ui_bridge import (
    message_artifact_ref_from_ref,
    message_artifact_ref_from_tool_ref,
)
from .firestore_session_service import FirestoreSessionService
from .session_invoke_sync import SessionInvokeSync
from .task_invoke_pipeline import bootstrap_task_invoke, finalize_task_invoke
from .invoke_mode import normalize_workspace_mode, resolve_invoke_agent_mode
from .invoke_session_scope import (
    reset_invoke_session_scope,
    set_invoke_session_scope,
)
from .session_state import (
    ensure_session_state,
    persist_session_state_patch,
    read_session_state,
)

logger = logging.getLogger(__name__)

_SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@dataclass(frozen=True)
class AgentBundle:
    """Unified ADK service 用: mode ごとの Runner 定義."""

    app_name: str
    root_agent: Any


def _cors_origins() -> list[str]:
    raw = os.environ.get(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000,https://en-aistudio.app,https://en-aistudio-development.web.app",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


UNIFIED_APP_NAME = "en-aistudio-adk-agent"

_DISCOVERY_SEARCH_TOOLS = frozenset(
    {"discovery_engine_search", "vertex_ai_search", "search_knowledge"}
)


def _guide_context_from_mode_state(mode_state: dict[str, Any] | None) -> str | None:
    if not isinstance(mode_state, dict):
        return None
    raw = mode_state.get("guide_context")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def _emit_mode_from_tool_response(
    response: dict[str, Any] | None,
) -> tuple[str | None, str | None]:
    if not response or not isinstance(response, dict):
        return None, None
    mode = normalize_workspace_mode(
        response.get("workspace_mode") or response.get("mode")
    )
    if not mode:
        return None, None
    reason = response.get("reason")
    return mode, reason if isinstance(reason, str) else None


def _handoff_continuation_message(
    target_mode: str,
    *,
    image_context: str | None = None,
) -> gtypes.Content:
    body = (
        f"[ワークスペースを {target_mode} モードに切り替えました] "
        "直前のユーザー依頼を、このモードの専用ツールで続行してください。"
    )
    if image_context and image_context.strip():
        body = f"{body}\n\n{image_context.strip()}"
    return gtypes.Content(
        role="user",
        parts=[gtypes.Part(text=body)],
    )


def _openai_api_key_for_user(user: dict[str, Any]) -> str | None:
    key = openai_api_key_from_user(user)
    if not key:
        uid = user.get("uid")
        if isinstance(uid, str) and uid.strip():
            key = resolve_request_openai_api_key(uid)
    return key


def _require_openai_api_key_for_image(
    *,
    agent_mode: str,
    user: dict[str, Any],
    openai_api_key: str | None,
) -> None:
    if agent_mode == "image" and not openai_api_key and not user.get("auth_disabled"):
        raise HTTPException(
            status_code=400,
            detail="OPENAI_API_KEY_NOT_REGISTERED",
        )


async def _stream_invoke(
    *,
    app: FastAPI | None = None,
    runner: Runner | None = None,
    session_service: Any,
    artifact_service: Any | None = None,
    bucket_name: str = "",
    app_name: str,
    req: InvokeRequest,
    user: dict[str, Any],
    gemini_api_key: str | None,
    openai_api_key: str | None = None,
    agent_mode: str,
    enable_mode_handoff: bool = False,
) -> AsyncIterator[bytes]:
    sid = req.session_id or str(uuid.uuid4())
    user_id = req.user_id or user.get("uid") or "anonymous"
    session_org_id = req.organization_id
    session_space_id = req.space_id

    # ADK の asyncio タスク跨ぎで contextvar が消えることがあるため、
    # SSE ストリーム全体で BYOK を再セット (research-agent と同じ env 注入).
    prev_gemini_env = os.environ.get("GEMINI_API_KEY")
    suspended_byok: tuple[Any, str | None, str | None] | None = None
    if agent_mode == "application_scan":
        suspended_byok = suspend_byok()
        byok_token = None
    else:
        byok_token = activate_byok(gemini_api_key)
    effective_openai_key = openai_api_key or _openai_api_key_for_user(user)
    openai_token = activate_openai_byok(effective_openai_key)
    global_prompt = resolve_global_prompt(
        firestore_prompt=user.get("global_system_prompt")
        if isinstance(user.get("global_system_prompt"), str)
        else None,
        request_override=req.system_prompt,
    )
    global_prompt_token = activate_global_prompt(global_prompt)

    accumulated_grounding: dict[str, Any] | None = None
    pending_search_query: str | None = None
    text_streamed_partial = False
    current_invocation_id: str | None = None
    response_id = req.response_id.strip() if isinstance(req.response_id, str) else None
    if response_id == "":
        response_id = None

    image_ref_token = None
    creation_mode_token = None
    workflow_phase_token = None
    writing_action_token = None
    scope_tokens = set_invoke_session_scope(
        organization_id=session_org_id,
        space_id=session_space_id,
        session_id=sid,
    )
    ui_sync: SessionInvokeSync | None = None
    try:
        resolved_model = resolve_model_for_invoke(agent_mode, req.model)
        effective_fs_id = req.file_space_id
        if agent_mode == "guide":
            effective_fs_id = platform_guide_store_id()

        merged_image_reference: dict[str, Any] | None = None
        prepare_image_ctx = agent_mode == "image" or fe_requests_image_workflow(
            mode_state=req.mode_state,
            reference_images=req.reference_images,
        )
        if prepare_image_ctx or agent_mode == "image":
            stored_for_studio = await read_session_state(
                session_service,
                app_name=app_name,
                user_id=user_id,
                session_id=sid,
                organization_id=session_org_id,
                space_id=session_space_id,
            )
            req.mode_state = merge_image_invoke_mode_state(
                session_state=stored_for_studio,
                request_mode_state=(
                    req.mode_state if isinstance(req.mode_state, dict) else {}
                ),
            )
            workflow_phase_token = activate_invoke_image_workflow_phase(
                resolve_image_workflow_phase(mode_state=req.mode_state)
            )
        if prepare_image_ctx:
            image_invoke_error = validate_image_workflow_invoke(
                mode_state=req.mode_state,
                reference_images=req.reference_images,
            )
            if image_invoke_error:
                raise HTTPException(
                    status_code=400,
                    detail=image_invoke_error,
                )
            stored_for_ref = await read_session_state(
                session_service,
                app_name=app_name,
                user_id=user_id,
                session_id=sid,
                organization_id=session_org_id,
                space_id=session_space_id,
            )
            merged_image_reference = merge_image_reference_on_invoke(
                stored=stored_for_ref,
                mode_state=req.mode_state,
                reference_images=req.reference_images,
            )
            image_creation_mode = resolve_image_creation_mode(
                None, mode_state=req.mode_state
            )
            logger.info(
                "image workflow prep agent_mode=%s creation_mode=%s ref_status=%s",
                agent_mode,
                image_creation_mode,
                (merged_image_reference or {}).get("status"),
            )
            creation_mode_token = activate_invoke_image_creation_mode(
                image_creation_mode
            )
            if image_creation_mode == "scratch":
                image_ref_token = activate_invoke_image_reference(None)
            else:
                image_ref_token = activate_invoke_image_reference(
                    merged_image_reference
                )

        state_patch: dict[str, Any] = {
            "file_space_id": effective_fs_id,
            "agent_search_datastore_path": agent_search_datastore_path(
                effective_fs_id
            ),
            "llm_model": resolved_model,
            "organization_id": req.organization_id,
            "space_id": req.space_id,
        }
        if agent_mode == "sheet":
            sheet_invoke_error = validate_sheet_invoke(
                agent_mode=agent_mode,
                mode_state=req.mode_state,
            )
            if sheet_invoke_error:
                raise HTTPException(
                    status_code=400,
                    detail=sheet_invoke_error,
                )
            state_patch.update(sheet_state_patch_from_mode_state(req.mode_state))
        if agent_mode == "writing":
            stored_for_writing = await read_session_state(
                session_service,
                app_name=app_name,
                user_id=user_id,
                session_id=sid,
                organization_id=session_org_id,
                space_id=session_space_id,
            )
            req.mode_state = merge_writing_invoke_mode_state(
                session_state=stored_for_writing,
                request_mode_state=(
                    req.mode_state if isinstance(req.mode_state, dict) else {}
                ),
            )
            writing_invoke_error = validate_writing_invoke(
                agent_mode=agent_mode,
                mode_state=req.mode_state,
                attachments=req.attachments,
                selected_knowledge=req.selected_knowledge,
            )
            if writing_invoke_error:
                raise HTTPException(
                    status_code=400,
                    detail=writing_invoke_error,
                )
            state_patch.update(
                writing_state_patch_from_mode_state(req.mode_state)
            )
            ms = req.mode_state if isinstance(req.mode_state, dict) else {}
            action = resolve_writing_action_from_mode_state(ms)
            if isinstance(action, str) and action.strip():
                writing_action_token = activate_writing_action(action.strip())
        if agent_mode == "image":
            studio_invoke_error = validate_image_studio_invoke(
                agent_mode=agent_mode,
                mode_state=req.mode_state,
            )
            if studio_invoke_error:
                raise HTTPException(
                    status_code=400,
                    detail=studio_invoke_error,
                )
            state_patch.update(
                image_studio_state_patch_from_mode_state(req.mode_state)
            )
        if agent_mode == "research":
            research_invoke_error = validate_research_invoke(
                agent_mode=agent_mode,
                mode_state=req.mode_state,
            )
            if research_invoke_error:
                raise HTTPException(
                    status_code=400,
                    detail=research_invoke_error,
                )
            from .workspace_state_buckets import patch_task_bucket

            research_patch = research_state_patch_from_mode_state(req.mode_state)
            patch_task_bucket(
                state_patch, "research", research_patch, active_task="research"
            )
        if agent_mode == "guide":
            stored_for_guide = await read_session_state(
                session_service,
                app_name=app_name,
                user_id=user_id,
                session_id=sid,
                organization_id=session_org_id,
                space_id=session_space_id,
            )
            req.mode_state = merge_guide_invoke_mode_state(
                session_state=stored_for_guide,
                request_mode_state=(
                    req.mode_state if isinstance(req.mode_state, dict) else {}
                ),
            )
            state_patch.update(
                guide_state_patch_from_mode_state(req.mode_state)
            )
            patch_guide_bucket(state_patch, req.mode_state)
        if agent_mode == "business_partner":
            stored_for_bp = await read_session_state(
                session_service,
                app_name=app_name,
                user_id=user_id,
                session_id=sid,
                organization_id=session_org_id,
                space_id=session_space_id,
            )
            req.mode_state = merge_business_partner_invoke_mode_state(
                session_state=stored_for_bp,
                request_mode_state=(
                    req.mode_state if isinstance(req.mode_state, dict) else {}
                ),
            )
            bp_invoke_error = validate_business_partner_invoke(
                mode_state=req.mode_state,
            )
            if bp_invoke_error:
                raise HTTPException(
                    status_code=400,
                    detail=bp_invoke_error,
                )
            state_patch.update(
                business_partner_state_patch_from_mode_state(req.mode_state)
            )
            patch_business_partner_bucket(state_patch, req.mode_state)
        if agent_mode == "application_scan":
            state_patch.update(
                application_scan_state_patch_from_mode_state(req.mode_state)
            )
        if agent_mode == "vibe_capability_structuring":
            state_patch.update(
                vibe_capability_structuring_state_patch_from_mode_state(
                    req.mode_state
                )
            )
        if agent_mode == "vibe_story_generation":
            state_patch.update(
                vibe_story_generation_state_patch_from_mode_state(req.mode_state)
            )
        if merged_image_reference is not None:
            from .workspace_state_buckets import patch_task_bucket

            creation = resolve_image_creation_mode(
                None, mode_state=req.mode_state
            )
            image_bucket_patch: dict[str, Any] = {
                "setup": {
                    "reference": merged_image_reference,
                    **(
                        {"creation": creation}
                        if creation in ("scratch", "reference")
                        else {}
                    ),
                },
            }
            patch_task_bucket(
                state_patch, "image", image_bucket_patch, active_task="image"
            )

        await ensure_session_state(
            session_service,
            app_name=app_name,
            user_id=user_id,
            session_id=sid,
            state_patch=state_patch,
            organization_id=session_org_id,
            space_id=session_space_id,
        )

        await bootstrap_task_invoke(
            session_service=session_service,
            app_name=app_name,
            user_id=user_id,
            session_id=sid,
            organization_id=session_org_id,
            space_id=session_space_id,
            task=agent_mode,
            linked_response_id=response_id,
        )

        ui_sync = SessionInvokeSync(
            session_service=session_service,
            app_name=app_name,
            user_id=user_id,
            session_id=sid,
            organization_id=session_org_id,
            space_id=session_space_id,
            response_id=response_id,
            agent_mode=agent_mode,
            mode_state=req.mode_state,
        )
        await ui_sync.bootstrap_from_request(
            prompt=req.prompt,
            history=list(req.history or []),
        )

        active_mode = normalize_workspace_mode(
            (req.mode_state or {}).get("active_mode")
        )
        if active_mode:
            await persist_session_state_patch(
                session_service,
                app_name=app_name,
                user_id=user_id,
                session_id=sid,
                state_patch={"active_task": active_mode},
                organization_id=session_org_id,
                space_id=session_space_id,
            )

        is_first_turn = len(req.history) == 0
        extra_parts: list[gtypes.Part] = []
        if is_first_turn and req.attachments:
            try:
                extra_parts = prepare_attachment_parts(req.attachments)
            except Exception as exc:  # pragma: no cover (best effort)
                logger.warning("prepare_attachment_parts failed: %s", exc)

        knowledge_parts: list[gtypes.Part] = []
        resolved_datastore = agent_search_datastore_path(effective_fs_id)
        if agent_mode != "guide" and resolved_datastore:
            logger.info(
                "invoke agent search: mode=%s session=%s datastore=%s file_space_id=%s",
                agent_mode,
                sid,
                resolved_datastore,
                effective_fs_id,
            )
            if agent_mode == "image":
                search_instruction = prepare_image_agent_search_turn_instruction(
                    datastore_path=resolved_datastore,
                )
            elif agent_mode == "research":
                search_instruction = prepare_research_agent_search_turn_instruction(
                    datastore_path=resolved_datastore,
                )
            elif agent_mode == "writing":
                search_instruction = prepare_writing_agent_search_turn_instruction(
                    datastore_path=resolved_datastore,
                )
            else:
                search_instruction = prepare_agent_search_turn_instruction(
                    datastore_path=resolved_datastore,
                )
            if search_instruction:
                knowledge_parts.append(search_instruction)
        if merged_image_reference is not None:
            image_creation_mode = resolve_image_creation_mode(
                None, mode_state=req.mode_state
            )
            knowledge_parts.insert(
                0,
                gtypes.Part(
                    text=(
                        "# 画像作成モード\n\n"
                        f"{image_turn_context_summary(creation_mode=image_creation_mode, image_reference=merged_image_reference)}\n"
                    )
                ),
            )

        if agent_mode == "sheet":
            sheet_ctx = sheet_turn_context_summary(mode_state=req.mode_state)
            if sheet_ctx:
                knowledge_parts.insert(
                    0,
                    gtypes.Part(
                        text=(
                            "# 接続済みスプレッドシート\n\n"
                            f"{sheet_ctx}\n"
                        )
                    ),
                )

        if agent_mode == "writing":
            writing_ctx = writing_turn_context_summary(mode_state=req.mode_state)
            if writing_ctx:
                knowledge_parts.insert(
                    0,
                    gtypes.Part(
                        text=(
                            "# 文書フォームワークフロー\n\n"
                            f"{writing_ctx}\n"
                        )
                    ),
                )

        if agent_mode == "image":
            studio_ctx = image_studio_turn_context_summary(
                mode_state=req.mode_state
            )
            if studio_ctx:
                knowledge_parts.insert(
                    0,
                    gtypes.Part(
                        text=(
                            "# 画像ワークフロー\n\n"
                            f"{studio_ctx}\n"
                        )
                    ),
                )

        if agent_mode == "research":
            if is_research_plan_only(req.mode_state):
                knowledge_parts.insert(
                    0,
                    gtypes.Part(text=research_plan_only_instruction_text()),
                )
            elif is_research_pipeline_autonomous(req.mode_state):
                knowledge_parts.insert(
                    0,
                    gtypes.Part(text=research_autonomous_instruction_text()),
                )
            research_ctx = research_turn_context_summary(
                mode_state=req.mode_state
            )
            if research_ctx:
                knowledge_parts.insert(
                    0,
                    gtypes.Part(
                        text=(
                            "# リサーチワークフロー\n\n"
                            f"{research_ctx}\n"
                        )
                    ),
                )


        if agent_mode == "business_partner":
            bp_ctx = business_partner_turn_context_summary(
                mode_state=req.mode_state
            )
            if bp_ctx:
                knowledge_parts.insert(
                    0,
                    gtypes.Part(
                        text=(
                            "# 取引先登録ワークフロー\n\n"
                            f"{bp_ctx}\n"
                        )
                    ),
                )

        guide_ctx = _guide_context_from_mode_state(req.mode_state)
        if agent_mode == "guide" and guide_ctx:
            knowledge_parts.append(
                gtypes.Part(
                    text=(
                        "# 実行時コンテキスト（ナビ・画面）\n\n"
                        f"{guide_ctx}\n\n"
                        "---\n\n"
                        "上記はユーザーが今見ている画面です。Agent Search の結果とあわせて "
                        "最適な操作案内を選んでください。\n"
                    )
                )
            )

        pinned_raw = user.get("pinned_knowledge")
        pinned_list = pinned_raw if isinstance(pinned_raw, list) else []
        turn_list = list(req.selected_knowledge or [])
        pinned_refs, turn_only_refs = merge_knowledge_refs(pinned_list, turn_list)
        try:
            if pinned_refs:
                knowledge_parts.extend(
                    prepare_knowledge_context_parts(
                        pinned_refs,
                        section_title=(
                            f"ピン留め参照知識（常時・{len(pinned_refs)} 件）"
                        ),
                        section_intro=(
                            "以下はユーザーが共通設定で **常に参照する** 社内資料です. "
                            "全ターンで最優先の根拠として扱い、Global 指示と矛盾する場合は "
                            "ピン留め資料を優先してください.\n"
                        ),
                    )
                )
            if turn_only_refs:
                knowledge_parts.extend(
                    prepare_knowledge_context_parts(
                        turn_only_refs,
                        section_title=(
                            f"本ターンの追加参照知識（{len(turn_only_refs)} 件）"
                        ),
                        section_intro=(
                            "以下は今回の相談でユーザーが **追加指定した** 資料です. "
                            "ピン留め資料とあわせて参照してください.\n"
                        ),
                    )
                )
        except Exception as exc:  # pragma: no cover (best effort)
            logger.warning("prepare_knowledge_context_parts failed: %s", exc)

        user_msg = gtypes.Content(
            role="user",
            parts=[*knowledge_parts, gtypes.Part(text=req.prompt), *extra_parts],
        )

        if agent_mode == "writing":
            writing_action = resolve_writing_action_from_mode_state(
                req.mode_state if isinstance(req.mode_state, dict) else {}
            )
            if (
                writing_action == "generate_document"
                and isinstance(session_service, FirestoreSessionService)
            ):
                cleared = await session_service.clear_session_events(
                    app_name=app_name,
                    user_id=user_id,
                    session_id=sid,
                    organization_id=session_org_id,
                    space_id=session_space_id,
                )
                if cleared:
                    logger.info(
                        "writing generate_document: cleared %s adk events session=%s",
                        cleared,
                        sid,
                    )

        current_agent_mode = agent_mode
        message_for_run = user_msg
        handoffs_left = 2 if enable_mode_handoff else 0
        active_runner = runner
        research_autonomous_turns_left = (
            RESEARCH_AUTONOMOUS_MAX_TURNS
            if agent_mode == "research"
            and is_research_pipeline_autonomous(req.mode_state)
            else 0
        )

        while True:
            if active_runner is None:
                if app is None:
                    raise RuntimeError("ADK runner is not configured")
                run_fs_id = req.file_space_id
                if current_agent_mode == "guide":
                    run_fs_id = platform_guide_store_id()
                run_model = resolve_model_for_invoke(current_agent_mode, req.model)
                active_runner = _get_or_create_runner(
                    app=app,
                    mode=current_agent_mode,
                    file_space_id=run_fs_id,
                    model_api_name=run_model,
                    app_name=app_name,
                )

            handoff_target: str | None = None
            async for event in active_runner.run_async(
                user_id=user_id, session_id=sid, new_message=message_for_run
            ):
                inv_id = getattr(event, "invocation_id", None)
                if inv_id and inv_id != current_invocation_id:
                    current_invocation_id = inv_id
                    text_streamed_partial = False

                gm = getattr(event, "grounding_metadata", None)
                if gm is not None:
                    payload = grounding_event_payload(gm)
                    if payload:
                        accumulated_grounding = merge_grounding_metadata(
                            accumulated_grounding, payload
                        )
                        yield _sse("grounding", payload)
                        await ui_sync.merge_grounding(
                            grounding=payload,
                            response_id=response_id,
                        )
                content = getattr(event, "content", None)
                parts = getattr(content, "parts", None) if content else None
                if parts:
                    for p in parts:
                        t = getattr(p, "text", None)
                        if t:
                            is_partial = getattr(event, "partial", None)
                            if is_partial is True:
                                text_streamed_partial = True
                                yield _sse("text_delta", {"text": t})
                                await ui_sync.append_text_delta(text=t)
                            elif is_partial is False:
                                if not text_streamed_partial:
                                    yield _sse("text_delta", {"text": t})
                                    await ui_sync.append_text_delta(text=t)
                            else:
                                yield _sse("text_delta", {"text": t})
                                await ui_sync.append_text_delta(text=t)
                        fc = getattr(p, "function_call", None)
                        if fc is not None:
                            name = getattr(fc, "name", None)
                            if isinstance(name, str) and name.strip():
                                tool_name = name.strip()
                                if tool_name in _DISCOVERY_SEARCH_TOOLS:
                                    args = getattr(fc, "args", None)
                                    if isinstance(args, dict):
                                        q = args.get("query")
                                        if isinstance(q, str) and q.strip():
                                            pending_search_query = q.strip()
                                yield _sse(
                                    "tool_call",
                                    {"name": tool_name, "status": "running"},
                                )
                                await ui_sync.add_activity(
                                    name=tool_name,
                                    status="running",
                                )
                fr = _extract_function_response(event)
                if fr:
                    name = fr.get("name")
                    tool_name = (
                        name.strip()
                        if isinstance(name, str) and name.strip()
                        else "tool"
                    )
                    response = fr.get("response")
                    tool_status = "completed"
                    if isinstance(response, dict) and response.get("ok") is False:
                        tool_status = "failed"
                    yield _sse(
                        "tool_result",
                        {"name": tool_name, "status": tool_status},
                    )
                    await ui_sync.add_activity(
                        name=tool_name,
                        status=tool_status,
                    )
                    if isinstance(response, dict):
                        tool_grounding = extract_grounding_from_tool_response(
                            response,
                            query=pending_search_query or "",
                        )
                        if tool_grounding:
                            accumulated_grounding = merge_grounding_metadata(
                                accumulated_grounding, tool_grounding
                            )
                            yield _sse("grounding", tool_grounding)
                            await ui_sync.merge_grounding(
                                grounding=tool_grounding,
                                response_id=response_id,
                            )
                        mode, reason = _emit_mode_from_tool_response(response)
                        if mode:
                            from .workspace_state_buckets import patch_task_bucket

                            mode_patch: dict[str, Any] = {
                                "active_task": mode,
                            }
                            if mode == "image":
                                creation = resolve_image_creation_mode(
                                    None, mode_state=req.mode_state
                                )
                                setup: dict[str, Any] = {
                                    "reference": image_reference_state_for_mode_handoff(
                                        mode_state=req.mode_state,
                                        merged_on_invoke=merged_image_reference,
                                    ),
                                }
                                if creation in ("scratch", "reference"):
                                    setup["creation"] = creation
                                patch_task_bucket(mode_patch, "image", {"setup": setup})
                            await persist_session_state_patch(
                                session_service,
                                app_name=app_name,
                                user_id=user_id,
                                session_id=sid,
                                state_patch=mode_patch,
                                organization_id=session_org_id,
                                space_id=session_space_id,
                            )
                            yield _sse(
                                "mode_change",
                                {
                                    "mode": mode,
                                    "reason": reason,
                                },
                            )
                            await ui_sync.apply_mode_change(
                                mode=mode,
                                reason=reason if isinstance(reason, str) else None,
                            )
                            if (
                                enable_mode_handoff
                                and mode != current_agent_mode
                            ):
                                handoff_target = mode
                                if tool_name in {
                                    "convert_mode",
                                    "set_workspace_mode",
                                }:
                                    break
                        if (
                            tool_name
                            in (
                                "save_writing_form_schema",
                                "confirm_writing_schema",
                                "add_json_document",
                            )
                            and isinstance(response, dict)
                            and response.get("ok") is True
                            and current_agent_mode == "writing"
                        ):
                            from .workspace_state_buckets import patch_task_bucket

                            writing_tool_bucket: dict[str, Any] = {}
                            if isinstance(response.get("writing_form"), dict):
                                writing_tool_bucket["writing_form"] = response[
                                    "writing_form"
                                ]
                            phase_val = response.get("writing_phase")
                            if isinstance(phase_val, str) and phase_val.strip():
                                writing_tool_bucket["writing_phase"] = phase_val.strip()
                            if writing_tool_bucket:
                                writing_tool_patch: dict[str, Any] = {}
                                patch_task_bucket(
                                    writing_tool_patch,
                                    "writing",
                                    writing_tool_bucket,
                                )
                                await persist_session_state_patch(
                                    session_service,
                                    app_name=app_name,
                                    user_id=user_id,
                                    session_id=sid,
                                    state_patch=writing_tool_patch,
                                    organization_id=session_org_id,
                                    space_id=session_space_id,
                                )
                                await ui_sync.patch_writing_bucket(
                                    bucket=writing_tool_bucket
                                )
                        if (
                            tool_name
                            in (
                                "save_business_partner_draft",
                                "update_business_partner_phase",
                            )
                            and isinstance(response, dict)
                            and response.get("ok") is True
                            and current_agent_mode == "business_partner"
                        ):
                            from .workspace_state_buckets import patch_task_bucket

                            bp_tool_bucket: dict[str, Any] = {}
                            nested = response.get("business_partner")
                            if isinstance(nested, dict):
                                bp_tool_bucket = dict(nested)
                            elif tool_name == "update_business_partner_phase":
                                phase_val = response.get("phase")
                                if isinstance(phase_val, str) and phase_val.strip():
                                    bp_tool_bucket["phase"] = phase_val.strip()
                                msg = response.get("message")
                                if isinstance(msg, str) and msg.strip():
                                    bp_tool_bucket["last_progress_message"] = msg.strip()
                            if bp_tool_bucket:
                                bp_tool_patch: dict[str, Any] = {}
                                patch_task_bucket(
                                    bp_tool_patch,
                                    "business_partner",
                                    bp_tool_bucket,
                                )
                                await persist_session_state_patch(
                                    session_service,
                                    app_name=app_name,
                                    user_id=user_id,
                                    session_id=sid,
                                    state_patch=bp_tool_patch,
                                    organization_id=session_org_id,
                                    space_id=session_space_id,
                                )
                        if response.get("ok") is False:
                            err = response.get("error")
                            if isinstance(err, str) and err.strip():
                                err_text = f"\n\n⚠️ {err.strip()}"
                                yield _sse("text_delta", {"text": err_text})
                                await ui_sync.append_text_delta(text=err_text)
                        for event_name, payload in emit_tool_artifact_events(
                            response
                        ):
                            ref_dict = await _en_message_artifact_ref(
                                event_name=event_name,
                                payload=payload,
                                artifact_service=artifact_service,
                                bucket_name=bucket_name,
                                app_name=app_name,
                                user_id=user_id,
                                session_id=sid,
                            )
                            if ref_dict is None:
                                continue
                            yield _sse("artifact", ref_dict)
                            await ui_sync.append_artifact(artifact=ref_dict)
                            if (
                                ref_dict.get("kind") == "image"
                                and current_agent_mode == "image"
                            ):
                                from .workspace_state_buckets import patch_task_bucket

                                primary_payload = {
                                    "adk_filename": ref_dict.get("adkFilename"),
                                    "artifact_id": ref_dict.get("artifactId"),
                                    "version": ref_dict.get("artifactVersion"),
                                }
                                image_patch: dict[str, Any] = {}
                                patch_task_bucket(
                                    image_patch,
                                    "image",
                                    {"primary_image": primary_payload},
                                )
                                await persist_session_state_patch(
                                    session_service,
                                    app_name=app_name,
                                    user_id=user_id,
                                    session_id=sid,
                                    state_patch=image_patch,
                                    organization_id=session_org_id,
                                    space_id=session_space_id,
                                )
                                await ui_sync.patch_image_primary(
                                    primary=primary_payload
                                )
                            if isinstance(session_service, FirestoreSessionService):
                                await session_service.patch_artifact_message_link(
                                    session_id=sid,
                                    organization_id=session_org_id,
                                    space_id=session_space_id,
                                    artifact_id=ref_dict["artifactId"],
                                    response_id=ui_sync._response_id,
                                )

            if (
                handoff_target
                and handoffs_left > 0
                and app is not None
            ):
                handoffs_left -= 1
                current_agent_mode = handoff_target
                if handoff_target == "image":
                    stored_for_ref = await read_session_state(
                        session_service,
                        app_name=app_name,
                        user_id=user_id,
                        session_id=sid,
                        organization_id=session_org_id,
                        space_id=session_space_id,
                    )
                    merged_image_reference = merge_image_reference_on_invoke(
                        stored=stored_for_ref,
                        mode_state=req.mode_state,
                        reference_images=req.reference_images,
                    )
                    image_creation_mode = resolve_image_creation_mode(
                        None, mode_state=req.mode_state
                    )
                    deactivate_invoke_image_creation_mode(creation_mode_token)
                    deactivate_invoke_image_reference(image_ref_token)
                    creation_mode_token = activate_invoke_image_creation_mode(
                        image_creation_mode
                    )
                    if image_creation_mode == "scratch":
                        image_ref_token = activate_invoke_image_reference(None)
                    else:
                        image_ref_token = activate_invoke_image_reference(
                            merged_image_reference
                        )
                    image_context = image_turn_context_summary(
                        creation_mode=image_creation_mode,
                        image_reference=merged_image_reference or {},
                    )
                    message_for_run = _handoff_continuation_message(
                        handoff_target,
                        image_context=image_context,
                    )
                else:
                    message_for_run = _handoff_continuation_message(
                        handoff_target
                    )
                active_runner = None
                text_streamed_partial = False
                current_invocation_id = None
                continue
            if (
                current_agent_mode == "research"
                and research_autonomous_turns_left > 0
                and is_research_pipeline_autonomous(req.mode_state)
            ):
                stored_for_research = await read_session_state(
                    session_service,
                    app_name=app_name,
                    user_id=user_id,
                    session_id=sid,
                    organization_id=session_org_id,
                    space_id=session_space_id,
                )
                if not is_research_pipeline_terminal(stored_for_research):
                    research_autonomous_turns_left -= 1
                    logger.info(
                        "research pipeline_autonomous continue session=%s turns_left=%s",
                        sid,
                        research_autonomous_turns_left,
                    )
                    message_for_run = gtypes.Content(
                        role="user",
                        parts=[
                            gtypes.Part(
                                text=RESEARCH_AUTONOMOUS_CONTINUE_MESSAGE
                            )
                        ],
                    )
                    text_streamed_partial = False
                    current_invocation_id = None
                    continue
            break

        stored_state = await read_session_state(
            session_service,
            app_name=app_name,
            user_id=user_id,
            session_id=sid,
            organization_id=session_org_id,
            space_id=session_space_id,
        )
        done_payload: dict[str, Any] = {"session_id": sid}
        if response_id and accumulated_grounding:
            existing_map: dict[str, Any] = {}
            raw_map = stored_state.get("grounding_metadata_by_response_id")
            if isinstance(raw_map, dict):
                existing_map = dict(raw_map)
            existing_map[response_id] = accumulated_grounding
            await persist_session_state_patch(
                session_service,
                app_name=app_name,
                user_id=user_id,
                session_id=sid,
                state_patch={"grounding_metadata_by_response_id": existing_map},
                organization_id=session_org_id,
                space_id=session_space_id,
            )
            done_payload["response_id"] = response_id
            done_payload["grounding_metadata"] = accumulated_grounding
        session_mode = normalize_workspace_mode(stored_state.get("mode"))
        if session_mode:
            done_payload["mode"] = session_mode
        if agent_mode == "image" or stored_state.get("image_reference"):
            raw_ref = stored_state.get("image_reference")
            if isinstance(raw_ref, dict):
                done_payload["image_reference"] = raw_ref
        if agent_mode == "business_partner":
            raw_bp = stored_state.get("business_partner")
            if isinstance(raw_bp, dict) and raw_bp:
                finalized_bp = finalize_business_partner_bucket(raw_bp)
                if finalized_bp != raw_bp:
                    bp_finalize_patch: dict[str, Any] = {}
                    patch_business_partner_bucket(
                        bp_finalize_patch,
                        {"business_partner": finalized_bp},
                    )
                    await persist_session_state_patch(
                        session_service,
                        app_name=app_name,
                        user_id=user_id,
                        session_id=sid,
                        state_patch=bp_finalize_patch,
                        organization_id=session_org_id,
                        space_id=session_space_id,
                    )
                    draft = finalized_bp.get("draft")
                    if isinstance(draft, dict) and draft.get("fields"):
                        import json as _json

                        yield _sse(
                            "artifact",
                            {
                                "kind": "json_document",
                                "title": "business_partner_draft",
                                "body": _json.dumps(draft, ensure_ascii=False),
                            },
                        )
                done_payload["business_partner"] = finalized_bp
        if ui_sync is not None:
            await ui_sync.finalize_turn()
        await finalize_task_invoke(
            session_service=session_service,
            app_name=app_name,
            user_id=user_id,
            session_id=sid,
            organization_id=session_org_id,
            space_id=session_space_id,
            task=agent_mode,
            status="completed",
            message="invoke completed",
        )
        yield _sse("done", done_payload)
    except Exception as exc:  # pragma: no cover
        logger.exception("invoke stream failed: %s", exc)
        err_msg = str(exc)[:500]
        if ui_sync is not None:
            await ui_sync.finalize_turn(error_message=err_msg)
        await finalize_task_invoke(
            session_service=session_service,
            app_name=app_name,
            user_id=user_id,
            session_id=sid,
            organization_id=session_org_id,
            space_id=session_space_id,
            task=agent_mode,
            status="error",
            error_message=err_msg,
            message=err_msg,
        )
        yield _sse("error", {"message": err_msg})
    finally:
        deactivate_invoke_image_reference(image_ref_token)
        deactivate_invoke_image_creation_mode(creation_mode_token)
        deactivate_invoke_image_workflow_phase(workflow_phase_token)
        deactivate_writing_action(writing_action_token)
        deactivate_global_prompt(global_prompt_token)
        if suspended_byok is not None:
            token, previous_gemini_env, previous_google_env = suspended_byok
            resume_byok(
                token,
                previous_gemini_env=previous_gemini_env,
                previous_google_env=previous_google_env,
            )
        else:
            deactivate_byok(byok_token, previous_env=prev_gemini_env)
        deactivate_openai_byok(openai_token)
        reset_invoke_session_scope(scope_tokens)


def _runner_cache_key(
    mode: str, datastore_path: str | None, model_api_name: str
) -> str:
    return f"{mode}::{datastore_path or ''}::{model_api_name}"


def _get_or_create_runner(
    *,
    app: FastAPI,
    mode: str,
    file_space_id: str | None,
    model_api_name: str,
    app_name: str,
) -> Runner:
    datastore_path = agent_search_datastore_path(file_space_id)
    cache: dict[str, Runner] = app.state.runner_cache
    key = _runner_cache_key(mode, datastore_path, model_api_name)
    runner = cache.get(key)
    if runner is None:
        agent = build_agent_for_mode(
            mode, datastore_path=datastore_path, model=model_api_name
        )
        services = app.state.adk_services
        runner = create_runner(agent=agent, app_name=app_name, services=services)
        cache[key] = runner
    return runner


def create_unified_app(*, agents: dict[str, AgentBundle]) -> FastAPI:
    """複数 mode を 1 Cloud Run サービスで提供する FastAPI app."""

    @asynccontextmanager
    async def _lifespan(_app: FastAPI):
        services = init_adk_app_state(_app)
        _app.state.runner_cache = {}
        _app.state.unified_modes = sorted(agents.keys())
        research_bundle = agents.get("research")
        if research_bundle is not None and research_bundle.root_agent is not None:
            _app.state.runner = create_runner(
                agent=research_bundle.root_agent,
                app_name=UNIFIED_APP_NAME,
                services=services,
            )
            logger.info("unified oneStop runner=research coordinator")
        logger.info(
            "startup complete (unified modes=%s)",
            ",".join(_app.state.unified_modes),
        )
        yield
        logger.info("shutdown (unified)")

    app = FastAPI(title="EN AIstudio ADK Agent — unified", lifespan=_lifespan)
    register_adk_artifact_routes(app, app_name=UNIFIED_APP_NAME)

    def _get_services(request: Request) -> AdkServices:
        return request.app.state.adk_services

    def _get_runner(request: Request) -> Runner | None:
        return getattr(request.app.state, "runner", None)

    register_session_routes(
        app,
        app_name=UNIFIED_APP_NAME,
        get_services=_get_services,
        get_runner=_get_runner,
        require_user=require_user,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )

    @app.get("/healthz")
    async def healthz() -> JSONResponse:
        return JSONResponse(
            {
                "ok": True,
                "modes": getattr(app.state, "unified_modes", sorted(agents.keys())),
                "service": "en-aistudio-adk-agent",
            }
        )

    @app.post("/v1/agents/{mode}/invoke")
    async def invoke(
        mode: str,
        req: InvokeRequest,
        user: dict[str, Any] = Depends(require_user_or_internal_invoke),
    ) -> StreamingResponse:
        path_mode = mode.strip().lower()
        if agents.get(path_mode) is None:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown agent mode: {mode}",
            )
        session_service = app.state.session_service
        services = app.state.adk_services
        user_id = user.get("uid") or ""
        stored_state: dict[str, Any] = {}
        scope_tokens = set_invoke_session_scope(
            organization_id=req.organization_id,
            space_id=req.space_id,
            session_id=req.session_id,
        )
        try:
            if req.session_id:
                stored_state = (
                    await read_session_state(
                        session_service,
                        app_name=UNIFIED_APP_NAME,
                        user_id=user_id,
                        session_id=req.session_id,
                        organization_id=req.organization_id,
                        space_id=req.space_id,
                    )
                    or {}
                )
        finally:
            reset_invoke_session_scope(scope_tokens)
        effective_mode = resolve_invoke_agent_mode(
            url_mode=path_mode,
            mode_state=req.mode_state,
            session_state=stored_state,
        )
        if effective_mode != path_mode:
            logger.info(
                "invoke agent mode resolved path=%s effective=%s sid=%s",
                path_mode,
                effective_mode,
                req.session_id,
            )
        if agents.get(effective_mode) is None:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown agent mode: {effective_mode}",
            )
        mode = effective_mode
        bundle = agents[mode]
        gemini_api_key = gemini_api_key_from_user(user)
        if (
            mode != "application_scan"
            and not gemini_api_key
            and not user.get("auth_disabled")
        ):
            raise HTTPException(
                status_code=400,
                detail="GEMINI_API_KEY_NOT_REGISTERED",
            )
        openai_api_key = _openai_api_key_for_user(user)
        _require_openai_api_key_for_image(
            agent_mode=mode, user=user, openai_api_key=openai_api_key
        )
        effective_file_space_id = req.file_space_id
        if mode == "guide":
            effective_file_space_id = platform_guide_store_id()
        invoke_updates: dict[str, Any] = {}
        if effective_file_space_id != req.file_space_id:
            invoke_updates["file_space_id"] = effective_file_space_id
        invoke_req = (
            req.model_copy(update=invoke_updates) if invoke_updates else req
        )

        async def _stream() -> AsyncIterator[bytes]:
            async for chunk in _stream_invoke(
                app=app,
                session_service=session_service,
                artifact_service=services.artifact_service,
                bucket_name=services.bucket_name,
                app_name=bundle.app_name,
                req=invoke_req,
                user=user,
                gemini_api_key=gemini_api_key,
                openai_api_key=openai_api_key,
                agent_mode=mode,
                enable_mode_handoff=True,
            ):
                yield chunk

        return StreamingResponse(
            _stream(), media_type="text/event-stream", headers=_SSE_HEADERS
        )

    return app


def create_app(*, mode: str, app_name: str, root_agent: Any) -> FastAPI:
    """mode (writing/sheet/image) と root_agent から FastAPI app を組み立てる."""

    @asynccontextmanager
    async def _lifespan(_app: FastAPI):
        services = init_adk_app_state(_app)
        _app.state.runner = create_runner(
            agent=root_agent,
            app_name=app_name,
            services=services,
        )
        logger.info("startup complete (mode=%s app_name=%s)", mode, app_name)
        yield
        logger.info("shutdown (mode=%s)", mode)

    app = FastAPI(title=f"EN AIstudio ADK Agent — {mode}", lifespan=_lifespan)
    register_adk_artifact_routes(app, app_name=app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )

    @app.get("/healthz")
    async def healthz() -> JSONResponse:
        return JSONResponse({"ok": True, "mode": mode, "app_name": app_name})

    @app.post(f"/v1/agents/{mode}/invoke")
    async def invoke(
        req: InvokeRequest,
        user: dict[str, Any] = Depends(require_user_or_internal_invoke),
    ) -> StreamingResponse:
        runner: Runner = app.state.runner
        session_service = app.state.session_service
        gemini_api_key = gemini_api_key_from_user(user)
        if not gemini_api_key and not user.get("auth_disabled"):
            raise HTTPException(
                status_code=400,
                detail="GEMINI_API_KEY_NOT_REGISTERED",
            )
        openai_api_key = _openai_api_key_for_user(user)
        _require_openai_api_key_for_image(
            agent_mode=mode, user=user, openai_api_key=openai_api_key
        )

        services = app.state.adk_services

        async def _stream() -> AsyncIterator[bytes]:
            async for chunk in _stream_invoke(
                runner=runner,
                session_service=session_service,
                artifact_service=services.artifact_service,
                bucket_name=services.bucket_name,
                app_name=app_name,
                req=req,
                user=user,
                gemini_api_key=gemini_api_key,
                openai_api_key=openai_api_key,
                agent_mode=mode,
            ):
                yield chunk

        return StreamingResponse(
            _stream(), media_type="text/event-stream", headers=_SSE_HEADERS
        )

    return app


async def _en_message_artifact_ref(
    *,
    event_name: str,
    payload: dict[str, Any],
    artifact_service: Any | None,
    bucket_name: str,
    app_name: str,
    user_id: str,
    session_id: str,
) -> dict[str, str] | None:
    """Build en_ui artifact ref; GCS ingest is handled by Firebase Functions."""
    if event_name == "artifact_ref":
        if artifact_service is not None and bucket_name:
            resolved = await resolve_artifact_ref_for_sse(
                artifact_service=artifact_service,
                app_name=app_name,
                user_id=user_id,
                session_id=session_id,
                bucket_name=bucket_name,
                ref=payload,
            )
            if resolved and resolved.get("kind"):
                filename = (
                    resolved.get("adk_filename")
                    or payload.get("filename")
                    or ""
                )
                if isinstance(filename, str) and filename.strip():
                    version_raw = resolved.get("version", payload.get("version"))
                    version = (
                        int(version_raw) if isinstance(version_raw, int) else 0
                    )
                    kind = str(resolved.get("kind") or "other")
                    return message_artifact_ref_from_ref(
                        session_id=session_id,
                        filename=filename.strip(),
                        version=version,
                        kind=kind,
                    )
        return message_artifact_ref_from_tool_ref(
            session_id=session_id,
            ref=payload,
        )
    if event_name == "artifact" and payload.get("kind"):
        filename = payload.get("adk_filename") or payload.get("filename")
        version_raw = payload.get("version", payload.get("artifactVersion"))
        if not isinstance(filename, str) or not filename.strip():
            return None
        if not isinstance(version_raw, int):
            return None
        kind = str(payload.get("kind") or "other")
        return message_artifact_ref_from_ref(
            session_id=session_id,
            filename=filename.strip(),
            version=version_raw,
            kind=kind,
        )
    return None


def _sse(event: str, data: dict[str, Any]) -> bytes:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


def _session_event_view(event: Any) -> dict[str, Any]:
    view: dict[str, Any] = {
        "author": getattr(event, "author", "system"),
        "timestamp": getattr(event, "timestamp", None),
    }
    content = getattr(event, "content", None)
    if content is not None:
        try:
            view["content"] = content.model_dump(mode="json", exclude_none=True)
        except Exception:
            view["content"] = str(content)
    return view


def _session_debug_payload(session: Any, *, app_name: str) -> dict[str, Any]:
    events = getattr(session, "events", []) or []
    recent_events = events[-30:] if len(events) > 30 else events
    return {
        "sessionId": session.id,
        "appName": app_name,
        "state": dict(getattr(session, "state", None) or {}),
        "eventCount": len(events),
        "events": [_session_event_view(e) for e in recent_events],
        "lastUpdateTime": getattr(session, "last_update_time", None),
    }


def _extract_function_response(event: Any) -> dict[str, Any] | None:
    """ADK event から function_response 部分を取り出す (artifact 抽出用).

    event.content.parts[i].function_response.{name, response} の形を期待.
    無ければ None.
    """
    content = getattr(event, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return None
    for p in parts:
        fr = getattr(p, "function_response", None)
        if fr is not None:
            return {
                "name": getattr(fr, "name", None),
                "response": getattr(fr, "response", None),
            }
    return None
