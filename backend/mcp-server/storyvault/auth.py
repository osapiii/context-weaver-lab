"""Bearer-token authentication for the StoryVault MCP boundary."""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import Header, HTTPException
from google.cloud import firestore

from token_utils import hash_token, parse_mcp_token


@dataclass(frozen=True)
class McpPrincipal:
    organization_id: str
    space_id: str
    connection_id: str
    scopes: frozenset[str]
    allowed_application_ids: frozenset[str]
    external_agent: str

    def require_scope(self, scope: str) -> None:
        if scope not in self.scopes:
            raise HTTPException(status_code=403, detail=f"Missing MCP scope: {scope}")

    def can_access_application(self, application_id: str) -> bool:
        return not self.allowed_application_ids or application_id in self.allowed_application_ids


def _as_string_set(value: Any) -> frozenset[str]:
    if not isinstance(value, list):
        return frozenset()
    return frozenset(str(item).strip() for item in value if str(item).strip())


def _dev_principal_for_token(token: str) -> McpPrincipal | None:
    dev_token = (
        os.getenv("STORYVAULT_MCP_DEV_TOKEN", "").strip()
        or os.getenv("STORYVAULT_MCP_DEV_TOKEN", "").strip()
    )
    if not dev_token or token != dev_token:
        return None
    organization_id = os.getenv(
        "STORYVAULT_MCP_DEV_ORGANIZATION_ID",
        os.getenv("STORYVAULT_MCP_DEV_ORGANIZATION_ID", "local-org"),
    )
    space_id = os.getenv(
        "STORYVAULT_MCP_DEV_SPACE_ID",
        os.getenv("STORYVAULT_MCP_DEV_SPACE_ID", "local-space"),
    )
    scopes = _as_string_set(
        os.getenv(
            "STORYVAULT_MCP_DEV_SCOPES",
            os.getenv("STORYVAULT_MCP_DEV_SCOPES", "context:read"),
        ).split(",")
    )
    allowed = _as_string_set(
        [
            item
            for item in os.getenv(
                "STORYVAULT_MCP_DEV_APPLICATION_IDS",
                os.getenv("STORYVAULT_MCP_DEV_APPLICATION_IDS", ""),
            ).split(",")
            if item.strip()
        ]
    )
    return McpPrincipal(
        organization_id=organization_id,
        space_id=space_id,
        connection_id="env-dev-token",
        scopes=scopes,
        allowed_application_ids=allowed,
        external_agent=os.getenv(
            "STORYVAULT_MCP_DEV_EXTERNAL_AGENT",
            os.getenv("STORYVAULT_MCP_DEV_EXTERNAL_AGENT", "codex-local"),
        ),
    )


def _connection_ref(db: firestore.Client, organization_id: str, space_id: str, connection_id: str):
    return (
        db.collection("organizations")
        .document(organization_id)
        .collection("spaces")
        .document(space_id)
        .collection("storyVaultMcpConnections")
        .document(connection_id)
    )


def authenticate_bearer_token(
    authorization: str | None,
    *,
    db: firestore.Client | None = None,
) -> McpPrincipal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    dev_principal = _dev_principal_for_token(token)
    if dev_principal is not None:
        return dev_principal

    try:
        parsed = parse_mcp_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    client = db or firestore.Client()
    ref = _connection_ref(
        client,
        parsed.organization_id,
        parsed.space_id,
        parsed.connection_id,
    )
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=401, detail="MCP connection not found")
    doc = snap.to_dict() or {}
    if doc.get("revokedAt"):
        raise HTTPException(status_code=403, detail="MCP connection has been revoked")
    if str(doc.get("tokenHash") or "") != hash_token(token):
        raise HTTPException(status_code=401, detail="Invalid MCP token")

    scopes = _as_string_set(doc.get("scopes"))
    if not scopes:
        scopes = frozenset({"context:read"})
    allowed = _as_string_set(doc.get("allowedApplicationIds"))
    ref.update({"lastUsedAt": datetime.now(timezone.utc)})
    return McpPrincipal(
        organization_id=parsed.organization_id,
        space_id=parsed.space_id,
        connection_id=parsed.connection_id,
        scopes=scopes,
        allowed_application_ids=allowed,
        external_agent=str(doc.get("externalAgent") or "codex"),
    )


def require_mcp_principal(authorization: str | None = Header(default=None)) -> McpPrincipal:
    return authenticate_bearer_token(authorization)
