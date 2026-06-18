"""Google Workspace OAuth connection and credential helpers.

EN AI Studio uses Firebase Auth for app identity. Workspace API access is a separate
OAuth connection: the frontend obtains an auth code with Google Identity
Services, this callable exchanges it for tokens, and backend jobs resolve the
requesting user's credentials from Firestore.
"""
from __future__ import annotations

import os
from typing import Any

import requests
from cryptography.fernet import Fernet, InvalidToken
from firebase_functions import https_fn
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.cloud import firestore
from google.oauth2.credentials import Credentials


db = firestore.Client()

WORKSPACE_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
]
TOKEN_URL = "https://oauth2.googleapis.com/token"


def _oauth_client_id() -> str:
    return os.getenv("GOOGLE_WORKSPACE_OAUTH_CLIENT_ID", "").strip()


def _oauth_client_secret() -> str:
    return os.getenv("GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET", "").strip()


def _fernet() -> Fernet | None:
    raw = os.getenv("GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY", "").strip()
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
        raise RuntimeError("GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY is required")
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Stored Google Workspace token cannot be decrypted") from exc


def _connection_ref(organization_id: str, user_id: str) -> firestore.DocumentReference:
    return (
        db.collection("organizations")
        .document(organization_id)
        .collection("externalServiceConfigs")
        .document("googleWorkspaceOAuth")
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


def _exchange_auth_code(code: str) -> dict[str, Any]:
    client_id = _oauth_client_id()
    client_secret = _oauth_client_secret()
    if not client_id or not client_secret:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message=(
                "Google Workspace OAuth client is not configured. "
                "Set GOOGLE_WORKSPACE_OAUTH_CLIENT_ID and GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET."
            ),
        )
    resp = requests.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": "postmessage",
        },
        timeout=30,
    )
    if resp.status_code >= 400:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=f"Google OAuth token exchange failed: {resp.text[:300]}",
        )
    return resp.json()


def _token_email(access_token: str) -> str:
    try:
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        if resp.status_code < 400:
            return str(resp.json().get("email") or "")
    except Exception:
        return ""
    return ""


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=60)
def connect_google_workspace(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    code = str(data.get("code") or "").strip()
    if not code:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="OAuth authorization code is required",
        )

    token = _exchange_auth_code(code)
    refresh_token = str(token.get("refresh_token") or "")
    access_token = str(token.get("access_token") or "")
    if not refresh_token:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Google returned no refresh_token. Reconnect with prompt=consent.",
        )

    granted_scopes = str(token.get("scope") or "").split()
    email = _token_email(access_token)
    now = firestore.SERVER_TIMESTAMP
    _connection_ref(organization_id, user_id).set(
        {
            "provider": "google",
            "userId": user_id,
            "email": email,
            "scopes": granted_scopes,
            "refreshToken": _protect(refresh_token),
            "connectedAt": now,
            "updatedAt": now,
        },
        merge=True,
    )
    return {"ok": True, "email": email, "scopes": granted_scopes}


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=30)
def get_google_workspace_connection(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    snap = _connection_ref(organization_id, user_id).get()
    if not snap.exists:
        return {"connected": False}
    doc = snap.to_dict() or {}
    return {
        "connected": True,
        "email": doc.get("email") or "",
        "scopes": doc.get("scopes") or [],
    }


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=30)
def disconnect_google_workspace(req: https_fn.CallableRequest) -> dict[str, Any]:
    user_id = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _require_org(data)
    _connection_ref(organization_id, user_id).delete()
    return {"ok": True}


def credentials_for_user(
    *,
    organization_id: str,
    user_id: str,
    scopes: list[str] | tuple[str, ...],
) -> Credentials:
    snap = _connection_ref(organization_id, user_id).get()
    if not snap.exists:
        raise RuntimeError(
            "Google Workspace が未接続です。Google アカウントを接続してください。"
        )
    doc = snap.to_dict() or {}
    refresh_token = _unprotect(doc.get("refreshToken"))
    if not refresh_token:
        raise RuntimeError("Google Workspace refresh token is missing")
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=TOKEN_URL,
        client_id=_oauth_client_id(),
        client_secret=_oauth_client_secret(),
        scopes=list(scopes),
    )
    creds.refresh(GoogleAuthRequest())
    return creds


def credentials_from_operation_metadata(
    operation_metadata: dict[str, Any],
    *,
    scopes: list[str] | tuple[str, ...],
) -> Credentials:
    organization_id = str(operation_metadata.get("organizationId") or "").strip()
    requested_by = operation_metadata.get("requestedBy") or {}
    user_id = str(requested_by.get("userId") or "").strip()
    if not organization_id or not user_id:
        raise RuntimeError("operationMetadata.organizationId/requestedBy.userId is required")
    return credentials_for_user(
        organization_id=organization_id,
        user_id=user_id,
        scopes=scopes,
    )
