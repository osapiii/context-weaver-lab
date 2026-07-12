"""Create a StoryVault MCP token and print its Firestore document payload."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from uuid import uuid4

from token_utils import hash_token, make_mcp_token


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--space-id", required=True)
    parser.add_argument("--connection-id", default="")
    parser.add_argument("--external-agent", default="codex")
    parser.add_argument("--allowed-application-id", action="append", default=[])
    parser.add_argument("--scope", action="append", default=["context:read"])
    args = parser.parse_args()
    connection_id = args.connection_id or f"mcp-{uuid4().hex[:12]}"
    token = make_mcp_token(
        organization_id=args.organization_id,
        space_id=args.space_id,
        connection_id=connection_id,
    )
    doc = {
        "tokenHash": hash_token(token),
        "externalAgent": args.external_agent,
        "allowedApplicationIds": args.allowed_application_id,
        "scopes": args.scope,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "revokedAt": None,
    }
    path = (
        f"organizations/{args.organization_id}/spaces/{args.space_id}/"
        f"storyVaultMcpConnections/{connection_id}"
    )
    print(json.dumps({"token": token, "firestorePath": path, "document": doc}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
