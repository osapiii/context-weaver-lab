"""StoryVault tools for building user-story SSOT packages."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from common.tool_state import read_tool_state  # type: ignore

StoryStatus = {"discovery", "ready_for_dev", "implemented", "released"}
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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _clean_text(value: Any, fallback: str = "") -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _bounded_score(value: Any, fallback: int = 35) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(0, min(100, numeric))


def _bounded_impact(value: Any, fallback: int = 0) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(-100, min(100, numeric))


def _normalize_application(raw: dict[str, Any], *, index: int) -> dict[str, Any]:
    application_key = _clean_text(
        raw.get("applicationKey"), _clean_text(raw.get("application_key"), f"APP-{index + 1}")
    ).upper()
    application_id = _clean_text(
        raw.get("id"),
        _clean_text(raw.get("applicationId"), f"app-{application_key.lower()}"),
    )
    return {
        "id": application_id,
        "applicationKey": application_key,
        "name": _clean_text(raw.get("name"), _clean_text(raw.get("title"), application_key)),
        "summary": _clean_text(raw.get("summary")) or None,
        "domain": _clean_text(raw.get("domain")) or None,
        "owner": _clean_text(raw.get("owner")) or None,
        "labels": [
            str(value).strip()
            for value in _as_list(raw.get("labels"))
            if str(value).strip()
        ],
        "fileSpaceId": _clean_text(raw.get("fileSpaceId"), _clean_text(raw.get("file_space_id"))) or None,
        "repoFullName": _clean_text(raw.get("repoFullName"), _clean_text(raw.get("repo_full_name"))) or None,
        "defaultBranch": _clean_text(raw.get("defaultBranch"), _clean_text(raw.get("default_branch"))) or None,
        "storyCount": _bounded_score(raw.get("storyCount"), 0),
        "highDriftCount": _bounded_score(raw.get("highDriftCount"), 0),
        "lastGeneratedAt": _clean_text(raw.get("lastGeneratedAt"), _now_iso()),
    }


def _infer_default_application(
    stories: list[dict[str, Any]], source_connections: list[dict[str, Any]] | None
) -> dict[str, Any]:
    first_story = _as_dict(stories[0]) if stories else {}
    first_source = _as_dict(_as_list(source_connections)[0]) if source_connections else {}
    return _normalize_application(
        {
            "id": _clean_text(first_story.get("applicationId"), "app-default"),
            "applicationKey": _clean_text(first_story.get("applicationKey"), "APP"),
            "name": _clean_text(first_story.get("applicationName"), "StoryVault Application"),
            "domain": _clean_text(first_story.get("domain")) or None,
            "fileSpaceId": _clean_text(first_story.get("fileSpaceId"))
            or _clean_text(first_source.get("fileSpaceId")),
            "repoFullName": _clean_text(first_story.get("repoFullName"))
            or _clean_text(first_source.get("repoFullName")),
            "defaultBranch": _clean_text(first_source.get("defaultBranch"), "main"),
        },
        index=0,
    )


def _application_ref(
    raw: dict[str, Any],
    default_application: dict[str, Any],
    applications_by_id: dict[str, dict[str, Any]] | None = None,
    applications_by_key: dict[str, dict[str, Any]] | None = None,
) -> tuple[str, str]:
    application_id = _clean_text(raw.get("applicationId"))
    application_key = _clean_text(raw.get("applicationKey")).upper()
    if application_id and applications_by_id and application_id in applications_by_id:
        application = applications_by_id[application_id]
        return application["id"], application["applicationKey"]
    if application_key and applications_by_key and application_key in applications_by_key:
        application = applications_by_key[application_key]
        return application["id"], application["applicationKey"]
    application_id = application_id or default_application["id"]
    application_key = application_key or default_application["applicationKey"]
    return application_id, application_key


def _normalize_evidence(
    raw: dict[str, Any],
    *,
    index: int,
    story_key: str,
    default_application: dict[str, Any],
    applications_by_id: dict[str, dict[str, Any]],
    applications_by_key: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    citation = _as_dict(raw.get("citation"))
    evidence_type = _clean_text(raw.get("type"), "agent")
    if evidence_type not in EvidenceTypes:
        evidence_type = "agent"
    evidence_id = _clean_text(raw.get("id"), f"ev-{story_key.lower()}-{index + 1}")
    title = _clean_text(raw.get("title"), f"{story_key} evidence {index + 1}")
    excerpt = _clean_text(raw.get("excerpt"), title)
    snippet = _clean_text(citation.get("snippet"), excerpt)
    application_id, application_key = _application_ref(
        raw,
        default_application,
        applications_by_id=applications_by_id,
        applications_by_key=applications_by_key,
    )
    return {
        "id": evidence_id,
        "applicationId": application_id,
        "applicationKey": application_key,
        "capabilityId": _clean_text(raw.get("capabilityId")) or None,
        "capabilityKey": _clean_text(raw.get("capabilityKey")) or None,
        "storyId": _clean_text(raw.get("storyId")),
        "storyKey": _clean_text(raw.get("storyKey"), story_key),
        "sourceAssetId": _clean_text(raw.get("sourceAssetId")) or None,
        "type": evidence_type,
        "title": title,
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
            "title": _clean_text(citation.get("title"), title),
            "uri": _clean_text(citation.get("uri")) or _clean_text(raw.get("sourceUrl")) or None,
            "snippet": snippet,
        },
        "freshness": _clean_text(raw.get("freshness"), "unknown")
        if _clean_text(raw.get("freshness"), "unknown") in {"fresh", "stale", "unknown"}
        else "unknown",
        "confidenceImpact": _bounded_impact(raw.get("confidenceImpact"), 0),
    }


def _normalize_acceptance_criteria(raw: Any, *, story_key: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for index, item in enumerate(_as_list(raw)):
        data = _as_dict(item)
        state = _clean_text(data.get("state"), "unknown")
        if state not in {"covered", "missing", "conflict", "unknown"}:
            state = "unknown"
        out.append(
            {
                "id": _clean_text(data.get("id"), f"AC-{story_key}-{index + 1}"),
                "text": _clean_text(data.get("text"), f"{story_key} acceptance criterion {index + 1}"),
                "state": state,
                "evidenceIds": [
                    str(value).strip()
                    for value in _as_list(data.get("evidenceIds"))
                    if str(value).strip()
                ],
            }
        )
    return out


def _coverage_score(story: dict[str, Any], evidence_count: int) -> int:
    ac = _as_list(story.get("acceptanceCriteria"))
    if not ac:
        return min(45, _bounded_score(story.get("confidenceScore"), 35))
    covered = sum(1 for item in ac if _as_dict(item).get("state") == "covered")
    conflicts = sum(1 for item in ac if _as_dict(item).get("state") == "conflict")
    missing = sum(1 for item in ac if _as_dict(item).get("state") == "missing")
    score = 45 + round((covered / len(ac)) * 35)
    score += min(evidence_count, 4) * 5
    score -= conflicts * 12
    score -= missing * 8
    return max(5, min(100, score))


def build_story_ssot_package(
    *,
    applications: list[dict[str, Any]] | None = None,
    stories: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
    source_connections: list[dict[str, Any]] | None = None,
    generation_trace: list[str] | None = None,
) -> dict[str, Any]:
    """Normalize and score a StoryVault SSOT package."""
    raw_applications = _as_list(applications)
    normalized_applications = [
        _normalize_application(_as_dict(raw), index=index)
        for index, raw in enumerate(raw_applications)
    ]
    if not normalized_applications:
        normalized_applications = [_infer_default_application(stories, source_connections)]
    default_application = normalized_applications[0]
    applications_by_id = {
        application["id"]: application for application in normalized_applications
    }
    applications_by_key = {
        application["applicationKey"]: application for application in normalized_applications
    }

    normalized_evidence: list[dict[str, Any]] = []
    for index, raw in enumerate(evidence):
        story_key = _clean_text(raw.get("storyKey"), "ST")
        normalized_evidence.append(
            _normalize_evidence(
                raw,
                index=index,
                story_key=story_key,
                default_application=default_application,
                applications_by_id=applications_by_id,
                applications_by_key=applications_by_key,
            )
        )

    evidence_by_story_key: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for item in normalized_evidence:
        evidence_by_story_key.setdefault((item["applicationId"], item["storyKey"]), []).append(item)

    normalized_stories: list[dict[str, Any]] = []
    for index, raw in enumerate(stories):
        story_key = _clean_text(raw.get("storyKey"), f"ST-{index + 1:03d}")
        application_id, application_key = _application_ref(
            raw,
            default_application,
            applications_by_id=applications_by_id,
            applications_by_key=applications_by_key,
        )
        status = _clean_text(raw.get("status"), "discovery")
        if status not in StoryStatus:
            status = "discovery"
        drift = _clean_text(raw.get("driftLevel"), "medium")
        if drift not in DriftLevels:
            drift = "medium"
        story_evidence = evidence_by_story_key.get((application_id, story_key), [])
        evidence_ids = [
            str(value).strip()
            for value in (_as_list(raw.get("evidenceIds")) or [item["id"] for item in story_evidence])
            if str(value).strip()
        ]
        story = {
            "id": _clean_text(raw.get("id"), f"story-{story_key.lower()}"),
            "applicationId": application_id,
            "applicationKey": application_key,
            "capabilityId": _clean_text(raw.get("capabilityId")) or None,
            "capabilityKey": _clean_text(raw.get("capabilityKey")) or None,
            "capabilityName": _clean_text(raw.get("capabilityName")) or None,
            "sequence": _bounded_score(raw.get("sequence"), index + 1),
            "storyKey": story_key,
            "title": _clean_text(raw.get("title"), f"{story_key} user story"),
            "summary": _clean_text(raw.get("summary"), "根拠付きユーザーストーリー候補"),
            "userStory": _clean_text(raw.get("userStory"), _clean_text(raw.get("summary"))),
            "status": status,
            "reviewState": _clean_text(raw.get("reviewState"), "ready"),
            "domain": _clean_text(raw.get("domain"), "unknown"),
            "milestone": _clean_text(raw.get("milestone"), "mvp"),
            "labels": [
                str(value).strip()
                for value in _as_list(raw.get("labels"))
                if str(value).strip()
            ],
            "driftLevel": drift,
            "driftReason": _clean_text(raw.get("driftReason")) or None,
            "sourceFreshness": _as_dict(raw.get("sourceFreshness"))
            or {
                "knowledgeCheckedAt": _now_iso(),
                "githubCheckedAt": None,
                "staleSources": [],
            },
            "acceptanceCriteria": _normalize_acceptance_criteria(
                raw.get("acceptanceCriteria"), story_key=story_key
            ),
            "detailedSpecifications": [
                str(value).strip()
                for value in _as_list(raw.get("detailedSpecifications"))
                if str(value).strip()
            ],
            "evidenceIds": evidence_ids,
            "codeRefs": _as_list(raw.get("codeRefs")),
            "generationTrace": _as_list(raw.get("generationTrace")),
            "fileSpaceId": _clean_text(raw.get("fileSpaceId")) or None,
            "repoFullName": _clean_text(raw.get("repoFullName")) or None,
            "generatedAt": _clean_text(raw.get("generatedAt"), _now_iso()),
        }
        score = _coverage_score(story, len(story_evidence))
        explicit_score = raw.get("confidenceScore")
        if explicit_score is not None:
            score = min(score, _bounded_score(explicit_score))
        story["confidenceScore"] = score
        if not story_evidence or score < 70:
            story["reviewState"] = "needs_review"
        if story["reviewState"] not in {"ready", "needs_review"}:
            story["reviewState"] = "needs_review"
        normalized_stories.append(story)

    for application in normalized_applications:
        app_stories = [
            story
            for story in normalized_stories
            if story.get("applicationId") == application["id"]
        ]
        application["storyCount"] = len(app_stories)
        application["highDriftCount"] = sum(
            1 for story in app_stories if story.get("driftLevel") == "high"
        )
        application["lastGeneratedAt"] = _now_iso()

    normalized_source_connections: list[dict[str, Any]] = []
    for raw in _as_list(source_connections):
        data = _as_dict(raw)
        application_id, application_key = _application_ref(
            data,
            default_application,
            applications_by_id=applications_by_id,
            applications_by_key=applications_by_key,
        )
        normalized_source_connections.append(
            {
                **data,
                "applicationId": application_id,
                "applicationKey": application_key,
            }
        )

    return {
        "schemaVersion": "storyvault-application-ssot-v1",
        "generatedAt": _now_iso(),
        "applications": normalized_applications,
        "stories": normalized_stories,
        "evidence": normalized_evidence,
        "source_connections": normalized_source_connections,
        "generation_trace": [
            str(item).strip()
            for item in _as_list(generation_trace)
            if str(item).strip()
        ],
    }


def read_storyvault_sources(tool_context: Any = None) -> dict[str, Any]:
    """Read StoryVault source setup from ADK session state."""
    state = read_tool_state(tool_context)
    bucket = _as_dict(state.get("storyvault"))
    setup = _as_dict(bucket.get("setup"))
    return {
        "ok": True,
        "application_id": _clean_text(setup.get("application_id")),
        "application_key": _clean_text(setup.get("application_key"), "APP"),
        "application_name": _clean_text(setup.get("application_name")),
        "file_space_id": _clean_text(state.get("file_space_id"))
        or _clean_text(setup.get("file_space_id")),
        "repo_full_name": _clean_text(setup.get("repo_full_name")),
        "default_branch": _clean_text(setup.get("default_branch"), "main"),
        "agent_search_datastore_path": _clean_text(state.get("agent_search_datastore_path")),
    }


def save_user_story_ssot(
    stories: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
    source_connections: list[dict[str, Any]] | None = None,
    generation_trace: list[str] | None = None,
    applications: list[dict[str, Any]] | None = None,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Return a validated application-scoped user-story SSOT package as a JSON artifact."""
    if not stories:
        return {"ok": False, "error": "stories must contain at least one item"}
    if not evidence:
        return {"ok": False, "error": "evidence must contain at least one item"}

    package = build_story_ssot_package(
        applications=applications,
        stories=stories,
        evidence=evidence,
        source_connections=source_connections,
        generation_trace=generation_trace,
    )
    body = json.dumps(package, ensure_ascii=False, indent=2)
    return {
        "ok": True,
        "storyvault": {
            "application_count": len(package["applications"]),
            "story_count": len(package["stories"]),
            "evidence_count": len(package["evidence"]),
            "needs_review_count": sum(
                1
                for story in package["stories"]
                if story.get("reviewState") == "needs_review"
            ),
        },
        "artifacts": [
            {
                "kind": "json_document",
                "title": "StoryVault Application Story SSOT",
                "body": body,
            }
        ],
    }
