"""Slack OAuth connection and message read helpers for StoryVault."""
from __future__ import annotations

import os
from typing import Any

import requests
from cryptography.fernet import Fernet, InvalidToken
from firebase_functions import https_fn
from google.cloud import firestore


db = firestore.Client()

TOKEN_URL = "https://slack.com/api/oauth.v2.access"
SLACK_API = "https://slack.com/api"


def _oauth_client_id() -> str:
    return os.getenv("SLACK_OAUTH_CLIENT_ID", "").strip()


def _oauth_client_secret() -> str:
    return os.getenv("SLACK_OAUTH_CLIENT_SECRET", "").strip()


def _fernet() -> Fernet | None:
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
        raise RuntimeError("SLACK_TOKEN_ENCRYPTION_KEY is required")
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Stored Slack token cannot be decrypted") from exc


def _connection_ref(organization_id: str, user_id: str) -> firestore.DocumentReference:
    return (
        db.collection("organizations")
        .document(organization_id)
        .collection("externalServiceConfigs")
        .document("slackOAuth")
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


def _slack_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def _slack_get(
    access_token: str,
    path: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resp = requests.get(
        f"{SLACK_API}{path}",
        headers=_slack_headers(access_token),
        params=params,
        timeout=30,
    )
    if resp.status_code >= 400:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Slack API failed: {resp.status_code} {resp.text[:200]}",
        )
    payload = resp.json()
    if not payload.get("ok"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=str(payload.get("error") or "Slack API failed"),
        )
    return payload


def _as_int(value: Any, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _exchange_auth_code(code: str, redirect_uri: str | None = None) -> dict[str, Any]:
    client_id = _oauth_client_id()
    client_secret = _oauth_client_secret()
    if not client_id or not client_secret:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message=(
                "Slack OAuth client is not configured. "
                "Set SLACK_OAUTH_CLIENT_ID and SLACK_OAUTH_CLIENT_SECRET."
            ),
        )
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
    }
    if redirect_uri:
        data["redirect_uri"] = redirect_uri
    resp = requests.post(TOKEN_URL, data=data, timeout=30)
    if resp.status_code >= 400:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=f"Slack OAuth token exchange failed: {resp.text[:300]}",
        )
    payload = resp.json()
    if not payload.get("ok"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=str(payload.get("error") or "Slack OAuth failed"),
        )
    return payload


def _access_token_for_user(organization_id: str, user_id: str) -> str:
    snap = _connection_ref(organization_id, user_id).get()
    if not snap.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Slack が未接続です。Slack ワークスペースを接続してください。",
        )
    token = _unprotect((snap.to_dict() or {}).get("accessToken"))
    if not token:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Slack token is missing. Reconnect Slack.",
        )
    return token


def _message_permalink(access_token: str, channel_id: str, message_ts: str) -> str:
    if not channel_id or not message_ts:
        return ""
    try:
        payload = _slack_get(
            access_token,
            "/chat.getPermalink",
            {"channel": channel_id, "message_ts": message_ts},
        )
        return str(payload.get("permalink") or "")
    except Exception:
        return ""


def _message_dto(
    item: dict[str, Any],
    *,
    access_token: str,
    channel_id: str = "",
    channel_name: str = "",
) -> dict[str, Any]:
    channel = item.get("channel") if isinstance(item.get("channel"), dict) else {}
    resolved_channel_id = (
        str(item.get("channel_id") or "").strip()
        or str(channel.get("id") or "").strip()
        or channel_id
    )
    resolved_channel_name = (
        str(item.get("channel_name") or "").strip()
        or str(channel.get("name") or "").strip()
        or channel_name
    )
    message_ts = str(item.get("ts") or "").strip()
    permalink = str(item.get("permalink") or "").strip()
    if not permalink:
        permalink = _message_permalink(access_token, resolved_channel_id, message_ts)
    return {
        "channelId": resolved_channel_id,
        "channelName": resolved_channel_name,
        "messageTs": message_ts,
        "threadTs": str(item.get("thread_ts") or "").strip(),
        "permalink": permalink,
        "author": str(item.get("user") or item.get("username") or "").strip(),
        "text": str(item.get("text") or "").strip()[:2000],
        "postedAt": message_ts,
    }


def _search_messages(access_token: str, query: str, limit: int) -> list[dict[str, Any]]:
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
    matches = (payload.get("messages") or {}).get("matches") or []
    return [
        _message_dto(item, access_token=access_token)
        for item in matches
        if isinstance(item, dict)
    ][:limit]


def _recent_messages(access_token: str, limit: int) -> list[dict[str, Any]]:
    channels = _slack_get(
        access_token,
        "/conversations.list",
        {
            "types": "public_channel,private_channel",
            "exclude_archived": True,
            "limit": 50,
        },
    ).get("channels") or []
    out: list[dict[str, Any]] = []
    for channel in channels:
        if not isinstance(channel, dict) or not channel.get("id"):
            continue
        try:
            history = _slack_get(
                access_token,
                "/conversations.history",
                {"channel": channel.get("id"), "limit": min(20, limit)},
            )
        except https_fn.HttpsError:
            continue
        for item in history.get("messages") or []:
            if not isinstance(item, dict) or item.get("subtype"):
                continue
            out.append(
                _message_dto(
                    item,
                    access_token=access_token,
                    channel_id=str(channel.get("id") or ""),
                    channel_name=str(channel.get("name") or ""),
                )
            )
            if len(out) >= limit:
                return out
    return out


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=60)
def connect_slack(req: https_fn.CallableRequest) -> dict[str, Any]:
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
            message="Slack returned no access_token.",
        )
    team = token.get("team") if isinstance(token.get("team"), dict) else {}
    authed_user = (
        token.get("authed_user") if isinstance(token.get("authed_user"), dict) else {}
    )
    scopes = [
        scope.strip()
        for scope in str(token.get("scope") or "").split(",")
        if scope.strip()
    ]
    user_scopes = [
        scope.strip()
        for scope in str(authed_user.get("scope") or "").split(",")
        if scope.strip()
    ]
    now = firestore.SERVER_TIMESTAMP
    _connection_ref(organization_id, user_id).set(
        {
            "provider": "slack",
            "userId": user_id,
            "teamId": team.get("id") or "",
            "teamName": team.get("name") or "",
            "slackUserId": authed_user.get("id") or "",
            "scopes": scopes,
            "accessToken": _protect(access_token),
            "userAccessToken": _protect(str(authed_user.get("access_token") or ""))
            if authed_user.get("access_token")
            else None,
            "userScopes": user_scopes,
            "connectedAt": now,
            "updatedAt": now,
        },
        merge=True,
    )
    return {
        "ok": True,
        "teamId": team.get("id") or "",
        "teamName": team.get("name") or "",
        "slackUserId": authed_user.get("id") or "",
        "scopes": scopes,
        "userScopes": user_scopes,
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=30)
def get_slack_connection(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    snap = _connection_ref(organization_id, user_id).get()
    if not snap.exists:
        return {"connected": False}
    doc = snap.to_dict() or {}
    return {
        "connected": True,
        "teamId": doc.get("teamId") or "",
        "teamName": doc.get("teamName") or "",
        "slackUserId": doc.get("slackUserId") or "",
        "scopes": doc.get("scopes") or [],
        "userScopes": doc.get("userScopes") or [],
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=30)
def disconnect_slack(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    _connection_ref(organization_id, user_id).delete()
    return {"ok": True}


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=60)
def test_slack_connection(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    token = _access_token_for_user(organization_id, user_id)
    auth = _slack_get(token, "/auth.test")
    return {
        "ok": True,
        "team": auth.get("team") or "",
        "user": auth.get("user") or "",
        "teamId": auth.get("team_id") or "",
        "userId": auth.get("user_id") or "",
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=60)
def list_slack_messages(req: https_fn.CallableRequest) -> dict[str, Any]:
    """Read Slack messages for setup checks and lightweight previews.

    Rich related-context ranking is handled by the ADK agent, but this callable
    gives the app a direct way to confirm collection works before invoking AI.
    """
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    query = str(data.get("query") or "").strip()
    limit = _as_int(data.get("limit"), default=10, minimum=1, maximum=20)
    token = _access_token_for_user(organization_id, user_id)
    connection = _connection_ref(organization_id, user_id).get().to_dict() or {}
    if query:
        user_token = _unprotect(connection.get("userAccessToken"))
        messages = _search_messages(user_token, query, limit) if user_token else []
        if not messages:
            messages = _recent_messages(token, limit)
    else:
        messages = _recent_messages(token, limit)
    return {
        "ok": True,
        "teamId": connection.get("teamId") or "",
        "teamName": connection.get("teamName") or "",
        "query": query,
        "messages": messages,
    }
