import os
import json
from unittest.mock import patch

from fastapi.testclient import TestClient

import server


class FakeReportPublisher:
    def publish(self, *, application, story, html, markdown, asset_manifest, ttl_seconds=86400):
        return {
            "schemaVersion": "storyvault-story-context-report-links-v1",
            "applicationId": application["id"],
            "storyId": story["id"],
            "storyKey": story["storyKey"],
            "title": story["title"],
            "generatedAt": "2026-06-29T00:00:00+00:00",
            "expiresAt": "2026-06-30T00:00:00+00:00",
            "recommendedForAgent": "markdown",
            "reports": {
                "html": {
                    "url": "https://storage.example.test/story-context.html",
                    "contentType": "text/html; charset=utf-8",
                    "bytes": len(html.encode("utf-8")),
                },
                "markdown": {
                    "url": "https://storage.example.test/story-context.md",
                    "contentType": "text/markdown; charset=utf-8",
                    "bytes": len(markdown.encode("utf-8")),
                },
            },
            "implementationContext": {"readThisFirst": "reports.markdown.url", "notes": []},
            "assets": {
                "signedUrlExpiresAt": asset_manifest.get("signedUrlExpiresAt"),
                "counts": asset_manifest.get("assetCounts") or {},
                "videos": [
                    {
                        "id": video.get("id"),
                        "downloadUrl": video.get("downloadUrl"),
                        "screenshotCount": len(video.get("screenshots") or []),
                    }
                    for video in asset_manifest.get("operationVideos", [])
                ],
            },
        }

    def publish_operation_video(self, *, application, context_manifest, html, markdown, ttl_seconds=86400):
        return {
            "schemaVersion": "storyvault-operation-video-context-report-links-v1",
            "applicationId": application["id"],
            "operationVideoId": context_manifest["operationVideoId"],
            "title": context_manifest["operationVideo"]["title"],
            "generatedAt": "2026-06-29T00:00:00+00:00",
            "expiresAt": "2026-06-30T00:00:00+00:00",
            "recommendedForAgent": "markdown",
            "reports": {
                "html": {
                    "url": "https://storage.example.test/operation-video-context.html",
                    "contentType": "text/html; charset=utf-8",
                    "bytes": len(html.encode("utf-8")),
                },
                "markdown": {
                    "url": "https://storage.example.test/operation-video-context.md",
                    "contentType": "text/markdown; charset=utf-8",
                    "bytes": len(markdown.encode("utf-8")),
                },
            },
            "implementationContext": {"readThisFirst": "reports.markdown.url", "notes": []},
            "counts": context_manifest.get("counts") or {},
            "linkedStories": [
                {"id": story.get("id"), "storyKey": story.get("storyKey"), "title": story.get("title")}
                for story in context_manifest.get("linkedStories", [])
            ],
        }


class FakeStore:
    def __init__(self, principal):
        self.principal = principal

    def list_applications(self, limit=20):
        return [{"id": "app-1", "name": "Demo App", "applicationKey": "APP"}]

    def list_stories(self, **kwargs):
        return [{"id": "story-1", "applicationId": kwargs["application_id"], "storyKey": "APP-ST-001"}]

    def list_operation_video_groups(self, **kwargs):
        return [
            {
                "id": "group-1",
                "applicationId": kwargs["application_id"],
                "name": "Existing operation videos",
                "description": "Videos captured before grouping was introduced.",
                "videoCount": 1,
            }
        ]

    def list_operation_videos(self, **kwargs):
        return [
            {
                "id": "video-1",
                "applicationId": kwargs["application_id"],
                "groupId": kwargs.get("operation_video_group_id") or "group-1",
                "groupNameSnapshot": "Existing operation videos",
                "title": "Demo operation video",
                "description": "A video that can fan out into multiple user stories.",
                "recordedAt": "2026-06-29T00:00:00+00:00",
                "videoGroup": {
                    "id": kwargs.get("operation_video_group_id") or "group-1",
                    "name": "Existing operation videos",
                    "description": "Videos captured before grouping was introduced.",
                    "videoCount": 1,
                },
            }
        ]

    def get_application(self, application_id):
        return {"id": application_id, "name": "Demo App", "repoFullName": "org/repo"}

    def get_story(self, story_id):
        return {
            "id": story_id,
            "applicationId": "app-1",
            "storyKey": "APP-ST-001",
            "title": "Demo story",
            "summary": "Summary",
            "userStory": "As a user...",
            "acceptanceCriteria": [],
        }

    def get_capability(self, capability_id):
        return None

    def evidence_for_story(self, **kwargs):
        return []

    def source_assets_by_ids(self, **kwargs):
        return []

    def get_story_asset_manifest(self, **kwargs):
        return {
            "schemaVersion": "vibe-control-story-assets-v1",
            "applicationId": kwargs["application_id"],
            "storyId": kwargs["story_id"],
            "assetCounts": {
                "sourceAssets": 1,
                "operationVideos": 1,
                "screenshots": 1,
                "githubPullRequests": 1,
                "knowledgeDocuments": 1,
            },
            "sourceAssets": [
                {
                    "id": "asset-1",
                    "kind": "source_asset",
                    "downloadUrl": "https://storage.example.test/journey.md",
                }
            ],
            "operationVideos": [
                {
                    "id": "video-1",
                    "kind": "operation_video",
                    "downloadUrl": "https://storage.example.test/video.webm",
                    "screenshots": [
                        {
                            "id": "frame-001",
                            "kind": "operation_video_screenshot",
                            "downloadUrl": "https://storage.example.test/frame.jpg",
                        }
                    ],
                }
            ],
            "githubPullRequests": [
                {
                    "repoFullName": "org/repo",
                    "number": 12,
                    "title": "Demo PR",
                    "htmlUrl": "https://github.com/org/repo/pull/12",
                }
            ],
            "knowledgeDocuments": [
                {
                    "documentId": "doc-1",
                    "displayName": "architecture.md",
                    "downloadUrl": "https://storage.example.test/architecture.md",
                    "relevanceScore": 91,
                    "reason": "設計書が操作動画と一致しています。",
                }
            ],
        }

    def get_operation_video_context_manifest(self, **kwargs):
        return {
            "schemaVersion": "vibe-control-operation-video-context-v1",
            "applicationId": kwargs["application_id"],
            "operationVideoId": kwargs["operation_video_id"],
            "videoGroup": {
                "id": "group-1",
                "name": "Existing operation videos",
                "description": "Videos captured before grouping was introduced.",
                "videoCount": 1,
            },
            "operationVideo": {
                "id": kwargs["operation_video_id"],
                "title": "Demo operation video",
                "downloadUrl": "https://storage.example.test/video.webm",
                "videoGroup": {
                    "id": "group-1",
                    "name": "Existing operation videos",
                },
                "screenshots": [
                    {
                        "id": "frame-001",
                        "downloadUrl": "https://storage.example.test/frame.jpg",
                    }
                ],
            },
            "linkedStories": [
                {
                    "id": "story-1",
                    "storyKey": "APP-ST-001",
                    "title": "Demo story",
                }
            ],
            "evidence": [
                {
                    "id": "evidence-1",
                    "storyId": "story-1",
                    "sourceAssetId": "asset-1",
                }
            ],
            "sourceAssets": [{"id": "asset-1"}],
            "githubPullRequests": [{"number": 12}],
            "knowledgeDocuments": [
                {
                    "documentId": "doc-1",
                    "displayName": "architecture.md",
                    "downloadUrl": "https://storage.example.test/architecture.md",
                    "relevanceScore": 91,
                    "reason": "設計書が操作動画と一致しています。",
                }
            ],
            "counts": {
                "linkedStories": 1,
                "evidence": 1,
                "sourceAssets": 1,
                "screenshots": 1,
                "githubPullRequests": 1,
                "knowledgeDocuments": 1,
            },
            "agentInstructions": ["Treat the operation video as the primary context object."],
        }


def _client(monkeypatch):
    monkeypatch.setenv("VIBE_CONTROL_MCP_DEV_TOKEN", "dev-token")
    monkeypatch.setenv("VIBE_CONTROL_MCP_DEV_ORGANIZATION_ID", "org")
    monkeypatch.setenv("VIBE_CONTROL_MCP_DEV_SPACE_ID", "space")
    return TestClient(server.app)


def test_initialize_and_tools_list(monkeypatch):
    client = _client(monkeypatch)
    response = client.post(
        "/mcp",
        headers={"Authorization": "Bearer dev-token"},
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
    )
    assert response.status_code == 200
    assert response.json()["result"]["serverInfo"]["name"] == "storyvault-mcp"

    response = client.post(
        "/mcp",
        headers={"Authorization": "Bearer dev-token"},
        json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
    )
    names = [tool["name"] for tool in response.json()["result"]["tools"]]
    assert names.index("list_operation_videos") < names.index("get_story_context")
    assert names.index("get_operation_video_context") < names.index("get_story_context")
    assert "list_operation_videos" in names
    assert "list_operation_video_groups" in names
    assert "get_operation_video_context" in names
    assert "get_story_context" in names
    assert "get_story_assets" not in names
    assert "submit_agent_plan" not in names


def test_tool_call_list_operation_video_groups(monkeypatch):
    client = _client(monkeypatch)
    with patch.object(server, "_store", side_effect=lambda principal: FakeStore(principal)):
        response = client.post(
            "/mcp",
            headers={"Authorization": "Bearer dev-token"},
            json={
                "jsonrpc": "2.0",
                "id": 8,
                "method": "tools/call",
                "params": {
                    "name": "list_operation_video_groups",
                    "arguments": {"applicationId": "app-1", "limit": 10},
                },
            },
        )

    assert response.status_code == 200
    text = response.json()["result"]["content"][0]["text"]
    payload = json.loads(text)
    assert payload[0]["id"] == "group-1"
    assert payload[0]["name"] == "Existing operation videos"


def test_tool_call_list_operation_videos(monkeypatch):
    client = _client(monkeypatch)
    with patch.object(server, "_store", side_effect=lambda principal: FakeStore(principal)):
        response = client.post(
            "/mcp",
            headers={"Authorization": "Bearer dev-token"},
            json={
                "jsonrpc": "2.0",
                "id": 6,
                "method": "tools/call",
                "params": {
                    "name": "list_operation_videos",
                    "arguments": {"applicationId": "app-1", "limit": 10},
                },
            },
        )

    assert response.status_code == 200
    text = response.json()["result"]["content"][0]["text"]
    payload = json.loads(text)
    assert payload[0]["id"] == "video-1"
    assert payload[0]["title"] == "Demo operation video"
    assert payload[0]["videoGroup"]["id"] == "group-1"


def test_tool_call_get_operation_video_context(monkeypatch):
    client = _client(monkeypatch)
    with (
        patch.object(server, "_store", side_effect=lambda principal: FakeStore(principal)),
        patch.object(server, "_report_publisher", return_value=FakeReportPublisher()),
    ):
        response = client.post(
            "/mcp",
            headers={"Authorization": "Bearer dev-token"},
            json={
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/call",
                "params": {
                    "name": "get_operation_video_context",
                    "arguments": {"applicationId": "app-1", "operationVideoId": "video-1"},
                },
            },
        )

    assert response.status_code == 200
    text = response.json()["result"]["content"][0]["text"]
    payload = json.loads(text)
    assert payload["schemaVersion"] == "vibe-control-operation-video-context-v1"
    assert payload["operationVideo"]["downloadUrl"] == "https://storage.example.test/video.webm"
    assert payload["videoGroup"]["name"] == "Existing operation videos"
    assert payload["linkedStories"][0]["storyKey"] == "APP-ST-001"
    assert payload["counts"]["linkedStories"] == 1
    assert payload["counts"]["knowledgeDocuments"] == 1
    assert payload["knowledgeDocuments"][0]["downloadUrl"] == "https://storage.example.test/architecture.md"
    assert payload["reports"]["html"]["url"] == "https://storage.example.test/operation-video-context.html"
    assert payload["reports"]["markdown"]["url"] == "https://storage.example.test/operation-video-context.md"
    assert "primary context object" in payload["agentInstructions"][0]


def test_tool_call_get_story_context(monkeypatch):
    client = _client(monkeypatch)
    with (
        patch.object(server, "_store", side_effect=lambda principal: FakeStore(principal)),
        patch.object(server, "_report_publisher", return_value=FakeReportPublisher()),
    ):
        response = client.post(
            "/mcp",
            headers={"Authorization": "Bearer dev-token"},
            json={
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "get_story_context",
                    "arguments": {"applicationId": "app-1", "storyId": "story-1"},
                },
            },
        )

    assert response.status_code == 200
    text = response.json()["result"]["content"][0]["text"]
    payload = json.loads(text)
    assert payload["schemaVersion"] == "storyvault-story-context-report-links-v1"
    assert payload["storyKey"] == "APP-ST-001"
    assert payload["recommendedForAgent"] == "markdown"
    assert payload["implementationContext"]["readThisFirst"] == "reports.markdown.url"
    assert payload["reports"]["html"]["url"] == "https://storage.example.test/story-context.html"
    assert payload["reports"]["markdown"]["url"] == "https://storage.example.test/story-context.md"
    assert payload["assets"]["videos"][0]["downloadUrl"] == "https://storage.example.test/video.webm"
    assert payload["assets"]["videos"][0]["screenshotCount"] == 1
    assert "<!doctype html>" not in text


def test_resource_read_story_context_markdown_still_returns_raw_markdown(monkeypatch):
    client = _client(monkeypatch)
    with patch.object(server, "_store", side_effect=lambda principal: FakeStore(principal)):
        response = client.post(
            "/mcp",
            headers={"Authorization": "Bearer dev-token"},
            json={
                "jsonrpc": "2.0",
                "id": 4,
                "method": "resources/read",
                "params": {"uri": "vibe://stories/story-1/context.md"},
            },
        )

    assert response.status_code == 200
    text = response.json()["result"]["contents"][0]["text"]
    assert text.startswith("# StoryVault Story Context: APP-ST-001")
    assert "https://storage.example.test/video.webm" in text


def test_dev_fixture_store_allows_local_smoke_without_firestore(monkeypatch):
    monkeypatch.setenv("VIBE_CONTROL_MCP_DEV_FIXTURE", "true")
    client = _client(monkeypatch)

    response = client.post(
        "/mcp",
        headers={"Authorization": "Bearer dev-token"},
        json={
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {"name": "list_applications", "arguments": {"limit": 1}},
        },
    )

    assert response.status_code == 200
    assert "fixture-app" in response.json()["result"]["content"][0]["text"]
