"""
Send Mail Microservice (Cloud Run)

POST /send — SendGrid でトランザクションメールを送信する。
"""

from __future__ import annotations

import os
import traceback
from typing import Any

from fastapi import FastAPI, Request
from pydantic import BaseModel, Field, field_validator
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Content, Email, Mail, To

app = FastAPI(title="send-mail")


class SendMailInput(BaseModel):
    to: list[str] = Field(min_length=1)
    subject: str = Field(min_length=1)
    html: str = Field(min_length=1)
    text: str | None = None
    reply_to: str | None = None

    @field_validator("to")
    @classmethod
    def validate_recipients(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item and item.strip()]
        if not cleaned:
            raise ValueError("to must contain at least one email address")
        return cleaned


class SendMailRequest(BaseModel):
    request_id: str = "unknown"
    input: SendMailInput
    operation_metadata: dict[str, Any] = Field(default_factory=dict)


def _from_email() -> str:
    return (os.getenv("SENDGRID_FROM_EMAIL") or "").strip()


def _from_name() -> str:
    return (os.getenv("SENDGRID_FROM_NAME") or "EN AIstudio").strip()


def _sendgrid_api_key() -> str:
    return (os.getenv("SENDGRID_API_KEY") or "").strip()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/send")
async def send_mail(request: Request) -> dict[str, Any]:
    request_id = "unknown"
    try:
        body = await request.json()
        request_id = str(body.get("request_id") or "unknown")
        validated = SendMailRequest(**body)

        api_key = _sendgrid_api_key()
        from_email = _from_email()
        if not api_key:
            return {
                "status": "error",
                "request_id": request_id,
                "error": {
                    "type": "ConfigurationError",
                    "message": "SENDGRID_API_KEY is not configured",
                },
            }
        if not from_email:
            return {
                "status": "error",
                "request_id": request_id,
                "error": {
                    "type": "ConfigurationError",
                    "message": "SENDGRID_FROM_EMAIL is not configured",
                },
            }

        message = Mail(
            from_email=Email(from_email, _from_name()),
            to_emails=[To(addr) for addr in validated.input.to],
            subject=validated.input.subject,
            html_content=Content("text/html", validated.input.html),
        )
        if validated.input.text:
            message.add_content(Content("text/plain", validated.input.text))
        if validated.input.reply_to:
            message.reply_to = Email(validated.input.reply_to)

        client = SendGridAPIClient(api_key)
        response = client.send(message)
        status_code = int(response.status_code)

        if status_code >= 400:
            return {
                "status": "error",
                "request_id": request_id,
                "error": {
                    "type": "EmailServiceError",
                    "message": f"SendGrid returned HTTP {status_code}",
                    "status_code": status_code,
                },
            }

        return {
            "status": "success",
            "request_id": request_id,
            "output": {
                "provider": "sendgrid",
                "statusCode": status_code,
                "recipientCount": len(validated.input.to),
            },
        }
    except Exception as exc:
        return {
            "status": "error",
            "request_id": request_id,
            "error": {
                "type": "InternalError",
                "message": str(exc)[:2000],
                "traceback": traceback.format_exc()[:4000],
            },
        }
