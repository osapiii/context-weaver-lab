"""
Tests for /register/apply-batch — stubs context-store HTTP + Firestore.
"""

from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient


def test_apply_batch_adds_new_documents(app_module, monkeypatch):
    import_calls: list[dict] = []

    def _fake_import(**kw):
        import_calls.append(kw)
        return kw.get("document_id") or "generated-id", None

    monkeypatch.setattr(app_module, "_context_store_import", _fake_import)
    monkeypatch.setattr(app_module, "_context_store_delete", lambda **kw: (True, None))

    upsert_calls: list[dict] = []

    def _fake_upsert(**kw):
        upsert_calls.append(kw)

    monkeypatch.setattr(app_module, "_upsert_document", _fake_upsert)

    client = TestClient(app_module.app)
    resp = client.post(
        "/register/apply-batch",
        json={
            "organizationId": "org",
            "spaceId": "sp",
            "fileSpaceId": "fs",
            "requestId": "req-1",
            "operationMetadata": {"organizationId": "org", "spaceId": "sp"},
            "items": [
                {
                    "driveFileId": "drv-A",
                    "mirrorObjectPath": "org/sp/fs/drv-A/2024-06-01T00_00_00.000Z.pdf",
                    "driveModifiedTime": "2024-06-01T00:00:00.000Z",
                    "contentType": "application/pdf",
                    "metadata": {
                        "driveOriginalName": "a.pdf",
                        "driveOriginalMime": "application/pdf",
                    },
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["added"] == 1
    assert body["updated"] == 0
    assert body["failed"] == 0
    assert len(upsert_calls) == 1
    assert upsert_calls[0]["drive_file_id"] == "drv-A"
    assert import_calls[0]["document_id"] == "drive_drv-A"


def test_apply_batch_updates_deletes_old_agent_doc_id(app_module, monkeypatch):
    delete_calls: list[dict] = []
    import_calls: list[dict] = []

    monkeypatch.setattr(
        app_module,
        "_context_store_delete",
        lambda **kw: delete_calls.append(kw) or (True, None),
    )
    monkeypatch.setattr(
        app_module,
        "_context_store_import",
        lambda **kw: import_calls.append(kw) or ("drive_drv-A", None),
    )
    monkeypatch.setattr(app_module, "_upsert_document", lambda **_kw: None)

    client = TestClient(app_module.app)
    resp = client.post(
        "/register/apply-batch",
        json={
            "organizationId": "org",
            "spaceId": "sp",
            "fileSpaceId": "fs",
            "requestId": "req-1",
            "items": [
                {
                    "driveFileId": "drv-A",
                    "mirrorObjectPath": "org/sp/fs/drv-A/new.pdf",
                    "driveModifiedTime": "2024-06-02T00:00:00.000Z",
                    "contentType": "application/pdf",
                    "existing": {
                        "firestoreDocId": "drive_drv-A",
                        "agentSearchDocumentId": "old-uuid-agent-id",
                    },
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["updated"] == 1
    assert delete_calls[0]["document_id"] == "old-uuid-agent-id"
    assert import_calls[0]["document_id"] == "drive_drv-A"


def test_apply_batch_marks_failure_when_context_store_returns_error(
    app_module, monkeypatch
):
    monkeypatch.setattr(
        app_module,
        "_context_store_import",
        lambda **kw: (None, "HTTP 503: unavailable"),
    )
    monkeypatch.setattr(
        app_module, "_context_store_delete", lambda **kw: (True, None)
    )
    monkeypatch.setattr(app_module, "_upsert_document", lambda **_kw: None)

    client = TestClient(app_module.app)
    resp = client.post(
        "/register/apply-batch",
        json={
            "organizationId": "org",
            "spaceId": "sp",
            "fileSpaceId": "fs",
            "requestId": "req-1",
            "items": [
                {
                    "driveFileId": "drv-A",
                    "mirrorObjectPath": "org/sp/fs/drv-A/x.pdf",
                    "driveModifiedTime": "2024-06-01T00:00:00.000Z",
                    "contentType": "application/pdf",
                }
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["added"] == 0
    assert body["failed"] == 1
    assert body["failures"][0]["reason"].startswith("HTTP 503")


def test_apply_batch_rejects_more_than_10(app_module):
    client = TestClient(app_module.app)
    items = [
        {
            "driveFileId": f"d-{i}",
            "mirrorObjectPath": f"org/sp/fs/d-{i}/x.pdf",
            "driveModifiedTime": "2024-01-01T00:00:00.000Z",
        }
        for i in range(11)
    ]
    resp = client.post(
        "/register/apply-batch",
        json={
            "organizationId": "org",
            "spaceId": "sp",
            "fileSpaceId": "fs",
            "items": items,
        },
    )
    assert resp.status_code == 400
    assert "must be <= 10" in resp.text


def test_remove_batch_deletes_documents(app_module, monkeypatch):
    delete_calls: list[dict] = []

    monkeypatch.setattr(
        app_module,
        "_context_store_delete",
        lambda **kw: delete_calls.append(kw) or (True, None),
    )

    mock_db = MagicMock()
    mock_collection = MagicMock()
    mock_doc = MagicMock()
    mock_collection.document.return_value = mock_doc
    mock_db.collection.return_value = mock_collection
    monkeypatch.setattr(app_module, "_get_db", lambda: mock_db)

    client = TestClient(app_module.app)
    resp = client.post(
        "/register/remove-batch",
        json={
            "organizationId": "org",
            "spaceId": "sp",
            "fileSpaceId": "fs",
            "requestId": "req-rm",
            "items": [
                {
                    "driveFileId": "drv-X",
                    "firestoreDocId": "drive_drv-X",
                    "agentSearchDocumentId": "drive_drv-X",
                    "name": "fileSearchStores/fs/documents/drive_drv-X",
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["removed"] == 1
    assert body["failed"] == 0
    assert delete_calls[0]["document_id"] == "drive_drv-X"
    mock_doc.delete.assert_called_once()
