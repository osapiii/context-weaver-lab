"""Jira Cloud OAuth 2.0 (3LO) and issue read helpers for StoryVault."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from cryptography.fernet import Fernet, InvalidToken
from firebase_functions import https_fn
from google.cloud import firestore


db = firestore.Client()
logger = logging.getLogger(__name__)

TOKEN_URL = "https://auth.atlassian.com/oauth/token"
ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"
ATLASSIAN_API_BASE = "https://api.atlassian.com/ex/jira"
DEFAULT_FIELDS = [
    "summary",
    "description",
    "issuetype",
    "status",
    "priority",
    "assignee",
    "reporter",
    "project",
    "labels",
    "components",
    "fixVersions",
    "updated",
    "created",
    "parent",
]


def _oauth_client_id() -> str:
    return os.getenv("JIRA_OAUTH_CLIENT_ID", "").strip()


def _oauth_client_secret() -> str:
    return os.getenv("JIRA_OAUTH_CLIENT_SECRET", "").strip()


def _fernet() -> Fernet | None:
    raw = (
        os.getenv("JIRA_TOKEN_ENCRYPTION_KEY", "").strip()
        or os.getenv("SLACK_TOKEN_ENCRYPTION_KEY", "").strip()
        or os.getenv("GITHUB_TOKEN_ENCRYPTION_KEY", "").strip()
    )
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
        raise RuntimeError("JIRA_TOKEN_ENCRYPTION_KEY is required")
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Stored Jira token cannot be decrypted") from exc


def _require_auth(req: https_fn.CallableRequest) -> str:
    if not req.auth or not req.auth.uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="ログインが必要です",
        )
    return req.auth.uid


def _require_org(data: dict[str, Any]) -> str:
    organization_id = str(data.get("organizationId") or "").strip()
    if not organization_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="organizationId is required",
        )
    return organization_id


def _configs_ref(organization_id: str) -> firestore.CollectionReference:
    return (
        db.collection("organizations")
        .document(organization_id)
        .collection("externalServiceConfigs")
        .document("jiraIntegration")
        .collection("configs")
    )


def _as_int(value: Any, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _public_connection(cloud_id: str, doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": cloud_id,
        "cloudId": cloud_id,
        "connected": True,
        "siteName": doc.get("siteName") or "",
        "siteUrl": doc.get("siteUrl") or "",
        "avatarUrl": doc.get("avatarUrl") or "",
        "scopes": doc.get("scopes") or [],
        "connectedBy": doc.get("connectedBy") or "",
        "connectedAt": doc.get("connectedAt"),
        "updatedAt": doc.get("updatedAt"),
        "expiresAt": doc.get("expiresAt"),
    }


def _token_request(payload: dict[str, Any]) -> dict[str, Any]:
    grant_type = str(payload.get("grant_type") or "unknown")
    try:
        response = requests.post(TOKEN_URL, json=payload, timeout=30)
    except requests.RequestException:
        logger.exception("Jira OAuth token request failed", extra={"grant_type": grant_type})
        raise
    if response.status_code >= 400:
        logger.warning(
            "Jira OAuth token endpoint returned an error",
            extra={"grant_type": grant_type, "status_code": response.status_code},
        )
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=f"Jira OAuth token exchange failed: {response.text[:300]}",
        )
    data = response.json()
    if not data.get("access_token"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Jira returned no access token.",
        )
    return data


def _exchange_auth_code(code: str, redirect_uri: str) -> dict[str, Any]:
    client_id = _oauth_client_id()
    client_secret = _oauth_client_secret()
    if not client_id or not client_secret:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message=(
                "Jira OAuth client is not configured. "
                "Set JIRA_OAUTH_CLIENT_ID and JIRA_OAUTH_CLIENT_SECRET."
            ),
        )
    return _token_request(
        {
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }
    )


def _accessible_resources(access_token: str) -> list[dict[str, Any]]:
    response = requests.get(
        ACCESSIBLE_RESOURCES_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    if response.status_code >= 400:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=f"Jira accessible resources failed: {response.text[:300]}",
        )
    payload = response.json()
    return [item for item in payload if isinstance(item, dict) and item.get("id")]


def _connection_doc(
    organization_id: str,
    cloud_id: str | None = None,
) -> tuple[str, dict[str, Any]]:
    if cloud_id:
        snap = _configs_ref(organization_id).document(cloud_id).get()
        if not snap.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Jira site connection was not found.",
            )
        return snap.id, snap.to_dict() or {}
    rows = list(_configs_ref(organization_id).limit(1).stream())
    if not rows:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Jira が未接続です。Jira Cloud siteを接続してください。",
        )
    return rows[0].id, rows[0].to_dict() or {}


def _timestamp_to_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return None


def _refresh_access_token(
    organization_id: str,
    cloud_id: str,
    doc: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    refresh_token = _unprotect(doc.get("refreshToken"))
    if not refresh_token:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Jira refresh token is missing. Reconnect Jira.",
        )
    client_id = _oauth_client_id()
    client_secret = _oauth_client_secret()
    if not client_id or not client_secret:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Jira OAuth client is not configured.",
        )
    token = _token_request(
        {
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
        }
    )
    expires_in = _as_int(token.get("expires_in"), default=3600, minimum=60, maximum=86400)
    update = {
        "accessToken": _protect(str(token.get("access_token") or "")),
        "refreshToken": _protect(str(token.get("refresh_token") or refresh_token)),
        "expiresAt": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
        "scopes": str(token.get("scope") or "").split(),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    _configs_ref(organization_id).document(cloud_id).set(update, merge=True)
    return str(token.get("access_token") or ""), {**doc, **update}


def _access_token_for_site(
    organization_id: str,
    cloud_id: str | None = None,
) -> tuple[str, str, dict[str, Any]]:
    resolved_cloud_id, doc = _connection_doc(organization_id, cloud_id)
    expires_at = _timestamp_to_datetime(doc.get("expiresAt"))
    if not expires_at or expires_at <= datetime.now(timezone.utc) + timedelta(minutes=2):
        token, refreshed_doc = _refresh_access_token(
            organization_id,
            resolved_cloud_id,
            doc,
        )
        return token, resolved_cloud_id, refreshed_doc
    token = _unprotect(doc.get("accessToken"))
    if not token:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Jira access token is missing. Reconnect Jira.",
        )
    return token, resolved_cloud_id, doc


def _jira_request(
    access_token: str,
    cloud_id: str,
    method: str,
    path: str,
    *,
    json_body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    response = requests.request(
        method,
        f"{ATLASSIAN_API_BASE}/{cloud_id}{path}",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        json=json_body,
        timeout=45,
    )
    if response.status_code >= 400:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=f"Jira API failed: {response.status_code} {response.text[:300]}",
        )
    return response.json() if response.text else {}


def _adf_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return "\n".join(part for part in (_adf_text(item) for item in value) if part)
    if not isinstance(value, dict):
        return ""
    own_text = str(value.get("text") or "").strip()
    child_text = _adf_text(value.get("content"))
    return "\n".join(part for part in (own_text, child_text) if part).strip()


def _named_field(value: Any) -> dict[str, str]:
    data = value if isinstance(value, dict) else {}
    return {
        "id": str(data.get("id") or ""),
        "name": str(data.get("name") or data.get("displayName") or ""),
    }


def _normalize_issue(issue: dict[str, Any], *, site_url: str, cloud_id: str) -> dict[str, Any]:
    fields = issue.get("fields") if isinstance(issue.get("fields"), dict) else {}
    project = _named_field(fields.get("project"))
    issue_type = _named_field(fields.get("issuetype"))
    status = _named_field(fields.get("status"))
    priority = _named_field(fields.get("priority"))
    assignee = _named_field(fields.get("assignee"))
    reporter = _named_field(fields.get("reporter"))
    parent = fields.get("parent") if isinstance(fields.get("parent"), dict) else {}
    key = str(issue.get("key") or "")
    return {
        "id": str(issue.get("id") or ""),
        "key": key,
        "cloudId": cloud_id,
        "siteUrl": site_url,
        "htmlUrl": f"{site_url.rstrip('/')}/browse/{key}" if site_url and key else "",
        "summary": str(fields.get("summary") or ""),
        "description": _adf_text(fields.get("description"))[:4000],
        "issueType": issue_type,
        "status": status,
        "priority": priority,
        "assignee": assignee,
        "reporter": reporter,
        "project": project,
        "labels": [str(item) for item in fields.get("labels") or [] if str(item)],
        "components": [
            _named_field(item) for item in fields.get("components") or [] if isinstance(item, dict)
        ],
        "fixVersions": [
            _named_field(item) for item in fields.get("fixVersions") or [] if isinstance(item, dict)
        ],
        "parentKey": str(parent.get("key") or ""),
        "createdAt": str(fields.get("created") or ""),
        "updatedAt": str(fields.get("updated") or ""),
    }


def _escape_jql_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').strip()


def _search_issues(
    access_token: str,
    cloud_id: str,
    site_url: str,
    *,
    query: str,
    jql: str,
    limit: int,
) -> list[dict[str, Any]]:
    resolved_jql = jql.strip()
    if not resolved_jql:
        escaped = _escape_jql_text(query)
        issue_key = query.strip().upper()
        if issue_key and issue_key.replace("-", "").isalnum() and "-" in issue_key:
            resolved_jql = f'key = "{issue_key}" ORDER BY updated DESC'
        else:
            resolved_jql = (
                f'text ~ "{escaped}" ORDER BY updated DESC'
                if escaped
                else "updated >= -180d ORDER BY updated DESC"
            )
    payload = _jira_request(
        access_token,
        cloud_id,
        "POST",
        "/rest/api/3/search/jql",
        json_body={
            "jql": resolved_jql,
            "maxResults": limit,
            "fields": DEFAULT_FIELDS,
        },
    )
    return [
        _normalize_issue(item, site_url=site_url, cloud_id=cloud_id)
        for item in payload.get("issues") or []
        if isinstance(item, dict)
    ]


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=60)
def connect_jira_site(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    code = str(data.get("code") or "").strip()
    redirect_uri = str(data.get("redirectUri") or "").strip()
    if not code or not redirect_uri:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Jira OAuth authorization code and redirectUri are required",
        )
    logger.info(
        "Jira OAuth connect started",
        extra={
            "organization_id": organization_id,
            "connected_by": user_id,
            "redirect_uri": redirect_uri,
        },
    )
    try:
        token = _exchange_auth_code(code, redirect_uri)
        access_token = str(token.get("access_token") or "")
        logger.info(
            "Jira OAuth authorization code exchanged",
            extra={"organization_id": organization_id},
        )
        resources = _accessible_resources(access_token)
        logger.info(
            "Jira OAuth accessible resources resolved",
            extra={
                "organization_id": organization_id,
                "resource_count": len(resources),
            },
        )
        if not resources:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Jira Cloud siteへのアクセス権を取得できませんでした。",
            )
        expires_in = _as_int(token.get("expires_in"), default=3600, minimum=60, maximum=86400)
        scopes = str(token.get("scope") or "").split() or [
            "read:jira-work",
            "read:jira-user",
        ]
        connected_at = datetime.now(timezone.utc)
        connections: list[dict[str, Any]] = []
        for resource in resources:
            cloud_id = str(resource.get("id") or "").strip()
            if not cloud_id:
                continue
            doc = {
                "provider": "jira",
                "cloudId": cloud_id,
                "siteName": str(resource.get("name") or ""),
                "siteUrl": str(resource.get("url") or ""),
                "avatarUrl": str(resource.get("avatarUrl") or ""),
                "scopes": scopes,
                "accessToken": _protect(access_token),
                "refreshToken": _protect(str(token.get("refresh_token") or "")),
                "expiresAt": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
                "connectedBy": user_id,
                "connectedAt": connected_at,
                "updatedAt": connected_at,
            }
            _configs_ref(organization_id).document(cloud_id).set(doc, merge=True)
            connections.append(_public_connection(cloud_id, doc))
        logger.info(
            "Jira OAuth connections saved",
            extra={
                "organization_id": organization_id,
                "connection_count": len(connections),
            },
        )
        return {"ok": True, "connections": connections}
    except https_fn.HttpsError:
        logger.exception(
            "Jira OAuth connect failed with a handled error",
            extra={"organization_id": organization_id},
        )
        raise
    except Exception as exc:
        logger.exception(
            "Jira OAuth connect failed unexpectedly",
            extra={"organization_id": organization_id},
        )
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Jira接続処理に失敗しました: {type(exc).__name__}",
        ) from exc


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=30)
def get_jira_connections(req: https_fn.CallableRequest) -> dict[str, Any]:
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    rows = [
        _public_connection(snap.id, snap.to_dict() or {})
        for snap in _configs_ref(organization_id).stream()
    ]
    rows.sort(key=lambda row: str(row.get("siteName") or row.get("id") or "").lower())
    logger.info(
        "Jira OAuth connections loaded",
        extra={"organization_id": organization_id, "connection_count": len(rows)},
    )
    return {
        "ok": True,
        "configured": bool(_oauth_client_id() and _oauth_client_secret()),
        "connections": rows,
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=30)
def disconnect_jira_site(req: https_fn.CallableRequest) -> dict[str, Any]:
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    cloud_id = str(data.get("cloudId") or data.get("connectionId") or "").strip()
    if not cloud_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="cloudId is required",
        )
    _configs_ref(organization_id).document(cloud_id).delete()
    return {"ok": True}


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=60)
def test_jira_connection(req: https_fn.CallableRequest) -> dict[str, Any]:
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    cloud_id = str(data.get("cloudId") or data.get("connectionId") or "").strip() or None
    token, resolved_cloud_id, connection = _access_token_for_site(organization_id, cloud_id)
    account = _jira_request(token, resolved_cloud_id, "GET", "/rest/api/3/myself")
    return {
        "ok": True,
        "cloudId": resolved_cloud_id,
        "siteName": connection.get("siteName") or "",
        "accountId": account.get("accountId") or "",
        "displayName": account.get("displayName") or "",
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=90)
def list_jira_issues(req: https_fn.CallableRequest) -> dict[str, Any]:
    """Read Jira issues directly before invoking related-context AI."""
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    cloud_id = str(data.get("cloudId") or data.get("connectionId") or "").strip() or None
    query = str(data.get("query") or "").strip()
    jql = str(data.get("jql") or "").strip()
    limit = _as_int(data.get("limit"), default=30, minimum=1, maximum=100)
    token, resolved_cloud_id, connection = _access_token_for_site(organization_id, cloud_id)
    issues = _search_issues(
        token,
        resolved_cloud_id,
        str(connection.get("siteUrl") or ""),
        query=query,
        jql=jql,
        limit=limit,
    )
    return {
        "ok": True,
        "cloudId": resolved_cloud_id,
        "siteName": connection.get("siteName") or "",
        "siteUrl": connection.get("siteUrl") or "",
        "query": query,
        "jql": jql,
        "issues": issues,
    }
