"""Token utilities for StoryVault remote MCP connections."""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
from dataclasses import dataclass
from typing import Any

TOKEN_PREFIX = "sv_mcp_"
LEGACY_TOKEN_PREFIX = "vc_mcp_"


@dataclass(frozen=True)
class ParsedMcpToken:
    organization_id: str
    space_id: str
    connection_id: str
    secret: str


def _b64url_encode(payload: bytes) -> str:
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def _b64url_decode(payload: str) -> bytes:
    padding = "=" * (-len(payload) % 4)
    return base64.urlsafe_b64decode((payload + padding).encode("ascii"))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def make_mcp_token(
    *,
    organization_id: str,
    space_id: str,
    connection_id: str,
    secret: str | None = None,
) -> str:
    token_secret = secret or secrets.token_urlsafe(32)
    meta = {
        "organizationId": organization_id,
        "spaceId": space_id,
        "connectionId": connection_id,
    }
    encoded = _b64url_encode(json.dumps(meta, separators=(",", ":")).encode("utf-8"))
    return f"{TOKEN_PREFIX}{encoded}.{token_secret}"


def parse_mcp_token(token: str) -> ParsedMcpToken:
    if token.startswith(TOKEN_PREFIX):
        body = token[len(TOKEN_PREFIX) :]
    elif token.startswith(LEGACY_TOKEN_PREFIX):
        body = token[len(LEGACY_TOKEN_PREFIX) :]
    else:
        raise ValueError("Unsupported token prefix")
    try:
        encoded, secret = body.split(".", 1)
        meta: dict[str, Any] = json.loads(_b64url_decode(encoded))
    except Exception as exc:
        raise ValueError("Malformed MCP token") from exc
    organization_id = str(meta.get("organizationId") or "").strip()
    space_id = str(meta.get("spaceId") or "").strip()
    connection_id = str(meta.get("connectionId") or "").strip()
    if not organization_id or not space_id or not connection_id or not secret:
        raise ValueError("Incomplete MCP token")
    return ParsedMcpToken(
        organization_id=organization_id,
        space_id=space_id,
        connection_id=connection_id,
        secret=secret,
    )
