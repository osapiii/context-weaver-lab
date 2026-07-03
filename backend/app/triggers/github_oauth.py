"""GitHub OAuth connection and repository read helpers for StoryVault."""
from __future__ import annotations

import os
from typing import Any

import requests
from cryptography.fernet import Fernet, InvalidToken
from firebase_functions import https_fn
from google.cloud import firestore


db = firestore.Client()

AUTHORIZE_SCOPES = ["repo", "read:user"]
GITHUB_API = "https://api.github.com"
TOKEN_URL = "https://github.com/login/oauth/access_token"


def _oauth_client_id() -> str:
    return os.getenv("GITHUB_OAUTH_CLIENT_ID", "").strip()


def _oauth_client_secret() -> str:
    return os.getenv("GITHUB_OAUTH_CLIENT_SECRET", "").strip()


def _fernet() -> Fernet | None:
    raw = os.getenv("GITHUB_TOKEN_ENCRYPTION_KEY", "").strip()
    if not raw:
        return None
    try:
        return Fernet(raw.encode("utf-8"))
    except Exception:
        return None


def _protect(value: str) -> dict[str, str]:
    f = _fernet()
    if not f:
        return {"mode": "plain", "value": value}
    return {
        "mode": "fernet",
        "value": f.encrypt(value.encode("utf-8")).decode("utf-8"),
    }


def _unprotect(payload: Any) -> str:
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


def _connection_ref(organization_id: str, user_id: str) -> firestore.DocumentReference:
    return (
        db.collection("organizations")
        .document(organization_id)
        .collection("externalServiceConfigs")
        .document("githubOAuth")
        .collection("users")
        .document(user_id)
    )


def _require_auth(req: https_fn.CallableRequest) -> str:
    if not req.auth or not req.auth.uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="ログインが必要です",
        )
    return req.auth.uid


def _require_org(data: dict[str, Any]) -> str:
    org = str(data.get("organizationId") or "").strip()
    if not org:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="organizationId is required",
        )
    return org


def _repo_full_name(data: dict[str, Any]) -> str:
    repo = str(data.get("repoFullName") or "").strip()
    if "/" not in repo or repo.count("/") != 1:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="repoFullName must be owner/repo",
        )
    return repo


def _github_headers(access_token: str) -> dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {access_token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _handle_github_error(resp: requests.Response) -> None:
    if resp.status_code < 400:
        return
    message = ""
    try:
        message = str(resp.json().get("message") or "")
    except Exception:
        message = resp.text[:300]
    if resp.status_code in (401, 403):
        code = https_fn.FunctionsErrorCode.PERMISSION_DENIED
        if resp.headers.get("x-ratelimit-remaining") == "0":
            message = "GitHub API rate limit exceeded"
    elif resp.status_code == 404:
        code = https_fn.FunctionsErrorCode.NOT_FOUND
    else:
        code = https_fn.FunctionsErrorCode.INTERNAL
    raise https_fn.HttpsError(
        code=code,
        message=message or f"GitHub API failed: {resp.status_code}",
    )


def _github_get(access_token: str, path: str, params: dict[str, Any] | None = None) -> Any:
    resp = requests.get(
        f"{GITHUB_API}{path}",
        headers=_github_headers(access_token),
        params=params,
        timeout=30,
    )
    _handle_github_error(resp)
    return resp.json()


def _exchange_auth_code(code: str, redirect_uri: str | None = None) -> dict[str, Any]:
    client_id = _oauth_client_id()
    client_secret = _oauth_client_secret()
    if not client_id or not client_secret:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message=(
                "GitHub OAuth client is not configured. "
                "Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET."
            ),
        )
    token_request = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
    }
    if redirect_uri:
        token_request["redirect_uri"] = redirect_uri
    resp = requests.post(
        TOKEN_URL,
        headers={"Accept": "application/json"},
        data=token_request,
        timeout=30,
    )
    if resp.status_code >= 400:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=f"GitHub OAuth token exchange failed: {resp.text[:300]}",
        )
    payload = resp.json()
    if payload.get("error"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=str(payload.get("error_description") or payload.get("error")),
        )
    return payload


def _access_token_for_user(organization_id: str, user_id: str) -> str:
    snap = _connection_ref(organization_id, user_id).get()
    if not snap.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GitHub が未接続です。GitHub アカウントを接続してください。",
        )
    doc = snap.to_dict() or {}
    token = _unprotect(doc.get("accessToken"))
    if not token:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GitHub token is missing. Reconnect GitHub.",
        )
    return token


def _to_repo_dto(repo: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": repo.get("id"),
        "name": repo.get("name") or "",
        "fullName": repo.get("full_name") or "",
        "description": repo.get("description") or "",
        "private": bool(repo.get("private")),
        "htmlUrl": repo.get("html_url") or "",
        "defaultBranch": repo.get("default_branch") or "",
        "language": repo.get("language") or "",
        "stargazersCount": repo.get("stargazers_count") or 0,
        "forksCount": repo.get("forks_count") or 0,
        "watchersCount": repo.get("watchers_count") or 0,
        "pushedAt": repo.get("pushed_at") or "",
        "updatedAt": repo.get("updated_at") or "",
    }


def _to_pr_dto(pr: dict[str, Any], *, include_diff_stats: bool = True) -> dict[str, Any]:
    diff_stats = {
        "changedFiles": pr.get("changed_files"),
        "additions": pr.get("additions"),
        "deletions": pr.get("deletions"),
    }
    if not include_diff_stats:
        diff_stats = {
            "changedFiles": None,
            "additions": None,
            "deletions": None,
        }
    return {
        "id": pr.get("id"),
        "number": pr.get("number"),
        "title": pr.get("title") or "",
        "htmlUrl": pr.get("html_url") or "",
        "author": (pr.get("user") or {}).get("login") or "",
        "mergedAt": pr.get("merged_at") or "",
        "createdAt": pr.get("created_at") or "",
        "updatedAt": pr.get("updated_at") or "",
        "baseBranch": (pr.get("base") or {}).get("ref") or "",
        "headBranch": (pr.get("head") or {}).get("ref") or "",
        "labels": [
            str(label.get("name") or "")
            for label in pr.get("labels") or []
            if label.get("name")
        ],
        **diff_stats,
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=60)
def connect_github(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    code = str(data.get("code") or "").strip()
    redirect_uri = str(data.get("redirectUri") or "").strip()
    if not code:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="OAuth authorization code is required",
        )

    token = _exchange_auth_code(code, redirect_uri or None)
    access_token = str(token.get("access_token") or "")
    if not access_token:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GitHub returned no access_token.",
        )
    user = _github_get(access_token, "/user")
    granted_scopes = [
        scope.strip()
        for scope in str(token.get("scope") or "").split(",")
        if scope.strip()
    ]
    now = firestore.SERVER_TIMESTAMP
    _connection_ref(organization_id, user_id).set(
        {
            "provider": "github",
            "userId": user_id,
            "githubLogin": user.get("login") or "",
            "githubUserId": user.get("id"),
            "scopes": granted_scopes,
            "accessToken": _protect(access_token),
            "connectedAt": now,
            "updatedAt": now,
        },
        merge=True,
    )
    return {
        "ok": True,
        "login": user.get("login") or "",
        "scopes": granted_scopes,
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=30)
def get_github_connection(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    snap = _connection_ref(organization_id, user_id).get()
    if not snap.exists:
        return {"connected": False}
    doc = snap.to_dict() or {}
    return {
        "connected": True,
        "login": doc.get("githubLogin") or "",
        "scopes": doc.get("scopes") or [],
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=30)
def disconnect_github(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    _connection_ref(organization_id, user_id).delete()
    return {"ok": True}


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=60)
def list_github_repositories(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    access_token = _access_token_for_user(organization_id, user_id)
    repos: list[dict[str, Any]] = []
    for page in range(1, 4):
        payload = _github_get(
            access_token,
            "/user/repos",
            {
                "visibility": "all",
                "affiliation": "owner,collaborator,organization_member",
                "sort": "updated",
                "per_page": 100,
                "page": page,
            },
        )
        if not isinstance(payload, list) or not payload:
            break
        repos.extend(_to_repo_dto(repo) for repo in payload)
        if len(payload) < 100:
            break
    return {"repositories": repos}


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=30)
def get_github_repository(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    repo = _repo_full_name(data)
    access_token = _access_token_for_user(organization_id, user_id)
    payload = _github_get(access_token, f"/repos/{repo}")
    return {"repository": _to_repo_dto(payload)}


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=90)
def list_github_merged_pull_requests(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    repo = _repo_full_name(data)
    limit = max(1, min(int(data.get("limit") or 30), 30))
    include_diff_stats = bool(data.get("includeDiffStats") or False)
    access_token = _access_token_for_user(organization_id, user_id)
    merged: list[dict[str, Any]] = []
    per_page = max(limit, 30)
    for page in range(1, 4):
        payload = _github_get(
            access_token,
            f"/repos/{repo}/pulls",
            {
                "state": "closed",
                "sort": "updated",
                "direction": "desc",
                "per_page": per_page,
                "page": page,
            },
        )
        if not isinstance(payload, list) or not payload:
            break
        for item in payload:
            if item.get("merged_at"):
                if include_diff_stats:
                    detail = _github_get(
                        access_token,
                        f"/repos/{repo}/pulls/{item.get('number')}",
                    )
                    merged.append(_to_pr_dto(detail))
                else:
                    merged.append(_to_pr_dto(item, include_diff_stats=False))
                if len(merged) >= limit:
                    return {"pullRequests": merged}
        if len(payload) < per_page:
            break
    return {"pullRequests": merged}
