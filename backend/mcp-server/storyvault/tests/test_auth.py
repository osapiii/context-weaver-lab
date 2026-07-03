from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from auth import authenticate_bearer_token
from token_utils import hash_token, make_mcp_token


class FakeSnapshot:
    def __init__(self, data):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data


class FakeDocument:
    def __init__(self, data):
        self.data = data
        self.updated = None

    def get(self):
        return FakeSnapshot(self.data)

    def update(self, payload):
        self.updated = payload

    def collection(self, _name):
        return FakeCollection(self)


class FakeCollection:
    def __init__(self, document):
        self.document_obj = document

    def document(self, _document_id):
        return self.document_obj

    def collection(self, _name):
        return self


class FakeDb:
    def __init__(self, document):
        self.document = document

    def collection(self, _name):
        return FakeCollection(self.document)


def test_authenticate_firestore_token_accepts_hash_and_scopes():
    token = make_mcp_token(
        organization_id="org",
        space_id="space",
        connection_id="conn",
        secret="secret",
    )
    document = FakeDocument(
        {
            "tokenHash": hash_token(token),
            "externalAgent": "codex",
            "scopes": ["context:read"],
            "allowedApplicationIds": ["app-1"],
        }
    )

    principal = authenticate_bearer_token(f"Bearer {token}", db=FakeDb(document))

    assert principal.organization_id == "org"
    assert principal.space_id == "space"
    assert principal.connection_id == "conn"
    assert principal.can_access_application("app-1")
    assert not principal.can_access_application("app-2")
    assert document.updated is not None
    assert isinstance(document.updated["lastUsedAt"], datetime)


def test_authenticate_firestore_token_rejects_revoked_connection():
    token = make_mcp_token(
        organization_id="org",
        space_id="space",
        connection_id="conn",
        secret="secret",
    )
    document = FakeDocument(
        {
            "tokenHash": hash_token(token),
            "revokedAt": datetime.now(timezone.utc),
        }
    )

    with pytest.raises(HTTPException) as exc:
        authenticate_bearer_token(f"Bearer {token}", db=FakeDb(document))

    assert exc.value.status_code == 403
