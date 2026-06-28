"""Tools for VibeControl Related Context Agent."""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

import requests
from cryptography.fernet import Fernet, InvalidToken
from google.cloud import firestore

from common.tool_state import read_tool_state  # type: ignore

GITHUB_API = "https://api.github.com"
SLACK_API = "https://slack.com/api"
MAX_CANDIDATES = 50


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


def _task_bucket(tool_context: Any) -> dict[str, Any]:
    state = read_tool_state(tool_context)
    return _as_dict(state.get("vibe_related_context"))


def _setup_from_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(bucket.get("setup"))


def _payload_from_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(bucket.get("payload"))


def _fernet() -> Fernet | None:
    raw = os.getenv("GITHUB_TOKEN_ENCRYPTION_KEY", "").strip()
    if not raw:
        return None
    try:
        return Fernet(raw.encode("utf-8"))
    except Exception:
        return None


def unprotect_github_token(payload: Any) -> str:
    """Decode GitHub token saved by backend/app/triggers/github_oauth.py."""
    if isinstance(payload, str):
        return payload
    if not isinstance(payload, dict):
        return ""
    value = str(payload.get("value") or "")
    if payload.get("mode") != "fernet":
        return value
    f = _fernet()
    if not f:
        raise RuntimeError("GITHUB_TOKEN_ENCRYPTION_KEY is required")
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Stored GitHub token cannot be decrypted") from exc


def _github_headers(access_token: str) -> dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {access_token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _github_get(
    access_token: str,
    path: str,
    params: dict[str, Any] | None = None,
) -> Any:
    resp = requests.get(
        f"{GITHUB_API}{path}",
        headers=_github_headers(access_token),
        params=params,
        timeout=30,
    )
    if resp.status_code >= 400:
        try:
            message = str(resp.json().get("message") or "")
        except Exception:
            message = resp.text[:300]
        raise RuntimeError(message or f"GitHub API failed: {resp.status_code}")
    return resp.json()


def _access_token_for_user(organization_id: str, user_id: str) -> str:
    db = firestore.Client()
    snap = (
        db.collection("organizations")
        .document(organization_id)
        .collection("externalServiceConfigs")
        .document("githubOAuth")
        .collection("users")
        .document(user_id)
        .get()
    )
    if not snap.exists:
        raise RuntimeError("GitHub が未接続です。GitHub アカウントを接続してください。")
    token = unprotect_github_token((snap.to_dict() or {}).get("accessToken"))
    if not token:
        raise RuntimeError("GitHub token is missing. Reconnect GitHub.")
    return token


def _slack_fernet() -> Fernet | None:
    raw = (
        os.getenv("SLACK_TOKEN_ENCRYPTION_KEY", "").strip()
        or os.getenv("GITHUB_TOKEN_ENCRYPTION_KEY", "").strip()
    )
    if not raw:
        return None
    try:
        return Fernet(raw.encode("utf-8"))
    except Exception:
        return None


def unprotect_slack_token(payload: Any) -> str:
    """Decode Slack token saved by backend/app/triggers/slack_oauth.py."""
    if isinstance(payload, str):
        return payload
    if not isinstance(payload, dict):
        return ""
    value = str(payload.get("value") or "")
    if payload.get("mode") != "fernet":
        return value
    f = _slack_fernet()
    if not f:
        raise RuntimeError("SLACK_TOKEN_ENCRYPTION_KEY is required")
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Stored Slack token cannot be decrypted") from exc


def _slack_access_token_for_user(organization_id: str, user_id: str) -> tuple[str, dict[str, Any]]:
    db = firestore.Client()
    snap = (
        db.collection("organizations")
        .document(organization_id)
        .collection("externalServiceConfigs")
        .document("slackOAuth")
        .collection("users")
        .document(user_id)
        .get()
    )
    if not snap.exists:
        raise RuntimeError("Slack が未接続です。Slack ワークスペースを接続してください。")
    doc = snap.to_dict() or {}
    token = unprotect_slack_token(doc.get("accessToken"))
    if not token:
        raise RuntimeError("Slack token is missing. Reconnect Slack.")
    return token, doc


def _slack_get(
    access_token: str,
    path: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resp = requests.get(
        f"{SLACK_API}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
        timeout=30,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Slack API failed: {resp.status_code} {resp.text[:200]}")
    payload = resp.json()
    if not payload.get("ok"):
        raise RuntimeError(str(payload.get("error") or "Slack API failed"))
    return payload


def _file_names(files: Any) -> list[str]:
    out: list[str] = []
    for item in _as_list(files)[:30]:
        if isinstance(item, dict):
            name = _clean_text(item.get("filename"))
            if name:
                out.append(name)
    return out


def normalize_pull_request(pr: dict[str, Any], files: list[str] | None = None) -> dict[str, Any]:
    return {
        "number": pr.get("number") or 0,
        "title": pr.get("title") or "",
        "htmlUrl": pr.get("html_url") or "",
        "author": _as_dict(pr.get("user")).get("login") or "",
        "state": "merged" if pr.get("merged_at") else (pr.get("state") or ""),
        "mergedAt": pr.get("merged_at") or "",
        "createdAt": pr.get("created_at") or "",
        "updatedAt": pr.get("updated_at") or "",
        "baseBranch": _as_dict(pr.get("base")).get("ref") or "",
        "headBranch": _as_dict(pr.get("head")).get("ref") or "",
        "labels": [
            str(label.get("name") or "")
            for label in _as_list(pr.get("labels"))
            if isinstance(label, dict) and label.get("name")
        ],
        "changedFiles": pr.get("changed_files"),
        "additions": pr.get("additions"),
        "deletions": pr.get("deletions"),
        "bodySummary": _clean_text(pr.get("body"))[:1200],
        "files": files or [],
    }


def _list_recent_pull_requests(access_token: str, repo: str) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    seen: set[int] = set()
    for state in ("open", "closed"):
        for page in range(1, 3):
            payload = _github_get(
                access_token,
                f"/repos/{repo}/pulls",
                {
                    "state": state,
                    "sort": "updated",
                    "direction": "desc",
                    "per_page": 30,
                    "page": page,
                },
            )
            if not isinstance(payload, list) or not payload:
                break
            for item in payload:
                number = item.get("number")
                if not isinstance(number, int) or number in seen:
                    continue
                seen.add(number)
                detail = _github_get(access_token, f"/repos/{repo}/pulls/{number}")
                files_payload = _github_get(
                    access_token,
                    f"/repos/{repo}/pulls/{number}/files",
                    {"per_page": 30},
                )
                collected.append(
                    normalize_pull_request(detail, files=_file_names(files_payload))
                )
                if len(collected) >= MAX_CANDIDATES:
                    return collected
            if len(payload) < 30:
                break
    return collected


def read_related_context_request(tool_context: Any = None) -> dict[str, Any]:
    """Read related context request from session state."""
    bucket = _task_bucket(tool_context)
    setup = _setup_from_bucket(bucket)
    payload = _payload_from_bucket(bucket)
    application = _as_dict(payload.get("application"))
    operation_video = _as_dict(payload.get("operation_video"))
    analysis_result = _as_dict(payload.get("analysis_result"))
    repo = _clean_text(
        setup.get("repo_full_name"),
        _clean_text(application.get("repoFullName")),
    )
    return {
        "ok": True,
        "provider": _clean_text(setup.get("provider"), "github"),
        "organizationId": _clean_text(setup.get("organization_id")),
        "spaceId": _clean_text(setup.get("space_id")),
        "userId": _clean_text(setup.get("user_id")),
        "application": application,
        "operationVideo": operation_video,
        "analysisResult": analysis_result,
        "repoFullName": repo,
        "slackQuery": _clean_text(setup.get("slack_query")),
        "defaultBranch": _clean_text(
            setup.get("default_branch"),
            _clean_text(application.get("defaultBranch"), "main"),
        ),
        "expectedOutputs": _as_list(payload.get("expected_outputs")),
    }


def _extract_keywords(context: dict[str, Any]) -> list[str]:
    pieces: list[str] = []
    operation_video = _as_dict(context.get("operationVideo"))
    analysis_result = _as_dict(context.get("analysisResult"))
    quick_scan = _as_dict(operation_video.get("quickScan"))
    for value in (
        operation_video.get("title"),
        operation_video.get("description"),
        operation_video.get("transcriptSummary"),
        quick_scan.get("title"),
        quick_scan.get("description"),
        quick_scan.get("operationMemo"),
        quick_scan.get("transcriptSummary"),
        analysis_result.get("operationIntent"),
        analysis_result.get("transcriptSummary"),
        analysis_result.get("productContextSummary"),
    ):
        if isinstance(value, str):
            pieces.append(value)
    for step in _as_list(quick_scan.get("operationSteps")):
        if isinstance(step, str):
            pieces.append(step)
    for story in _as_list(analysis_result.get("storyCandidates")):
        if isinstance(story, dict):
            for key in ("title", "goal", "benefit"):
                if isinstance(story.get(key), str):
                    pieces.append(story[key])
    text = " ".join(pieces)
    candidates = re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}|[一-龥ぁ-んァ-ンー]{2,}", text)
    stopwords = {
        "する",
        "できる",
        "ため",
        "こと",
        "よう",
        "ます",
        "です",
        "AI",
    }
    out: list[str] = []
    seen: set[str] = set()
    for word in candidates:
        cleaned = word.strip()
        key = cleaned.lower()
        if key in seen or cleaned in stopwords:
            continue
        seen.add(key)
        out.append(cleaned)
        if len(out) >= 8:
            break
    return out


def _slack_permalink(access_token: str, channel_id: str, message_ts: str) -> str:
    try:
        payload = _slack_get(
            access_token,
            "/chat.getPermalink",
            {"channel": channel_id, "message_ts": message_ts},
        )
        return str(payload.get("permalink") or "")
    except Exception:
        return ""


def normalize_slack_message(
    item: dict[str, Any],
    *,
    access_token: str = "",
    default_channel_name: str = "",
) -> dict[str, Any]:
    channel = _as_dict(item.get("channel"))
    channel_id = _clean_text(
        item.get("channel_id"),
        _clean_text(channel.get("id"), _clean_text(item.get("channel"))),
    )
    channel_name = _clean_text(
        item.get("channel_name"),
        _clean_text(channel.get("name"), default_channel_name),
    )
    message_ts = _clean_text(item.get("ts"))
    permalink = _clean_text(item.get("permalink"))
    if access_token and channel_id and message_ts and not permalink:
        permalink = _slack_permalink(access_token, channel_id, message_ts)
    return {
        "channelId": channel_id,
        "channelName": channel_name,
        "messageTs": message_ts,
        "threadTs": _clean_text(item.get("thread_ts")),
        "permalink": permalink,
        "author": _clean_text(item.get("user"), _clean_text(item.get("username"))),
        "text": _clean_text(item.get("text"))[:1600],
        "postedAt": message_ts,
    }


def _search_slack_messages(
    access_token: str,
    query: str,
    limit: int,
) -> list[dict[str, Any]]:
    payload = _slack_get(
        access_token,
        "/search.messages",
        {
            "query": query,
            "sort": "timestamp",
            "sort_dir": "desc",
            "count": min(limit, 20),
        },
    )
    matches = _as_dict(payload.get("messages")).get("matches") or []
    out: list[dict[str, Any]] = []
    for item in _as_list(matches):
        if isinstance(item, dict):
            out.append(normalize_slack_message(item, access_token=access_token))
    return out


def _recent_slack_messages(access_token: str, limit: int) -> list[dict[str, Any]]:
    payload = _slack_get(
        access_token,
        "/conversations.list",
        {
            "types": "public_channel,private_channel",
            "exclude_archived": True,
            "limit": 20,
        },
    )
    out: list[dict[str, Any]] = []
    for channel in _as_list(payload.get("channels")):
        if not isinstance(channel, dict) or not channel.get("id"):
            continue
        try:
            history = _slack_get(
                access_token,
                "/conversations.history",
                {
                    "channel": channel.get("id"),
                    "limit": 10,
                },
            )
        except Exception:
            continue
        for item in _as_list(history.get("messages")):
            if not isinstance(item, dict) or item.get("subtype"):
                continue
            out.append(
                normalize_slack_message(
                    {
                        **item,
                        "channel_id": channel.get("id"),
                        "channel_name": channel.get("name") or "",
                    },
                    access_token=access_token,
                )
            )
            if len(out) >= limit:
                return out
    return out


def fetch_github_pull_request_candidates(tool_context: Any = None) -> dict[str, Any]:
    """Fetch recent GitHub PR candidates for the current request."""
    context = read_related_context_request(tool_context)
    repo = _clean_text(context.get("repoFullName"))
    organization_id = _clean_text(context.get("organizationId"))
    user_id = _clean_text(context.get("userId"))
    if context.get("provider") != "github":
        return {"ok": False, "error": "provider is not github"}
    if not repo or "/" not in repo:
        return {"ok": False, "error": "GitHub repositoryを選択してください"}
    if not organization_id or not user_id:
        return {"ok": False, "error": "organizationId/userId is required"}
    try:
        access_token = _access_token_for_user(organization_id, user_id)
        pull_requests = _list_recent_pull_requests(access_token, repo)
        return {
            "ok": True,
            "repoFullName": repo,
            "checkedAt": _now_iso(),
            "pullRequests": pull_requests,
        }
    except Exception as exc:
        return {
            "ok": False,
            "repoFullName": repo,
            "checkedAt": _now_iso(),
            "error": str(exc)[:500],
            "pullRequests": [],
        }


def fetch_slack_message_candidates(tool_context: Any = None) -> dict[str, Any]:
    """Fetch Slack message candidates for the current related-context request."""
    context = read_related_context_request(tool_context)
    organization_id = _clean_text(context.get("organizationId"))
    user_id = _clean_text(context.get("userId"))
    if context.get("provider") != "slack":
        return {"ok": False, "error": "provider is not slack"}
    if not organization_id or not user_id:
        return {"ok": False, "error": "organizationId/userId is required"}
    try:
        access_token, connection = _slack_access_token_for_user(organization_id, user_id)
        explicit_query = _clean_text(context.get("slackQuery"))
        keywords = _extract_keywords(context)
        query = explicit_query or " OR ".join(f'"{word}"' for word in keywords[:5])
        messages: list[dict[str, Any]] = []
        if query:
            try:
                messages = _search_slack_messages(access_token, query, MAX_CANDIDATES)
            except Exception:
                messages = []
        if not messages:
            messages = _recent_slack_messages(access_token, MAX_CANDIDATES)
        return {
            "ok": True,
            "teamId": _clean_text(connection.get("teamId")),
            "teamName": _clean_text(connection.get("teamName")),
            "checkedAt": _now_iso(),
            "query": query,
            "messages": messages[:MAX_CANDIDATES],
        }
    except Exception as exc:
        return {
            "ok": False,
            "teamId": "",
            "teamName": "",
            "checkedAt": _now_iso(),
            "error": str(exc)[:500],
            "messages": [],
        }
