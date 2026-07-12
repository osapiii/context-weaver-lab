"""Tools for StoryVault Story Generation Agent."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from common.tool_state import get_writable_state, read_tool_state  # type: ignore

StoryStatuses = {"discovery", "ready_for_dev", "implemented", "released"}
ReviewStates = {"ready", "needs_review"}
DriftLevels = {"none", "low", "medium", "high"}
EvidenceTypes = {
    "knowledge",
    "ticket",
    "screen",
    "video",
    "journey",
    "code",
    "pr",
    "commit",
    "agent",
}
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


def _string_list(value: Any, *, limit: int = 50) -> list[str]:
    out: list[str] = []
    for item in _as_list(value)[:limit]:
        text = str(item).strip()
        if text:
            out.append(text)
    return out


def _task_bucket(tool_context: Any) -> dict[str, Any]:
    state = read_tool_state(tool_context)
    return _as_dict(state.get("storyvault_story_generation"))


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
            _clean_text(setup.get("applicationName"), "StoryVault Application"),
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


def _capability_from_setup(setup: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    capability = _as_dict(payload.get("capability"))
    has_selected = any(
        _clean_text(value)
        for value in (
            setup.get("capability_id"),
            setup.get("capabilityId"),
            setup.get("capability_key"),
            setup.get("capabilityKey"),
            capability.get("id"),
            capability.get("capabilityKey"),
            capability.get("name"),
        )
    )
    if not has_selected:
        return {
            "id": "",
            "capabilityKey": "",
            "name": "",
            "summary": None,
            "domain": None,
        }
    capability_key = _clean_text(
        setup.get("capability_key"),
        _clean_text(
            setup.get("capabilityKey"),
            _clean_text(capability.get("capabilityKey"), "CAP-001"),
        ),
    ).upper()
    return {
        "id": _clean_text(
            setup.get("capability_id"),
            _clean_text(setup.get("capabilityId"), _clean_text(capability.get("id"))),
        ),
        "capabilityKey": capability_key,
        "name": _clean_text(capability.get("name"), capability_key),
        "summary": _clean_text(capability.get("summary")) or None,
        "domain": _clean_text(capability.get("domain")) or None,
    }


def _normalize_acceptance_criteria(raw: Any, *, story_key: str) -> list[dict[str, Any]]:
    criteria: list[dict[str, Any]] = []
    for index, item in enumerate(_as_list(raw)):
        data = _as_dict(item)
        state = _clean_text(data.get("state"), "unknown")
        if state not in {"covered", "missing", "conflict", "unknown"}:
            state = "unknown"
        criteria.append(
            {
                "id": _clean_text(data.get("id"), f"AC-{story_key}-{index + 1}"),
                "text": _clean_text(
                    data.get("text"),
                    f"{story_key} acceptance criterion {index + 1}",
                ),
                "state": state,
                "evidenceIds": _string_list(data.get("evidenceIds")),
            }
        )
    return criteria


def _normalize_evidence(
    raw: dict[str, Any],
    *,
    application: dict[str, Any],
    capability: dict[str, Any],
    story_key: str,
    index: int,
) -> dict[str, Any]:
    citation = _as_dict(raw.get("citation"))
    evidence_type = _clean_text(raw.get("type"), "agent")
    if evidence_type not in EvidenceTypes:
        evidence_type = "agent"
    excerpt = _clean_text(raw.get("excerpt"), _clean_text(raw.get("title"), ""))
    capability_id = _clean_text(raw.get("capabilityId"), capability.get("id") or "")
    capability_key = _clean_text(
        raw.get("capabilityKey"),
        capability.get("capabilityKey") or "",
    )
    return {
        "id": _clean_text(raw.get("id"), f"ev-{story_key.lower()}-{index + 1}"),
        "applicationId": application["id"],
        "applicationKey": application["applicationKey"],
        "capabilityId": capability_id or None,
        "capabilityKey": capability_key or None,
        "storyId": _clean_text(raw.get("storyId")),
        "storyKey": _clean_text(raw.get("storyKey"), story_key),
        "sourceAssetId": _clean_text(raw.get("sourceAssetId")) or None,
        "type": evidence_type,
        "title": _clean_text(raw.get("title"), f"{story_key} evidence {index + 1}"),
        "excerpt": excerpt,
        "sourceUrl": _clean_text(raw.get("sourceUrl")) or None,
        "gcsPath": _clean_text(raw.get("gcsPath")) or None,
        "fileSpaceDocumentId": _clean_text(raw.get("fileSpaceDocumentId")) or None,
        "repoFullName": _clean_text(raw.get("repoFullName")) or None,
        "pullRequest": _clean_text(raw.get("pullRequest")) or None,
        "commit": _clean_text(raw.get("commit")) or None,
        "path": _clean_text(raw.get("path")) or None,
        "observedUserAction": _clean_text(raw.get("observedUserAction")) or None,
        "observedUiSurface": _clean_text(raw.get("observedUiSurface")) or None,
        "citation": {
            "title": _clean_text(citation.get("title"), _clean_text(raw.get("title"), "Evidence")),
            "uri": _clean_text(citation.get("uri")) or _clean_text(raw.get("sourceUrl")) or None,
            "snippet": _clean_text(citation.get("snippet"), excerpt),
        },
        "freshness": _clean_text(raw.get("freshness"), "unknown")
        if _clean_text(raw.get("freshness"), "unknown") in {"fresh", "stale", "unknown"}
        else "unknown",
        "confidenceImpact": _int_range(
            raw.get("confidenceImpact"), fallback=0, minimum=-100, maximum=100
        ),
    }


def _normalize_story(
    raw: dict[str, Any],
    *,
    application: dict[str, Any],
    capability: dict[str, Any],
    index: int,
) -> dict[str, Any]:
    story_key = _clean_text(
        raw.get("storyKey"),
        _clean_text(raw.get("story_key"), f"{application['applicationKey']}-ST-{index + 1:03d}"),
    ).upper()
    status = _clean_text(raw.get("status"), "discovery")
    if status not in StoryStatuses:
        status = "discovery"
    review_state = _clean_text(raw.get("reviewState"), "needs_review")
    if review_state not in ReviewStates:
        review_state = "needs_review"
    drift = _clean_text(raw.get("driftLevel"), "medium")
    if drift not in DriftLevels:
        drift = "medium"
    evidence_ids = _string_list(raw.get("evidenceIds"))
    criteria = _normalize_acceptance_criteria(
        raw.get("acceptanceCriteria"),
        story_key=story_key,
    )
    capability_id = _clean_text(raw.get("capabilityId"), capability.get("id") or "")
    capability_key = _clean_text(
        raw.get("capabilityKey"),
        capability.get("capabilityKey") or "",
    )
    capability_name = _clean_text(
        raw.get("capabilityName"),
        capability.get("name") or "",
    )
    return {
        "id": _clean_text(raw.get("id"), f"story-{story_key.lower()}"),
        "applicationId": application["id"],
        "applicationKey": application["applicationKey"],
        "capabilityId": capability_id or None,
        "capabilityKey": capability_key or None,
        "capabilityName": capability_name or None,
        "sequence": _int_range(raw.get("sequence"), fallback=index + 1, minimum=0, maximum=9999),
        "storyKey": story_key,
        "title": _clean_text(raw.get("title"), f"{story_key} user story"),
        "summary": _clean_text(raw.get("summary"), "根拠付きユーザーストーリー候補"),
        "userStory": _clean_text(raw.get("userStory"), _clean_text(raw.get("summary"))),
        "status": status,
        "reviewState": review_state,
        "domain": _clean_text(raw.get("domain"), capability.get("domain") or "unknown"),
        "milestone": _clean_text(raw.get("milestone"), "mvp"),
        "labels": _string_list(raw.get("labels")),
        "confidenceScore": _int_range(
            raw.get("confidenceScore"), fallback=45, minimum=0, maximum=100
        ),
        "driftLevel": drift,
        "driftReason": _clean_text(raw.get("driftReason")) or None,
        "sourceFreshness": _as_dict(raw.get("sourceFreshness"))
        or {
            "knowledgeCheckedAt": _now_iso(),
            "githubCheckedAt": None,
            "staleSources": [],
        },
        "acceptanceCriteria": criteria,
        "detailedSpecifications": _string_list(raw.get("detailedSpecifications")),
        "evidenceIds": evidence_ids,
        "codeRefs": _as_list(raw.get("codeRefs")),
        "generationTrace": _as_list(raw.get("generationTrace")),
        "fileSpaceId": application.get("fileSpaceId"),
        "repoFullName": application.get("repoFullName"),
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
        "id": _clean_text(raw.get("id"), f"story-patch-{index + 1:03d}"),
        "generationSessionId": generation_session_id,
        "applicationId": application["id"],
        "agent": "story",
        "targetType": "story",
        "operation": operation,
        "status": "proposed",
        "title": _clean_text(raw.get("title"), f"Story proposal {index + 1}"),
        "rationale": _clean_text(
            raw.get("rationale"),
            "Story案を根拠に基づいて更新します。",
        ),
        "before": _as_dict(raw.get("before")) or None,
        "after": _as_dict(raw.get("after")) or None,
        "affectedIds": _string_list(raw.get("affectedIds")),
        "evidenceIds": _string_list(raw.get("evidenceIds")),
        "createdBy": "agent",
    }


def read_story_generation_context(tool_context: Any = None) -> dict[str, Any]:
    """Read application/capability context for story generation from session state."""
    bucket = _task_bucket(tool_context)
    setup = _setup_from_bucket(bucket)
    payload = _payload_from_bucket(bucket)
    tools = _as_dict(bucket.get("tools"))
    application = _application_from_setup(setup)
    capability = _capability_from_setup(setup, payload)
    return {
        "ok": True,
        "phase": bucket.get("phase") or "drafting",
        "application": application,
        "capability": capability,
        "generation_session_id": _clean_text(setup.get("generation_session_id")),
        "source_assets": _as_list(payload.get("source_assets")),
        "knowledge_pipeline": _as_dict(payload.get("knowledge_pipeline")),
        "vertex_ai_search": _as_dict(tools.get("vertex_ai_search")),
        "existing_capabilities": _as_list(payload.get("existing_capabilities")),
        "existing_stories": _as_list(payload.get("existing_stories")),
        "existing_evidence": _as_list(payload.get("existing_evidence")),
        "user_notes": _clean_text(payload.get("user_notes")) or None,
    }


def build_story_generation_package(
    *,
    stories: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
    draft_patches: list[dict[str, Any]] | None = None,
    generation_trace: list[str] | None = None,
    application: dict[str, Any] | None = None,
    capability: dict[str, Any] | None = None,
    generation_session_id: str = "",
) -> dict[str, Any]:
    """Normalize a capability-scoped story generation package."""
    app = _application_from_setup(application or {})
    cap = _capability_from_setup(capability or {}, {"capability": capability or {}})
    session_id = generation_session_id or f"generation-{app['id']}"
    normalized_stories = [
        _normalize_story(_as_dict(raw), application=app, capability=cap, index=index)
        for index, raw in enumerate(_as_list(stories))
    ]
    evidence_by_story: dict[str, list[dict[str, Any]]] = {}
    normalized_evidence: list[dict[str, Any]] = []
    for index, raw in enumerate(_as_list(evidence)):
        story_key = _clean_text(raw.get("storyKey"))
        if not story_key and normalized_stories:
            story_key = normalized_stories[min(index, len(normalized_stories) - 1)]["storyKey"]
        item = _normalize_evidence(
            _as_dict(raw),
            application=app,
            capability=cap,
            story_key=story_key or f"{app['applicationKey']}-ST",
            index=index,
        )
        normalized_evidence.append(item)
        evidence_by_story.setdefault(item["storyKey"], []).append(item)
    for story in normalized_stories:
        if not story["evidenceIds"]:
            story["evidenceIds"] = [
                item["id"] for item in evidence_by_story.get(story["storyKey"], [])
            ]
        if not story["evidenceIds"] or story["confidenceScore"] < 70:
            story["reviewState"] = "needs_review"
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
                    "title": f"Create {story['storyKey']} {story['title']}",
                    "rationale": story.get("summary") or "Story候補を追加します。",
                    "after": story,
                    "affectedIds": [story["id"]],
                    "evidenceIds": story.get("evidenceIds") or [],
                },
                application=app,
                generation_session_id=session_id,
                index=index,
            )
            for index, story in enumerate(normalized_stories)
        ]
    return {
        "schemaVersion": "storyvault-story-generation-v1",
        "generatedAt": _now_iso(),
        "application": app,
        "capability": cap,
        "generationSessionId": session_id,
        "stories": normalized_stories,
        "evidence": normalized_evidence,
        "draft_patches": normalized_patches,
        "generation_trace": [
            str(item).strip()
            for item in _as_list(generation_trace)
            if str(item).strip()
        ],
    }


def save_story_generation(
    stories: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
    draft_patches: list[dict[str, Any]] | None = None,
    generation_trace: list[str] | None = None,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Return a normalized story proposal JSON artifact."""
    if not stories:
        return {"ok": False, "error": "stories must contain at least one item"}
    if not evidence:
        return {"ok": False, "error": "evidence must contain at least one item"}

    context = read_story_generation_context(tool_context)
    package = build_story_generation_package(
        application=context.get("application"),
        capability=context.get("capability"),
        generation_session_id=str(context.get("generation_session_id") or ""),
        stories=stories,
        evidence=evidence,
        draft_patches=draft_patches,
        generation_trace=generation_trace,
    )

    writable = get_writable_state(tool_context)
    if writable is not None and hasattr(writable, "__setitem__"):
        bucket = _task_bucket(tool_context)
        writable["storyvault_story_generation"] = {
            **bucket,
            "phase": "review",
            "artifact": {
                "schemaVersion": package["schemaVersion"],
                "storyCount": len(package["stories"]),
                "evidenceCount": len(package["evidence"]),
                "draftPatchCount": len(package["draft_patches"]),
                "generatedAt": package["generatedAt"],
            },
        }

    return {
        "ok": True,
        "storyvault_story_generation": {
            "story_count": len(package["stories"]),
            "evidence_count": len(package["evidence"]),
            "draft_patch_count": len(package["draft_patches"]),
            "needs_review_count": sum(
                1
                for story in package["stories"]
                if story.get("reviewState") == "needs_review"
            ),
        },
        "artifacts": [
            {
                "kind": "json_document",
                "title": "StoryVault Story Generation Draft",
                "body": json.dumps(package, ensure_ascii=False, indent=2),
            }
        ],
    }
