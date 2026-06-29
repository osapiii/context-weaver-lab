from __future__ import annotations

from cryptography.fernet import Fernet
from google.adk.sessions.state import State

from vibe_related_context.schemas import RelatedContextResult
from vibe_related_context.tools import (
    fetch_knowledge_document_candidates,
    normalize_slack_message,
    normalize_pull_request,
    read_related_context_request,
    unprotect_github_token,
    unprotect_slack_token,
)


class _ToolContext:
    def __init__(self, state):
        self.state = state


def test_unprotect_github_token_supports_plain_and_fernet(monkeypatch):
    key = Fernet.generate_key()
    fernet = Fernet(key)
    encrypted = fernet.encrypt(b"gho_test").decode("utf-8")

    assert unprotect_github_token({"mode": "plain", "value": "plain-token"}) == "plain-token"

    monkeypatch.setenv("GITHUB_TOKEN_ENCRYPTION_KEY", key.decode("utf-8"))
    assert (
        unprotect_github_token({"mode": "fernet", "value": encrypted})
        == "gho_test"
    )


def test_unprotect_slack_token_supports_plain_and_fernet(monkeypatch):
    key = Fernet.generate_key()
    fernet = Fernet(key)
    encrypted = fernet.encrypt(b"xoxb-test").decode("utf-8")

    assert unprotect_slack_token({"mode": "plain", "value": "plain-token"}) == "plain-token"

    monkeypatch.setenv("SLACK_TOKEN_ENCRYPTION_KEY", key.decode("utf-8"))
    assert (
        unprotect_slack_token({"mode": "fernet", "value": encrypted})
        == "xoxb-test"
    )


def test_read_related_context_request_reads_adk_state_object():
    state = State(
        value={
            "vibe_related_context": {
                "setup": {
                    "provider": "github",
                    "organization_id": "org-1",
                    "space_id": "space-1",
                    "user_id": "user-1",
                    "repo_full_name": "enostech/app",
                },
                "payload": {
                    "application": {"name": "HAIFF"},
                    "operation_video": {"id": "video-1", "title": "投げ込み"},
                },
            }
        },
        delta={},
    )

    result = read_related_context_request(_ToolContext(state))

    assert result["provider"] == "github"
    assert result["repoFullName"] == "enostech/app"
    assert result["operationVideo"]["id"] == "video-1"


def test_read_related_context_request_reads_knowledge_provider_and_filespace():
    state = State(
        value={
            "vibe_related_context": {
                "setup": {
                    "provider": "knowledge",
                    "organization_id": "org-1",
                    "space_id": "space-1",
                    "file_space_id": "fs-1",
                },
                "payload": {
                    "application": {"name": "HAIFF", "fileSpaceId": "fs-from-app"},
                    "operation_video": {"id": "video-1", "title": "投げ込み"},
                },
            }
        },
        delta={},
    )

    result = read_related_context_request(_ToolContext(state))

    assert result["provider"] == "knowledge"
    assert result["fileSpaceId"] == "fs-1"


def test_fetch_knowledge_document_candidates_requires_filespace():
    state = State(
        value={
            "vibe_related_context": {
                "setup": {
                    "provider": "knowledge",
                    "organization_id": "org-1",
                    "space_id": "space-1",
                },
                "payload": {"application": {"name": "HAIFF"}},
            }
        },
        delta={},
    )

    result = fetch_knowledge_document_candidates(_ToolContext(state))

    assert result["ok"] is False
    assert "fileSpaceId" in result["error"]


def test_normalize_pull_request_handles_missing_fields():
    result = normalize_pull_request(
        {
            "number": 12,
            "title": "Add zapping import",
            "html_url": "https://github.com/enostech/app/pull/12",
            "state": "open",
        }
    )

    assert result["number"] == 12
    assert result["title"] == "Add zapping import"
    assert result["author"] == ""
    assert result["labels"] == []
    assert result["files"] == []


def test_normalize_slack_message_handles_search_result_shape():
    result = normalize_slack_message(
        {
            "channel": {"id": "C123", "name": "product"},
            "ts": "1782640000.000100",
            "user": "U123",
            "text": "Google Drive同期の取り込みを改善しました",
            "permalink": "https://example.slack.com/archives/C123/p1782640000000100",
        }
    )

    assert result["channelId"] == "C123"
    assert result["channelName"] == "product"
    assert result["messageTs"] == "1782640000.000100"
    assert result["author"] == "U123"


def test_related_context_result_schema_accepts_reasoned_prs():
    parsed = RelatedContextResult.model_validate(
        {
            "schemaVersion": "vibe-control-related-context-v1",
            "generatedAt": "2026-06-28T00:00:00Z",
            "status": "completed",
            "github": {
                "repoFullName": "enostech/app",
                "checkedAt": "2026-06-28T00:00:00Z",
                "pullRequests": [
                    {
                        "number": 12,
                        "title": "Add zapping import",
                        "htmlUrl": "https://github.com/enostech/app/pull/12",
                        "relevanceScore": 88,
                        "reason": "動画の投げ込み操作とPRタイトルが一致しています。",
                        "matchedSignals": ["投げ込み", "zapping"],
                    }
                ],
            },
            "notes": [],
        }
    )

    assert parsed.github is not None
    assert parsed.github.pullRequests[0].relevanceScore == 88


def test_related_context_result_schema_accepts_reasoned_slack_messages():
    parsed = RelatedContextResult.model_validate(
        {
            "schemaVersion": "vibe-control-related-context-v1",
            "generatedAt": "2026-06-28T00:00:00Z",
            "status": "completed",
            "slack": {
                "teamId": "T123",
                "teamName": "ENOSTECH",
                "checkedAt": "2026-06-28T00:00:00Z",
                "messages": [
                    {
                        "channelId": "C123",
                        "channelName": "product",
                        "messageTs": "1782640000.000100",
                        "permalink": "https://example.slack.com/archives/C123/p1782640000000100",
                        "text": "Google Drive同期の取り込みを改善しました",
                        "relevanceScore": 86,
                        "reason": "動画のGoogle Drive同期操作と投稿本文が一致しています。",
                        "matchedSignals": ["Google Drive同期"],
                    }
                ],
            },
            "notes": [],
        }
    )

    assert parsed.slack is not None
    assert parsed.slack.messages[0].channelName == "product"


def test_related_context_result_schema_accepts_reasoned_knowledge_documents():
    parsed = RelatedContextResult.model_validate(
        {
            "schemaVersion": "vibe-control-related-context-v1",
            "generatedAt": "2026-06-28T00:00:00Z",
            "status": "completed",
            "knowledge": {
                "fileSpaceId": "fs-1",
                "checkedAt": "2026-06-28T00:00:00Z",
                "documents": [
                    {
                        "documentId": "doc-1",
                        "name": "fileSearchStores/fs-1/documents/doc-1",
                        "displayName": "architecture.md",
                        "description": "AI取り込み設計",
                        "mimeType": "text/markdown",
                        "sourceKind": "upload",
                        "gcsUrl": "gs://bucket/path/architecture.md",
                        "bucketName": "bucket",
                        "filePath": "path/architecture.md",
                        "relevanceScore": 91,
                        "reason": "動画のAI取り込み操作と設計書の説明が一致しています。",
                        "matchedSignals": ["AI取り込み", "設計書"],
                    }
                ],
            },
            "notes": [],
        }
    )

    assert parsed.knowledge is not None
    assert parsed.knowledge.documents[0].displayName == "architecture.md"
