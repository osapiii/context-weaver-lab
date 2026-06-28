"""Tools for VibeControl Capability Structuring Agent."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from common.tool_state import get_writable_state, read_tool_state  # type: ignore

CapabilityStatuses = {"draft", "active", "archived"}
ReviewStates = {"ready", "needs_review"}
DriftLevels = {"none", "low", "medium", "high"}
PatchOperations = {
    "create",
    "update",
    "delete",
    "merge",
    "split",
    "move_evidence",
    "reorder",
    "lock",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _clean_text(value: Any, fallback: str = "") -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _int_range(value: Any, *, fallback: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = fallback
    return max(minimum, min(maximum, parsed))


def _string_list(value: Any, *, limit: int = 30) -> list[str]:
    out: list[str] = []
    for item in _as_list(value)[:limit]:
        text = str(item).strip()
        if text:
            out.append(text)
    return out


def _task_bucket(tool_context: Any) -> dict[str, Any]:
    state = read_tool_state(tool_context)
    return _as_dict(state.get("vibe_capability_structuring"))


def _setup_from_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(bucket.get("setup"))


def _payload_from_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(bucket.get("payload"))


def _application_from_setup(setup: dict[str, Any]) -> dict[str, Any]:
    application_key = _clean_text(
        setup.get("application_key"),
        _clean_text(setup.get("applicationKey"), "APP"),
    ).upper()
    return {
        "id": _clean_text(
            setup.get("application_id"),
            _clean_text(setup.get("applicationId"), "app-default"),
        ),
        "applicationKey": application_key,
        "name": _clean_text(
            setup.get("application_name"),
            _clean_text(setup.get("applicationName"), "VibeControl Application"),
        ),
        "fileSpaceId": _clean_text(
            setup.get("file_space_id"),
            _clean_text(setup.get("fileSpaceId")),
        )
        or None,
        "repoFullName": _clean_text(
            setup.get("repo_full_name"),
            _clean_text(setup.get("repoFullName")),
        )
        or None,
        "defaultBranch": _clean_text(
            setup.get("default_branch"),
            _clean_text(setup.get("defaultBranch"), "main"),
        ),
    }


def _normalize_capability(
    raw: dict[str, Any],
    *,
    application: dict[str, Any],
    index: int,
) -> dict[str, Any]:
    capability_key = _clean_text(
        raw.get("capabilityKey"),
        _clean_text(
            raw.get("capability_key"),
            f"{application['applicationKey']}-CAP-{index + 1:03d}",
        ),
    ).upper()
    status = _clean_text(raw.get("status"), "draft")
    if status not in CapabilityStatuses:
        status = "draft"
    review_state = _clean_text(raw.get("reviewState"), "needs_review")
    if review_state not in ReviewStates:
        review_state = "needs_review"
    drift = _clean_text(raw.get("driftLevel"), "medium")
    if drift not in DriftLevels:
        drift = "medium"
    return {
        "id": _clean_text(raw.get("id"), f"capability-{capability_key.lower()}"),
        "applicationId": application["id"],
        "applicationKey": application["applicationKey"],
        "capabilityKey": capability_key,
        "name": _clean_text(raw.get("name"), f"Capability {index + 1}"),
        "summary": _clean_text(raw.get("summary")) or None,
        "domain": _clean_text(raw.get("domain")) or "unknown",
        "owner": _clean_text(raw.get("owner")) or None,
        "labels": _string_list(raw.get("labels")),
        "parentCapabilityId": _clean_text(raw.get("parentCapabilityId"))
        or _clean_text(raw.get("parent_capability_id"))
        or None,
        "order": _int_range(raw.get("order"), fallback=index + 1, minimum=0, maximum=9999),
        "status": status,
        "reviewState": review_state,
        "evidenceIds": _string_list(raw.get("evidenceIds")),
        "storyCount": _int_range(raw.get("storyCount"), fallback=0, minimum=0, maximum=9999),
        "highDriftCount": _int_range(
            raw.get("highDriftCount"), fallback=0, minimum=0, maximum=9999
        ),
        "confidenceScore": _int_range(
            raw.get("confidenceScore"), fallback=45, minimum=0, maximum=100
        ),
        "driftLevel": drift,
        "driftReason": _clean_text(raw.get("driftReason")) or None,
        "locked": bool(raw.get("locked") is True),
        "generatedAt": _clean_text(raw.get("generatedAt"), _now_iso()),
    }


def _normalize_patch(
    raw: dict[str, Any],
    *,
    application: dict[str, Any],
    generation_session_id: str,
    index: int,
) -> dict[str, Any]:
    operation = _clean_text(raw.get("operation"), "create")
    if operation not in PatchOperations:
        operation = "create"
    return {
        "id": _clean_text(raw.get("id"), f"capability-patch-{index + 1:03d}"),
        "generationSessionId": generation_session_id,
        "applicationId": application["id"],
        "agent": "capability",
        "targetType": "capability",
        "operation": operation,
        "status": "proposed",
        "title": _clean_text(raw.get("title"), f"Capability proposal {index + 1}"),
        "rationale": _clean_text(
            raw.get("rationale"),
            "Capability構造を根拠に基づいて更新します。",
        ),
        "before": _as_dict(raw.get("before")) or None,
        "after": _as_dict(raw.get("after")) or None,
        "affectedIds": _string_list(raw.get("affectedIds")),
        "evidenceIds": _string_list(raw.get("evidenceIds")),
        "createdBy": "agent",
    }


def read_capability_structuring_context(tool_context: Any = None) -> dict[str, Any]:
    """Read application/source context for capability structuring from session state."""
    bucket = _task_bucket(tool_context)
    setup = _setup_from_bucket(bucket)
    payload = _payload_from_bucket(bucket)
    application = _application_from_setup(setup)
    tools = _as_dict(bucket.get("tools"))
    return {
        "ok": True,
        "phase": bucket.get("phase") or "drafting",
        "application": application,
        "generation_session_id": _clean_text(setup.get("generation_session_id")),
        "source_assets": _as_list(payload.get("source_assets")),
        "knowledge_pipeline": _as_dict(payload.get("knowledge_pipeline")),
        "vertex_ai_search": _as_dict(tools.get("vertex_ai_search")),
        "existing_capabilities": _as_list(payload.get("existing_capabilities")),
        "existing_stories": _as_list(payload.get("existing_stories")),
        "user_notes": _clean_text(payload.get("user_notes")) or None,
    }


def build_capability_structure_package(
    *,
    capabilities: list[dict[str, Any]],
    draft_patches: list[dict[str, Any]] | None = None,
    generation_trace: list[str] | None = None,
    application: dict[str, Any] | None = None,
    generation_session_id: str = "",
) -> dict[str, Any]:
    """Normalize a capability structure proposal package."""
    app = _application_from_setup(application or {})
    session_id = generation_session_id or f"generation-{app['id']}"
    normalized_capabilities = [
        _normalize_capability(_as_dict(raw), application=app, index=index)
        for index, raw in enumerate(_as_list(capabilities))
    ]
    normalized_patches = [
        _normalize_patch(
            _as_dict(raw),
            application=app,
            generation_session_id=session_id,
            index=index,
        )
        for index, raw in enumerate(_as_list(draft_patches))
    ]
    if not normalized_patches:
        normalized_patches = [
            _normalize_patch(
                {
                    "operation": "create",
                    "title": f"Create {capability['name']}",
                    "rationale": capability.get("summary") or "Capability候補を追加します。",
                    "after": capability,
                    "affectedIds": [capability["id"]],
                    "evidenceIds": capability.get("evidenceIds") or [],
                },
                application=app,
                generation_session_id=session_id,
                index=index,
            )
            for index, capability in enumerate(normalized_capabilities)
        ]
    return {
        "schemaVersion": "vibe-control-capability-structure-v1",
        "generatedAt": _now_iso(),
        "application": app,
        "generationSessionId": session_id,
        "capabilities": normalized_capabilities,
        "draft_patches": normalized_patches,
        "generation_trace": [
            str(item).strip()
            for item in _as_list(generation_trace)
            if str(item).strip()
        ],
    }


def save_capability_structure(
    capabilities: list[dict[str, Any]],
    draft_patches: list[dict[str, Any]] | None = None,
    generation_trace: list[str] | None = None,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Return a normalized capability proposal JSON artifact."""
    if not capabilities:
        return {"ok": False, "error": "capabilities must contain at least one item"}

    context = read_capability_structuring_context(tool_context)
    package = build_capability_structure_package(
        application=context.get("application"),
        generation_session_id=str(context.get("generation_session_id") or ""),
        capabilities=capabilities,
        draft_patches=draft_patches,
        generation_trace=generation_trace,
    )

    writable = get_writable_state(tool_context)
    if writable is not None and hasattr(writable, "__setitem__"):
        bucket = _task_bucket(tool_context)
        writable["vibe_capability_structuring"] = {
            **bucket,
            "phase": "review",
            "artifact": {
                "schemaVersion": package["schemaVersion"],
                "capabilityCount": len(package["capabilities"]),
                "draftPatchCount": len(package["draft_patches"]),
                "generatedAt": package["generatedAt"],
            },
        }

    return {
        "ok": True,
        "vibe_capability_structuring": {
            "capability_count": len(package["capabilities"]),
            "draft_patch_count": len(package["draft_patches"]),
            "needs_review_count": sum(
                1
                for capability in package["capabilities"]
                if capability.get("reviewState") == "needs_review"
            ),
        },
        "artifacts": [
            {
                "kind": "json_document",
                "title": "VibeControl Capability Structure Draft",
                "body": json.dumps(package, ensure_ascii=False, indent=2),
            }
        ],
    }
