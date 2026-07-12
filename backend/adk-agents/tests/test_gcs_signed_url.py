"""Tests for Cloud Run compatible GCS signed URL helper."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from common.gcs_signed_url import generate_blob_signed_url


def test_generate_blob_signed_url_uses_service_account_email():
    credentials = MagicMock()
    credentials.token = "test-token"
    credentials.service_account_email = "runner@project.iam.gserviceaccount.com"

    blob = MagicMock()
    blob.generate_signed_url.return_value = "https://signed.example/img.png"

    with (
        patch("common.gcs_signed_url.google.auth.default", return_value=(credentials, "p")),
        patch("common.gcs_signed_url.storage.Client") as client_cls,
    ):
        client_cls.return_value.bucket.return_value.blob.return_value = blob
        url = generate_blob_signed_url(
            bucket_name="b",
            blob_name="app/u/s/f/0",
            expiration_seconds=3600,
        )

    assert url == "https://signed.example/img.png"
    kwargs = blob.generate_signed_url.call_args.kwargs
    assert kwargs["service_account_email"] == "runner@project.iam.gserviceaccount.com"
    assert kwargs["access_token"] == "test-token"
