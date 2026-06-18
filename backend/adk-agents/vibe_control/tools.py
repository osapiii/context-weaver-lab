"""VibeControl tools for building user-story SSOT packages."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from common.tool_state import read_tool_state  # type: ignore

StoryStatus = {"discovery", "ready_for_dev", "implemented", "released"}
DriftLevels = {"none", "low", "medium", "high"}
EvidenceTypes = {"knowledge", "ticket", "code", "pr", "commit", "agent"}


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


def _normalize_evidence(
    raw: dict[str, Any], *, index: int, story_key: str
) -> dict[str, Any]:
    citation = _as_dict(raw.get("citation"))
    evidence_type = _clean_text(raw.get("type"), "agent")
    if evidence_type not in EvidenceTypes:
        evidence_type = "agent"
    evidence_id = _clean_text(raw.get("id"), f"ev-{story_key.lower()}-{index + 1}")
    title = _clean_text(raw.get("title"), f"{story_key} evidence {index + 1}")
    excerpt = _clean_text(raw.get("excerpt"), title)
    snippet = _clean_text(citation.get("snippet"), excerpt)
    return {
        "id": evidence_id,
        "storyId": _clean_text(raw.get("storyId")),
        "storyKey": _clean_text(raw.get("storyKey"), story_key),
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
    stories: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
    source_connections: list[dict[str, Any]] | None = None,
    generation_trace: list[str] | None = None,
) -> dict[str, Any]:
    """Normalize and score a VibeControl SSOT package."""
    normalized_evidence: list[dict[str, Any]] = []
    for index, raw in enumerate(evidence):
        story_key = _clean_text(raw.get("storyKey"), "ST")
        normalized_evidence.append(_normalize_evidence(raw, index=index, story_key=story_key))

    evidence_by_story_key: dict[str, list[dict[str, Any]]] = {}
    for item in normalized_evidence:
        evidence_by_story_key.setdefault(item["storyKey"], []).append(item)

    normalized_stories: list[dict[str, Any]] = []
    for index, raw in enumerate(stories):
        story_key = _clean_text(raw.get("storyKey"), f"ST-{index + 1:03d}")
        status = _clean_text(raw.get("status"), "discovery")
        if status not in StoryStatus:
            status = "discovery"
        drift = _clean_text(raw.get("driftLevel"), "medium")
        if drift not in DriftLevels:
            drift = "medium"
        story_evidence = evidence_by_story_key.get(story_key, [])
        evidence_ids = [
            str(value).strip()
            for value in (_as_list(raw.get("evidenceIds")) or [item["id"] for item in story_evidence])
            if str(value).strip()
        ]
        story = {
            "id": _clean_text(raw.get("id"), f"story-{story_key.lower()}"),
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

    return {
        "schemaVersion": "vibe-control-ssot-v1",
        "generatedAt": _now_iso(),
        "stories": normalized_stories,
        "evidence": normalized_evidence,
        "source_connections": _as_list(source_connections),
        "generation_trace": [
            str(item).strip()
            for item in _as_list(generation_trace)
            if str(item).strip()
        ],
    }


def read_vibe_control_sources(tool_context: Any = None) -> dict[str, Any]:
    """Read VibeControl source setup from ADK session state."""
    state = read_tool_state(tool_context)
    bucket = _as_dict(state.get("vibe_control"))
    setup = _as_dict(bucket.get("setup"))
    return {
        "ok": True,
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
    tool_context: Any = None,
) -> dict[str, Any]:
    """Return a validated user-story SSOT package as a JSON artifact."""
    if not stories:
        return {"ok": False, "error": "stories must contain at least one item"}
    if not evidence:
        return {"ok": False, "error": "evidence must contain at least one item"}

    package = build_story_ssot_package(
        stories=stories,
        evidence=evidence,
        source_connections=source_connections,
        generation_trace=generation_trace,
    )
    body = json.dumps(package, ensure_ascii=False, indent=2)
    return {
        "ok": True,
        "vibe_control": {
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
                "title": "VibeControl User Story SSOT",
                "body": body,
            }
        ],
    }
