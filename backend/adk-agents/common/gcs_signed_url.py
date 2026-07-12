"""GCS V4 署名 URL — Cloud Run (compute 認証) 対応."""
from __future__ import annotations

import logging
from datetime import timedelta

import google.auth
from google.auth.transport import requests as auth_requests
from google.cloud import storage

logger = logging.getLogger(__name__)


def generate_blob_signed_url(
    *,
    bucket_name: str,
    blob_name: str,
    expiration_seconds: int,
    method: str = "GET",
) -> str:
    """Blob の署名付き URL を生成する.

    Cloud Run では compute 認証に秘密鍵がないため、service_account_email +
    access_token で IAM signBlob 経由の署名を行う.
    """
    credentials, _ = google.auth.default()
    auth_request = auth_requests.Request()
    if not credentials.token:
        credentials.refresh(auth_request)

    client = storage.Client(credentials=credentials)
    blob = client.bucket(bucket_name).blob(blob_name)

    sign_kwargs: dict[str, object] = {
        "version": "v4",
        "expiration": timedelta(seconds=expiration_seconds),
        "method": method,
    }
    sa_email = getattr(credentials, "service_account_email", None)
    token = credentials.token
    if isinstance(sa_email, str) and sa_email and token:
        sign_kwargs["service_account_email"] = sa_email
        sign_kwargs["access_token"] = token

    return blob.generate_signed_url(**sign_kwargs)
