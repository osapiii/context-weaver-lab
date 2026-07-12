"""Unit tests for send-mail microservice."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SENDGRID_API_KEY", "test-key")
os.environ.setdefault("SENDGRID_FROM_EMAIL", "noreply@example.com")

from main import app  # noqa: E402

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@patch("main.SendGridAPIClient")
def test_send_success(mock_client_cls: MagicMock) -> None:
    mock_response = MagicMock()
    mock_response.status_code = 202
    mock_client_cls.return_value.send.return_value = mock_response

    response = client.post(
        "/send",
        json={
            "request_id": "email_test_1",
            "input": {
                "to": ["user@example.com"],
                "subject": "Test",
                "html": "<p>Hello</p>",
                "text": "Hello",
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["output"]["recipientCount"] == 1


def test_send_missing_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SENDGRID_API_KEY", raising=False)
    response = client.post(
        "/send",
        json={
            "request_id": "email_test_2",
            "input": {
                "to": ["user@example.com"],
                "subject": "Test",
                "html": "<p>Hello</p>",
            },
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "error"
