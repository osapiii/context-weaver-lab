"""E2E authentication session storage backed by Secret Manager."""
from __future__ import annotations

import json
import hashlib
import hmac
import os
import re
import time
from typing import Any
from urllib.parse import urlencode

from firebase_functions import https_fn
from google.api_core import exceptions as google_exceptions
from google.cloud import secretmanager


SECRET_ID_RE = re.compile(r"[^A-Za-z0-9_-]+")
MAX_STORAGE_STATE_BYTES = int(
    os.getenv("E2E_AUTH_STORAGE_STATE_MAX_BYTES", str(512 * 1024))
)
AUTH_BROWSER_URL_TTL_SECONDS = int(
    os.getenv("E2E_AUTH_BROWSER_URL_TTL_SECONDS", "900")
)


def _require_auth(req: https_fn.CallableRequest) -> str:
    if not req.auth or not req.auth.uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="ログインが必要です",
        )
    return req.auth.uid


def _project_id() -> str:
    project_id = (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCLOUD_PROJECT")
        or os.getenv("GCP_PROJECT")
        or ""
    ).strip()
    if not project_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GOOGLE_CLOUD_PROJECT is not configured",
        )
    return project_id


def _required_string(data: dict[str, Any], key: str) -> str:
    value = str(data.get(key) or "").strip()
    if not value:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"{key} is required",
        )
    return value


def _secret_id(organization_id: str, application_id: str) -> str:
    raw = f"vibe-e2e-state-{organization_id}-{application_id}"
    normalized = SECRET_ID_RE.sub("-", raw).strip("-")
    return normalized[:240] or "vibe-e2e-state"


def _client() -> secretmanager.SecretManagerServiceClient:
    return secretmanager.SecretManagerServiceClient()


def _secret_name(project_id: str, secret_id: str) -> str:
    return f"projects/{project_id}/secrets/{secret_id}"


def _validate_storage_state(raw: str) -> dict[str, Any]:
    payload = raw.encode("utf-8")
    if len(payload) > MAX_STORAGE_STATE_BYTES:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.OUT_OF_RANGE,
            message="storageStateJson is too large",
        )
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="storageStateJson must be valid JSON",
        ) from exc
    if not isinstance(parsed, dict):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="storageStateJson must be an object",
        )
    cookies = parsed.get("cookies")
    origins = parsed.get("origins")
    if not isinstance(cookies, list) and not isinstance(origins, list):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="storageStateJson must contain cookies or origins",
        )
    return parsed


def _auth_browser_url() -> str:
    url = os.getenv("E2E_AUTH_BROWSER_URL", "").strip().rstrip("/")
    if not url:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="E2E_AUTH_BROWSER_URL is not configured",
        )
    return url


def _auth_browser_shared_secret() -> str:
    secret = os.getenv("E2E_AUTH_BROWSER_SHARED_SECRET", "").strip()
    if not secret:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="E2E_AUTH_BROWSER_SHARED_SECRET is not configured",
        )
    return secret


def _sign_browser_session(
    organization_id: str,
    application_id: str,
    entry_url: str,
    expires: int,
) -> str:
    message = f"{organization_id}|{application_id}|{entry_url}|{expires}"
    return hmac.new(
        _auth_browser_shared_secret().encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _status_from_payload(raw: str, *, updated_at: str | None) -> dict[str, Any]:
    parsed = _validate_storage_state(raw)
    cookies = parsed.get("cookies") if isinstance(parsed.get("cookies"), list) else []
    origins = parsed.get("origins") if isinstance(parsed.get("origins"), list) else []
    return {
        "configured": True,
        "updatedAt": updated_at,
        "cookieCount": len(cookies),
        "originCount": len(origins),
    }


def _access_latest_state(
    client: secretmanager.SecretManagerServiceClient,
    secret_name: str,
) -> tuple[str, str | None] | None:
    version_name = f"{secret_name}/versions/latest"
    try:
        version = client.get_secret_version(request={"name": version_name})
        response = client.access_secret_version(request={"name": version_name})
    except google_exceptions.NotFound:
        return None
    updated_at = None
    if version.create_time:
        updated_at = version.create_time.isoformat()
    return response.payload.data.decode("utf-8"), updated_at


@https_fn.on_call(region="asia-northeast1", memory=256, timeout_sec=60)
def get_e2e_auth_session_status(req: https_fn.CallableRequest) -> dict[str, Any]:
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _required_string(data, "organizationId")
    application_id = _required_string(data, "applicationId")
    project_id = _project_id()
    secret_id = _secret_id(organization_id, application_id)
    client = _client()
    latest = _access_latest_state(client, _secret_name(project_id, secret_id))
    if not latest:
        return {
            "configured": False,
            "secretId": secret_id,
            "updatedAt": None,
            "cookieCount": 0,
            "originCount": 0,
        }
    raw, updated_at = latest
    return {"secretId": secret_id, **_status_from_payload(raw, updated_at=updated_at)}


@https_fn.on_call(region="asia-northeast1", memory=256, timeout_sec=60)
def create_e2e_auth_browser_session(req: https_fn.CallableRequest) -> dict[str, Any]:
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _required_string(data, "organizationId")
    application_id = _required_string(data, "applicationId")
    entry_url = _required_string(data, "entryUrl")
    if not entry_url.startswith(("https://", "http://")):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="entryUrl must be http or https",
        )
    expires = int(time.time()) + AUTH_BROWSER_URL_TTL_SECONDS
    token = _sign_browser_session(
        organization_id,
        application_id,
        entry_url,
        expires,
    )
    params = urlencode(
        {
            "organizationId": organization_id,
            "applicationId": application_id,
            "entryUrl": entry_url,
            "expires": str(expires),
            "token": token,
        }
    )
    return {
        "url": f"{_auth_browser_url()}/session/new?{params}",
        "expiresAt": expires,
    }


@https_fn.on_call(region="asia-northeast1", memory=256, timeout_sec=60)
def save_e2e_auth_session_state(req: https_fn.CallableRequest) -> dict[str, Any]:
    uid = _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _required_string(data, "organizationId")
    application_id = _required_string(data, "applicationId")
    storage_state_json = _required_string(data, "storageStateJson")
    _validate_storage_state(storage_state_json)

    project_id = _project_id()
    secret_id = _secret_id(organization_id, application_id)
    secret_name = _secret_name(project_id, secret_id)
    client = _client()
    try:
        client.get_secret(request={"name": secret_name})
    except google_exceptions.NotFound:
        client.create_secret(
            request={
                "parent": f"projects/{project_id}",
                "secret_id": secret_id,
                "secret": {
                    "replication": {"automatic": {}},
                    "labels": {
                        "source": "vibe-control",
                        "kind": "e2e-auth-state",
                    },
                },
            }
        )

    version = client.add_secret_version(
        request={
            "parent": secret_name,
            "payload": {"data": storage_state_json.encode("utf-8")},
        }
    )
    return {
        "ok": True,
        "secretId": secret_id,
        "version": version.name.rsplit("/", 1)[-1],
        "updatedBy": uid,
        **_status_from_payload(storage_state_json, updated_at=version.create_time.isoformat() if version.create_time else None),
    }


@https_fn.on_call(region="asia-northeast1", memory=256, timeout_sec=60)
def delete_e2e_auth_session_state(req: https_fn.CallableRequest) -> dict[str, Any]:
    _require_auth(req)
    data = req.data if isinstance(req.data, dict) else {}
    organization_id = _required_string(data, "organizationId")
    application_id = _required_string(data, "applicationId")
    project_id = _project_id()
    secret_id = _secret_id(organization_id, application_id)
    client = _client()
    try:
        client.delete_secret(request={"name": _secret_name(project_id, secret_id)})
    except google_exceptions.NotFound:
        pass
    return {"ok": True, "secretId": secret_id, "configured": False}
