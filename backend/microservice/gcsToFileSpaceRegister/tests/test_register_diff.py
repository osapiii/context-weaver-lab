"""
Tests for /register/diff.
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_register_diff_classifies_add_update_remove(app_module, monkeypatch):
    def fake_mirror(**_):
        return {
            "drv-A": [
                {
                    "objectPath": "org/sp/fs/drv-A/2024-06-01T00_00_00.000Z.pdf",
                    "driveModifiedTime": "2024-06-01T00:00:00.000Z",
                    "size": 1,
                    "contentType": "application/pdf",
                    "metadata": {"driveOriginalName": "a.pdf"},
                }
            ],
            "drv-B": [
                {
                    "objectPath": "org/sp/fs/drv-B/2024-01-01T00_00_00.000Z.pdf",
                    "driveModifiedTime": "2024-01-01T00:00:00.000Z",
                    "size": 2,
                    "contentType": "application/pdf",
                    "metadata": {"driveOriginalName": "b.pdf"},
                }
            ],
        }

    def fake_existing(**_):
        return {
            "drv-B": {
                "firestoreDocId": "drive_drv-B",
                "name": "fileSearchStores/fs/documents/drive_drv-B",
                "agentSearchDocumentId": "drive_drv-B",
                "driveModifiedTime": "2024-01-01T00:00:00.000Z",
                "bucketName": "test-project-drive-mirror",
                "filePath": "org/sp/fs/drv-B/2024-01-01T00_00_00.000Z.pdf",
                "mimeType": "application/pdf",
            },
            "drv-stale": {
                "firestoreDocId": "drive_drv-stale",
                "name": "fileSearchStores/fs/documents/drive_drv-stale",
                "agentSearchDocumentId": "drive_drv-stale",
                "driveModifiedTime": "2024-01-01T00:00:00.000Z",
                "bucketName": "test-project-drive-mirror",
                "filePath": "org/sp/fs/drv-stale/old.pdf",
                "mimeType": "application/pdf",
            },
        }

    monkeypatch.setattr(app_module, "_list_mirror_inventory", fake_mirror)
    monkeypatch.setattr(app_module, "_list_existing_documents", fake_existing)

    client = TestClient(app_module.app)
    resp = client.post(
        "/register/diff",
        json={
            "organizationId": "org",
            "spaceId": "sp",
            "fileSpaceId": "fs",
            "operationType": "syncFolder",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["counts"]["toAdd"] == 1
    assert body["toAdd"][0]["driveFileId"] == "drv-A"
    # drv-B is unchanged (same modifiedTime)
    assert body["counts"]["unchanged"] == 1
    assert body["counts"]["toRemove"] == 1
    assert body["toRemove"][0]["driveFileId"] == "drv-stale"
    assert body["toRemove"][0]["agentSearchDocumentId"] == "drive_drv-stale"


def test_register_diff_single_folder_skips_remove(app_module, monkeypatch):
    monkeypatch.setattr(app_module, "_list_mirror_inventory", lambda **_: {})
    monkeypatch.setattr(
        app_module,
        "_list_existing_documents",
        lambda **_: {
            "drv-X": {
                "firestoreDocId": "drive_drv-X",
                "name": "n",
                "driveModifiedTime": "2024-01-01T00:00:00.000Z",
            }
        },
    )
    client = TestClient(app_module.app)
    resp = client.post(
        "/register/diff",
        json={
            "organizationId": "org",
            "spaceId": "sp",
            "fileSpaceId": "fs",
            "operationType": "syncSingleFolder",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["counts"]["toRemove"] == 0
