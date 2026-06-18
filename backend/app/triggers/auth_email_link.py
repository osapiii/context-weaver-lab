"""Custom branded Email Link sender for admin sign-in."""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import google.auth
import requests
from firebase_admin import auth, get_app, initialize_app
from firebase_functions import https_fn
from google.auth.transport.requests import AuthorizedSession
from google.cloud import firestore

try:
    get_app()
except ValueError:
    initialize_app()

db = firestore.Client()

SEND_MAIL_SERVICE_URL = os.getenv("SEND_MAIL_SERVICE_URL", "").rstrip("/")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
RATE_LIMIT_SECONDS = 60
DEFAULT_DEV_AUTH_PROJECT_IDS = {"en-aistudio-development"}
DEFAULT_DEV_AUTH_EMAILS = {"super@enostech.co.jp"}
DEV_SUPER_UID = "super_enostech_co_jp"
DEV_ORGANIZATION_ID = "org_enostech"
DEV_ORGANIZATION_CODE = "enostech"
DEV_SPACE_ID = "default"


def _project_id() -> str:
    if os.getenv("GOOGLE_CLOUD_PROJECT"):
        return os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
    if os.getenv("GCLOUD_PROJECT"):
        return os.getenv("GCLOUD_PROJECT", "").strip()
    firebase_config = os.getenv("FIREBASE_CONFIG")
    if firebase_config:
        try:
            return str(json.loads(firebase_config).get("projectId") or "").strip()
        except json.JSONDecodeError:
            return ""
    return ""


def _app_name() -> str:
    return (os.getenv("AI_STUDIO_APP_NAME") or "EN AIstudio").strip()


def _allowed_hosts(project_id: str) -> set[str]:
    defaults = {
        f"{project_id}.web.app",
        f"{project_id}.firebaseapp.com",
        "localhost:3000",
        "127.0.0.1:3000",
    }
    configured = {
        item.strip()
        for item in (os.getenv("AUTH_EMAIL_LINK_ALLOWED_HOSTS") or "").split(",")
        if item.strip()
    }
    return defaults | configured


def _validate_continue_url(value: str, project_id: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"https", "http"}:
        raise ValueError("continueUrl の形式が不正です")
    if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1"}:
        raise ValueError("continueUrl は HTTPS が必要です")
    if parsed.netloc not in _allowed_hosts(project_id):
        raise ValueError("continueUrl のドメインが許可されていません")
    if not parsed.path.startswith("/admin/signin"):
        raise ValueError("continueUrl のパスが不正です")
    return value


def _csv_env_set(name: str) -> set[str]:
    raw = os.getenv(name, "")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _dev_auth_project_ids() -> set[str]:
    return _csv_env_set("DEV_AUTH_BYPASS_PROJECT_IDS") or DEFAULT_DEV_AUTH_PROJECT_IDS


def _dev_auth_emails() -> set[str]:
    return _csv_env_set("DEV_AUTH_BYPASS_EMAILS") or DEFAULT_DEV_AUTH_EMAILS


def _assert_dev_auth_bypass_allowed(email: str, project_id: str) -> None:
    if project_id.lower() not in _dev_auth_project_ids():
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="開発ログインはこの Firebase project では無効です",
        )
    if email.lower() not in _dev_auth_emails():
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="このメールアドレスは開発ログインの許可リストにありません",
        )


def _assert_known_admin_user(email: str) -> auth.UserRecord:
    try:
        user = auth.get_user_by_email(email)
    except auth.UserNotFoundError as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="登録済みの管理ユーザーが見つかりません",
        ) from exc

    claims = user.custom_claims or {}
    if not claims.get("organizationId") or not claims.get("rbacRole"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="管理画面に必要な権限が設定されていません",
        )
    if user.disabled:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="このユーザーは無効化されています",
        )
    return user


def _ensure_dev_super_workspace(user: auth.UserRecord, email: str) -> None:
    db.collection("organizations").document(DEV_ORGANIZATION_ID).set(
        {
            "id": DEV_ORGANIZATION_ID,
            "code": DEV_ORGANIZATION_CODE,
            "name": "ENOSTECH",
            "displayName": "ENOSTECH",
            "status": "active",
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    db.collection("organizations").document(DEV_ORGANIZATION_ID).collection(
        "spaces"
    ).document(DEV_SPACE_ID).set(
        {
            "id": DEV_SPACE_ID,
            "name": "Default",
            "displayName": "Default",
            "isDefault": True,
            "organizationId": DEV_ORGANIZATION_ID,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    db.collection("organizations").document(DEV_ORGANIZATION_ID).collection(
        "adminUsers"
    ).document(user.uid).set(
        {
            "id": user.uid,
            "uid": user.uid,
            "email": email,
            "displayName": user.display_name or "Super Admin",
            "rbacRole": 1,
            "organizationId": DEV_ORGANIZATION_ID,
            "organizationCode": DEV_ORGANIZATION_CODE,
            "spaceIds": [DEV_SPACE_ID],
            "status": "active",
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )


def _check_rate_limit(email: str) -> None:
    doc_id = hashlib.sha256(email.encode("utf-8")).hexdigest()
    ref = (
        db.collection("system")
        .document("authEmailLinkRateLimits")
        .collection("emails")
        .document(doc_id)
    )
    now = datetime.now(timezone.utc)
    snap = ref.get()
    if snap.exists:
        last_sent_at = (snap.to_dict() or {}).get("lastSentAt")
        if last_sent_at:
            elapsed = (now - last_sent_at).total_seconds()
            if elapsed < RATE_LIMIT_SECONDS:
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
                    message="少し時間をおいてから再送してください",
                )
    ref.set(
        {
            "email": email,
            "lastSentAt": now,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )


def _generate_email_link(email: str, continue_url: str, project_id: str) -> str:
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    session = AuthorizedSession(credentials)
    response = session.post(
        "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode",
        json={
            "requestType": "EMAIL_SIGNIN",
            "email": email,
            "continueUrl": continue_url,
            "canHandleCodeInApp": True,
            "returnOobLink": True,
            "targetProjectId": project_id,
        },
        timeout=30,
    )
    body = response.json()
    if response.status_code >= 400 or body.get("error"):
        raise RuntimeError(f"Identity Toolkit returned error: {body.get('error') or body}")
    link = str(body.get("oobLink") or "").strip()
    if not link:
        raise RuntimeError("Identity Toolkit did not return oobLink")
    return link


def _email_html(email: str, link: str) -> str:
    safe_email = html.escape(email)
    safe_link = html.escape(link, quote=True)
    app_name = html.escape(_app_name())
    return f"""<!doctype html>
<html>
  <body style="margin:0;background:#f6f8fb;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#0f172a;padding:28px 32px;color:#ffffff;">
          <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;">{app_name}</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.35;font-weight:800;">管理画面へのログインリンク</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">{safe_email} 宛に、{app_name} 管理画面へのログインリンクを発行しました。</p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.8;">下のボタンを押すと、パスワード入力なしでログインが完了します。</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
            <tr>
              <td style="border-radius:8px;background:#0f172a;">
                <a href="{safe_link}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">{app_name} にログイン</a>
              </td>
            </tr>
          </table>
          <div style="border:1px solid #bae6fd;background:#f0f9ff;border-radius:8px;padding:16px;margin:0 0 24px;">
            <p style="margin:0;font-size:13px;line-height:1.7;color:#0f172a;">このリンクは本人確認用です。心当たりがない場合は、このメールを破棄してください。</p>
          </div>
          <p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:#64748b;">ボタンが開けない場合は、以下のURLをブラウザに貼り付けてください。</p>
          <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.7;color:#334155;">{safe_link}</p>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _email_text(email: str, link: str) -> str:
    app_name = _app_name()
    return (
        f"{app_name} 管理画面へのログインリンクを発行しました。\n\n"
        f"送信先: {email}\n\n"
        "以下のURLを開くと、パスワード入力なしでログインが完了します。\n"
        f"{link}\n\n"
        "心当たりがない場合は、このメールを破棄してください。"
    )


def _send_mail(request_id: str, email: str, link: str) -> dict[str, Any]:
    if not SEND_MAIL_SERVICE_URL:
        raise RuntimeError("SEND_MAIL_SERVICE_URL is not configured")
    response = requests.post(
        f"{SEND_MAIL_SERVICE_URL}/send",
        json={
            "request_id": request_id,
            "input": {
                "to": [email],
                "subject": f"{_app_name()} 管理画面へのログインリンク",
                "html": _email_html(email, link),
                "text": _email_text(email, link),
            },
            "operation_metadata": {"source": "send_admin_sign_in_link"},
        },
        headers={"Content-Type": "application/json"},
        timeout=90,
    )
    body = response.json()
    if response.status_code >= 400 or body.get("status") != "success":
        raise RuntimeError(f"send-mail returned error: {body}")
    return body.get("output") or {}


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=120)
def send_admin_sign_in_link(req: https_fn.CallableRequest) -> dict[str, Any]:
    data = req.data if isinstance(req.data, dict) else {}
    email = str(data.get("email") or "").strip().lower()
    continue_url = str(data.get("continueUrl") or "").strip()
    project_id = _project_id()

    if not project_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Firebase project ID を解決できません",
        )
    if not email or not EMAIL_RE.match(email):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="有効なメールアドレスを入力してください",
        )

    try:
        safe_continue_url = _validate_continue_url(continue_url, project_id)
    except ValueError as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=str(exc),
        ) from exc

    _assert_known_admin_user(email)
    _check_rate_limit(email)

    try:
        link = _generate_email_link(email, safe_continue_url, project_id)
        output = _send_mail(
            request_id=f"authEmailLink_{hashlib.sha1(email.encode('utf-8')).hexdigest()[:12]}",
            email=email,
            link=link,
        )
    except Exception as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"ログインメールの送信に失敗しました: {str(exc)[:500]}",
        ) from exc

    return {"sent": True, "email": email, "output": output}


@https_fn.on_call(region="asia-northeast1", memory=512, timeout_sec=60)
def dev_admin_sign_in(req: https_fn.CallableRequest) -> dict[str, Any]:
    """Issue a Firebase custom token for allowlisted development users only."""

    data = req.data if isinstance(req.data, dict) else {}
    email = str(data.get("email") or "").strip().lower()
    project_id = _project_id()

    if not project_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Firebase project ID を解決できません",
        )
    if not email or not EMAIL_RE.match(email):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="有効なメールアドレスを入力してください",
        )

    _assert_dev_auth_bypass_allowed(email, project_id)
    user = _assert_known_admin_user(email)

    try:
        _ensure_dev_super_workspace(user, email)
        token = auth.create_custom_token(user.uid)
    except Exception as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"開発ログインの準備に失敗しました: {str(exc)[:500]}",
        ) from exc
    custom_token = token.decode("utf-8") if isinstance(token, bytes) else str(token)

    return {
        "customToken": custom_token,
        "email": email,
        "uid": user.uid,
        "projectId": project_id,
    }
