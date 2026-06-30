"""Remote MCP endpoint for StoryVault coding-agent context."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from google.cloud import storage

from auth import McpPrincipal, require_mcp_principal
from context_bundle import (
    build_operation_video_context_html,
    build_operation_video_context_markdown,
    build_story_context_html,
    build_story_context_markdown,
)
from report_links import (
    PublishedReport,
    ReportLinkBundle,
    StoryContextReportPublisher,
    build_report_link_response,
    safe_report_id,
)
from store import VibeControlStore

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

PROTOCOL_VERSION = "2025-06-18"

app = FastAPI(title="StoryVault MCP Server", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def _json_rpc_result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _json_rpc_error(request_id: Any, code: int, message: str, data: Any = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


def _bounded_int(value: Any, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _text_content(payload: Any) -> dict[str, Any]:
    if isinstance(payload, str):
        text = payload
    else:
        text = json.dumps(payload, ensure_ascii=False, indent=2)
    return {"content": [{"type": "text", "text": text}]}


def _tool_definitions() -> list[dict[str, Any]]:
    return [
        {
            "name": "list_applications",
            "description": "List StoryVault applications available to this MCP connection.",
            "inputSchema": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 50}},
                "additionalProperties": False,
            },
        },
        {
            "name": "list_stories",
            "description": "List user stories for an application. Use this when the user explicitly asks for stories; operation videos are the primary context object.",
            "inputSchema": {
                "type": "object",
                "required": ["applicationId"],
                "properties": {
                    "applicationId": {"type": "string"},
                    "status": {"type": "string"},
                    "capabilityId": {"type": "string"},
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                },
                "additionalProperties": False,
            },
        },
        {
            "name": "list_operation_videos",
            "description": "List operation videos for an application. Prefer this as the default entry point because a single video can generate multiple linked user stories.",
            "inputSchema": {
                "type": "object",
                "required": ["applicationId"],
                "properties": {
                    "applicationId": {"type": "string"},
                    "operationVideoGroupId": {"type": "string"},
                    "query": {"type": "string"},
                    "discoveryStatus": {"type": "string"},
                    "analysisStatus": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                },
                "additionalProperties": False,
            },
        },
        {
            "name": "list_operation_video_groups",
            "description": "List operation video groups for an application. Use this before list_operation_videos when the user wants to browse videos by group.",
            "inputSchema": {
                "type": "object",
                "required": ["applicationId"],
                "properties": {
                    "applicationId": {"type": "string"},
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                },
                "additionalProperties": False,
            },
        },
        {
            "name": "get_operation_video_context",
            "description": "Fetch an operation-video-centered context bundle with signed video/screenshot URLs, source assets, linked user stories, evidence, and pull requests. Use this when the user's request is ambiguous or video-oriented.",
            "inputSchema": {
                "type": "object",
                "required": ["applicationId", "operationVideoId"],
                "properties": {
                    "applicationId": {"type": "string"},
                    "operationVideoId": {"type": "string"},
                    "includeSignedUrls": {"type": "boolean"},
                    "signedUrlTtlSeconds": {"type": "integer", "minimum": 60, "maximum": 86400},
                    "reportUrlTtlSeconds": {"type": "integer", "minimum": 60, "maximum": 604800},
                },
                "additionalProperties": False,
            },
        },
        {
            "name": "get_story_context",
            "description": "Generate story-centered HTML and Markdown context reports. Use for explicit story work; otherwise prefer get_operation_video_context.",
            "inputSchema": {
                "type": "object",
                "required": ["applicationId", "storyId"],
                "properties": {
                    "applicationId": {"type": "string"},
                    "storyId": {"type": "string"},
                    "includeSignedUrls": {"type": "boolean"},
                    "signedUrlTtlSeconds": {"type": "integer", "minimum": 60, "maximum": 86400},
                    "reportUrlTtlSeconds": {"type": "integer", "minimum": 60, "maximum": 604800},
                },
                "additionalProperties": False,
            },
        },
        {
            "name": "push_knowledge_document",
            "description": "Push a local AI-editor file or text note into an application's FileSpace knowledge tank. Requires the knowledge:write MCP scope.",
            "inputSchema": {
                "type": "object",
                "required": ["applicationId", "fileName", "mimeType"],
                "anyOf": [
                    {"required": ["content"]},
                    {"required": ["contentBase64"]},
                ],
                "properties": {
                    "applicationId": {"type": "string"},
                    "fileName": {"type": "string"},
                    "mimeType": {"type": "string"},
                    "content": {
                        "type": "string",
                        "description": "UTF-8 text content. Use contentBase64 for binary files.",
                    },
                    "contentBase64": {
                        "type": "string",
                        "description": "Base64-encoded binary content. Default max size is 10 MiB.",
                    },
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "storyId": {"type": "string"},
                    "operationVideoId": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "sourceNote": {"type": "string"},
                },
                "additionalProperties": False,
            },
        },
    ]


def _resource_definitions() -> list[dict[str, Any]]:
    return [
        {
            "uri": "vibe://applications",
            "name": "StoryVault applications",
            "description": "Applications available to this MCP connection.",
            "mimeType": "application/json",
        }
    ]


def _store(principal: McpPrincipal) -> VibeControlStore:
    if (
        principal.connection_id == "env-dev-token"
        and (
            os.getenv("STORYVAULT_MCP_DEV_FIXTURE", "").lower() in {"1", "true", "yes"}
            or os.getenv("VIBE_CONTROL_MCP_DEV_FIXTURE", "").lower() in {"1", "true", "yes"}
        )
    ):
        return FixtureVibeControlStore(principal)  # type: ignore[return-value]
    return VibeControlStore(principal)


def _default_storage_bucket() -> str:
    return (
        str(os.getenv("STORYVAULT_MCP_DEFAULT_STORAGE_BUCKET") or "").strip()
        or str(os.getenv("VIBE_CONTROL_MCP_DEFAULT_STORAGE_BUCKET") or "").strip()
        or "vibe-control-dev.firebasestorage.app"
    )


def _report_bucket_name() -> str:
    return (
        str(os.getenv("STORYVAULT_MCP_REPORT_BUCKET") or "").strip()
        or str(os.getenv("VIBE_CONTROL_MCP_REPORT_BUCKET") or "").strip()
        or _default_storage_bucket()
    )


def _report_path_prefix() -> str:
    return str(os.getenv("STORYVAULT_MCP_REPORT_PATH_PREFIX") or "storyvault/reports").strip("/")


def _public_base_url() -> str:
    return (
        str(os.getenv("STORYVAULT_MCP_PUBLIC_BASE_URL") or "").strip().rstrip("/")
        or "https://storyvault-mcp-q2uwnmd3yq-an.a.run.app"
    )


def _report_publisher(store: Any) -> Any:
    if isinstance(store, FixtureVibeControlStore):
        return FixtureStoryContextReportPublisher()
    return StoryContextReportPublisher(
        storage_client=getattr(store, "storage", None),
        bucket_name=_report_bucket_name(),
        path_prefix=_report_path_prefix(),
        public_base_url=_public_base_url(),
    )


class FixtureVibeControlStore:
    """Explicit local fixture store for Codex MCP smoke tests without Firestore ADC."""

    def __init__(self, principal: McpPrincipal) -> None:
        self.principal = principal
        self.application = {
            "id": "fixture-app",
            "applicationKey": "FIX",
            "name": "Fixture StoryVault App",
            "repoFullName": "enostech/storyvault",
            "defaultBranch": "main",
            "fileSpaceId": "fixture-filespace",
        }
        self.story = {
            "id": "fixture-story",
            "applicationId": "fixture-app",
            "applicationKey": "FIX",
            "storyKey": "FIX-ST-001",
            "title": "Verify remote MCP context",
            "summary": "External coding agents can retrieve story context.",
            "userStory": "As a developer, I want StoryVault context inside Codex.",
            "status": "ready_for_dev",
            "reviewState": "ready",
            "driftLevel": "none",
            "confidenceScore": 90,
            "acceptanceCriteria": [
                {
                    "id": "AC-FIX-ST-001-1",
                    "text": "Codex can list MCP tools and retrieve story context.",
                    "state": "covered",
                    "evidenceIds": ["fixture-evidence"],
                }
            ],
            "evidenceIds": ["fixture-evidence"],
        }
        self.evidence = {
            "id": "fixture-evidence",
            "applicationId": "fixture-app",
            "storyId": "fixture-story",
            "storyKey": "FIX-ST-001",
            "type": "agent",
            "title": "MCP smoke fixture",
            "excerpt": "The fixture proves the MCP transport and tool call path works.",
            "citation": {"title": "Fixture", "snippet": "MCP transport OK"},
            "freshness": "fresh",
            "sourceAssetId": "fixture-source-asset",
        }

    def list_applications(self, *, limit: int = 20) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        return [self.application][:limit]

    def get_application(self, application_id: str) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        if application_id != self.application["id"]:
            raise HTTPException(status_code=404, detail="Application not found")
        return self.application

    def push_knowledge_document(self, *, application_id: str, file_name: str, mime_type: str, **kwargs: Any) -> dict[str, Any]:
        self.principal.require_scope("knowledge:write")
        if application_id != self.application["id"]:
            raise HTTPException(status_code=404, detail="Application not found")
        if not file_name or not mime_type:
            raise HTTPException(status_code=400, detail="fileName and mimeType are required")
        return {
            "requestId": "fixture-upload-request",
            "fileSpaceId": self.application["fileSpaceId"],
            "documentId": "fixture-mcp-document",
            "bucketName": "fixture-bucket",
            "filePath": f"organizations/local/spaces/default/fileSpaces/{self.application['fileSpaceId']}/knowledges/manual_upload/ai_editor/fixture/{file_name}",
            "gcsUrl": f"gs://fixture-bucket/fixture/{file_name}",
            "status": "accepted",
            "registrationStatus": "processing",
            "message": "アップロードリクエストを受け付けました。少し時間が経つとSearch Storeへの登録が完了します。",
        }

    def list_stories(self, *, application_id: str, **_: Any) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        return [self.story] if application_id == self.application["id"] else []

    def list_operation_videos(self, *, application_id: str, **_: Any) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        return [
            {
                "id": "fixture-operation-video",
                "applicationId": application_id,
                "applicationKey": "FIX",
                "title": "Fixture operation video",
                "description": "Video-first MCP context fixture.",
                "recordedAt": "2026-06-29T00:00:00+00:00",
                "sourceAssetId": "fixture-source-asset",
                "journeySourceAssetId": "fixture-source-asset-journey",
            }
        ] if application_id == self.application["id"] else []

    def get_operation_video(self, operation_video_id: str) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        if operation_video_id != "fixture-operation-video":
            raise HTTPException(status_code=404, detail="Operation video not found")
        return {
            "id": "fixture-operation-video",
            "applicationId": "fixture-app",
            "applicationKey": "FIX",
            "title": "Fixture operation video",
            "description": "Video-first MCP context fixture.",
            "bucketName": "fixture-bucket",
            "storagePath": "fixture-video.webm",
            "contentType": "video/webm",
            "recordedAt": "2026-06-29T00:00:00+00:00",
            "sourceAssetId": "fixture-source-asset",
            "journeySourceAssetId": "fixture-source-asset-journey",
            "frameCaptures": [
                {
                    "id": "frame-001",
                    "storagePath": "frame-001.jpg",
                    "contentType": "image/jpeg",
                    "timestampMs": 0,
                }
            ],
            "relatedContexts": {
                "github": {
                    "repoFullName": "org/repo",
                    "pullRequests": [
                        {
                            "number": 123,
                            "title": "Fixture PR",
                            "htmlUrl": "https://github.com/org/repo/pull/123",
                            "relevanceScore": 88,
                        }
                    ],
                }
            },
        }

    def get_story(self, story_id: str) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        if story_id != self.story["id"]:
            raise HTTPException(status_code=404, detail="Story not found")
        return self.story

    def get_capability(self, capability_id: str) -> dict[str, Any] | None:
        self.principal.require_scope("context:read")
        return None

    def evidence_for_story(self, *, application_id: str, story_id: str, story_key: str) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        return [self.evidence] if application_id == self.application["id"] else []

    def source_assets_by_ids(self, *, application_id: str, source_asset_ids: list[str]) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        return [
            {
                "id": "fixture-source-asset",
                "sourceType": "operation_video_journey",
                "title": "Fixture journey",
                "metadata": {"operationVideoId": "fixture-operation-video"},
            }
        ]

    def get_story_asset_manifest(self, *, application_id: str, story_id: str, **_: Any) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        return {
            "schemaVersion": "vibe-control-story-assets-v1",
            "applicationId": application_id,
            "storyId": story_id,
            "assetCounts": {
                "sourceAssets": 1,
                "operationVideos": 1,
                "screenshots": 1,
                "githubPullRequests": 1,
            },
            "sourceAssets": [
                {
                    "id": "fixture-source-asset",
                    "kind": "source_asset",
                    "sourceType": "operation_video_journey",
                    "downloadUrl": "https://storage.example.test/fixture-journey.md",
                }
            ],
            "operationVideos": [
                {
                    "id": "fixture-operation-video",
                    "kind": "operation_video",
                    "downloadUrl": "https://storage.example.test/fixture-video.webm",
                    "screenshots": [
                        {
                            "id": "frame-001",
                            "kind": "operation_video_screenshot",
                            "downloadUrl": "https://storage.example.test/frame-001.jpg",
                        }
                    ],
                }
            ],
            "githubPullRequests": [
                {
                    "repoFullName": "org/repo",
                    "number": 123,
                    "title": "Fixture PR",
                    "htmlUrl": "https://github.com/org/repo/pull/123",
                    "relevanceScore": 88,
                }
            ],
        }

    def get_operation_video_context_manifest(self, *, application_id: str, operation_video_id: str, **_: Any) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        if application_id != self.application["id"] or operation_video_id != "fixture-operation-video":
            raise HTTPException(status_code=404, detail="Operation video not found")
        return {
            "schemaVersion": "vibe-control-operation-video-context-v1",
            "applicationId": application_id,
            "application": self.application,
            "operationVideoId": operation_video_id,
            "generatedAt": "2026-06-29T00:00:00+00:00",
            "signedUrlExpiresAt": "2026-06-29T01:00:00+00:00",
            "operationVideo": {
                "id": operation_video_id,
                "title": "Fixture operation video",
                "downloadUrl": "https://storage.example.test/fixture-video.webm",
                "screenshots": [
                    {
                        "id": "frame-001",
                        "downloadUrl": "https://storage.example.test/frame-001.jpg",
                    }
                ],
            },
            "linkedStories": [self.story],
            "evidence": [self.evidence],
            "sourceAssets": [
                {
                    "id": "fixture-source-asset",
                    "sourceType": "operation_video_journey",
                    "downloadUrl": "https://storage.example.test/fixture-journey.md",
                }
            ],
            "githubPullRequests": [
                {
                    "repoFullName": "org/repo",
                    "number": 123,
                    "title": "Fixture PR",
                    "htmlUrl": "https://github.com/org/repo/pull/123",
                    "relevanceScore": 88,
                }
            ],
            "counts": {
                "linkedStories": 1,
                "evidence": 1,
                "sourceAssets": 1,
                "screenshots": 1,
                "githubPullRequests": 1,
            },
            "agentInstructions": ["Treat the operation video as the primary context object."],
        }


class FixtureStoryContextReportPublisher:
    """Small fixture publisher so local smoke tests do not need Storage ADC."""

    def publish(
        self,
        *,
        application: dict[str, Any],
        story: dict[str, Any],
        html: str,
        markdown: str,
        asset_manifest: dict[str, Any],
        ttl_seconds: int = 86400,
    ) -> dict[str, Any]:
        from datetime import datetime, timedelta, timezone

        generated_at = datetime.now(timezone.utc)
        expires_at = generated_at + timedelta(seconds=max(60, min(int(ttl_seconds or 86400), 604800)))
        bundle = ReportLinkBundle(
            html=PublishedReport(
                url="https://storage.example.test/fixture-story-context.html",
                gcs_path="gs://fixture-bucket/story-context.html",
                storage_path="story-context.html",
                content_type="text/html; charset=utf-8",
                bytes=len(html.encode("utf-8")),
            ),
            markdown=PublishedReport(
                url="https://storage.example.test/fixture-story-context.md",
                gcs_path="gs://fixture-bucket/story-context.md",
                storage_path="story-context.md",
                content_type="text/markdown; charset=utf-8",
                bytes=len(markdown.encode("utf-8")),
            ),
            generated_at=generated_at,
            expires_at=expires_at,
        )
        return build_report_link_response(
            application=application,
            story=story,
            asset_manifest=asset_manifest,
            bundle=bundle,
        )

    def publish_operation_video(
        self,
        *,
        application: dict[str, Any],
        context_manifest: dict[str, Any],
        html: str,
        markdown: str,
        ttl_seconds: int = 86400,
    ) -> dict[str, Any]:
        from datetime import datetime, timedelta, timezone
        from report_links import build_operation_video_report_link_response

        generated_at = datetime.now(timezone.utc)
        expires_at = generated_at + timedelta(seconds=max(60, min(int(ttl_seconds or 86400), 604800)))
        bundle = ReportLinkBundle(
            html=PublishedReport(
                url="https://storage.example.test/fixture-operation-video-context.html",
                gcs_path="gs://fixture-bucket/operation-video-context.html",
                storage_path="operation-video-context.html",
                content_type="text/html; charset=utf-8",
                bytes=len(html.encode("utf-8")),
            ),
            markdown=PublishedReport(
                url="https://storage.example.test/fixture-operation-video-context.md",
                gcs_path="gs://fixture-bucket/operation-video-context.md",
                storage_path="operation-video-context.md",
                content_type="text/markdown; charset=utf-8",
                bytes=len(markdown.encode("utf-8")),
            ),
            generated_at=generated_at,
            expires_at=expires_at,
        )
        return build_operation_video_report_link_response(
            application=application,
            context_manifest=context_manifest,
            bundle=bundle,
        )


def _story_context_parts(store: VibeControlStore, args: dict[str, Any]) -> dict[str, Any]:
    application_id = str(args.get("applicationId") or "")
    story_id = str(args.get("storyId") or "")
    if not application_id or not story_id:
        raise HTTPException(status_code=400, detail="applicationId and storyId are required")
    application = store.get_application(application_id)
    story = store.get_story(story_id)
    if story.get("applicationId") != application_id:
        raise HTTPException(status_code=400, detail="storyId does not belong to applicationId")
    evidence = store.evidence_for_story(
        application_id=application_id,
        story_id=story_id,
        story_key=str(story.get("storyKey") or ""),
    )
    source_assets: list[dict[str, Any]] = []
    if evidence:
        source_asset_ids = [
            str(item.get("sourceAssetId"))
            for item in evidence
            if item.get("sourceAssetId")
        ]
        source_assets = store.source_assets_by_ids(
            application_id=application_id,
            source_asset_ids=source_asset_ids,
        )
    capability = store.get_capability(str(story.get("capabilityId") or ""))
    asset_manifest = store.get_story_asset_manifest(
        application_id=application_id,
        story_id=story_id,
        include_signed_urls=args.get("includeSignedUrls") is not False,
        signed_url_ttl_seconds=_bounded_int(
            args.get("signedUrlTtlSeconds"),
            default=3600,
            minimum=60,
            maximum=86400,
        ),
    )
    bundle_args = {
        "application": application,
        "story": story,
        "capability": capability,
        "evidence": evidence,
        "source_assets": source_assets,
        "asset_manifest": asset_manifest,
    }
    return bundle_args


def _get_story_context_raw(store: VibeControlStore, args: dict[str, Any], *, format_name: str) -> str:
    bundle_args = _story_context_parts(store, args)
    if format_name == "markdown":
        return build_story_context_markdown(**bundle_args)
    return build_story_context_html(**bundle_args)


def _get_story_context(store: VibeControlStore, args: dict[str, Any]) -> Any:
    bundle_args = _story_context_parts(store, args)
    html = build_story_context_html(**bundle_args)
    markdown = build_story_context_markdown(**bundle_args)
    return _report_publisher(store).publish(
        application=bundle_args["application"],
        story=bundle_args["story"],
        html=html,
        markdown=markdown,
        asset_manifest=bundle_args["asset_manifest"],
        ttl_seconds=_bounded_int(
            args.get("reportUrlTtlSeconds"),
            default=86400,
            minimum=60,
            maximum=604800,
        ),
    )


def _get_operation_video_context(store: VibeControlStore, args: dict[str, Any]) -> Any:
    application_id = str(args.get("applicationId") or "")
    operation_video_id = str(args.get("operationVideoId") or "")
    if not application_id or not operation_video_id:
        raise HTTPException(status_code=400, detail="applicationId and operationVideoId are required")
    context_manifest = store.get_operation_video_context_manifest(
        application_id=application_id,
        operation_video_id=operation_video_id,
        include_signed_urls=args.get("includeSignedUrls") is not False,
        signed_url_ttl_seconds=_bounded_int(
            args.get("signedUrlTtlSeconds"),
            default=3600,
            minimum=60,
            maximum=86400,
        ),
    )
    application = store.get_application(application_id)
    html = build_operation_video_context_html(context_manifest=context_manifest)
    markdown = build_operation_video_context_markdown(context_manifest=context_manifest)
    report_payload = _report_publisher(store).publish_operation_video(
        application=application,
        context_manifest=context_manifest,
        html=html,
        markdown=markdown,
        ttl_seconds=_bounded_int(
            args.get("reportUrlTtlSeconds"),
            default=86400,
            minimum=60,
            maximum=604800,
        ),
    )
    return {
        **context_manifest,
        "reports": report_payload.get("reports"),
        "reportLinks": report_payload,
        "implementationContext": report_payload.get("implementationContext"),
    }


def _call_tool(principal: McpPrincipal, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    store = _store(principal)
    if name == "list_applications":
        return _text_content(store.list_applications(limit=_bounded_int(arguments.get("limit"), default=20, minimum=1, maximum=50)))
    if name == "list_stories":
        return _text_content(
            store.list_stories(
                application_id=str(arguments.get("applicationId") or ""),
                status=str(arguments.get("status") or ""),
                capability_id=str(arguments.get("capabilityId") or ""),
                query=str(arguments.get("query") or ""),
                limit=_bounded_int(arguments.get("limit"), default=20, minimum=1, maximum=100),
            )
        )
    if name == "list_operation_videos":
        return _text_content(
            store.list_operation_videos(
                application_id=str(arguments.get("applicationId") or ""),
                operation_video_group_id=str(arguments.get("operationVideoGroupId") or ""),
                query=str(arguments.get("query") or ""),
                discovery_status=str(arguments.get("discoveryStatus") or ""),
                analysis_status=str(arguments.get("analysisStatus") or ""),
                limit=_bounded_int(arguments.get("limit"), default=20, minimum=1, maximum=100),
            )
        )
    if name == "list_operation_video_groups":
        return _text_content(
            store.list_operation_video_groups(
                application_id=str(arguments.get("applicationId") or ""),
                query=str(arguments.get("query") or ""),
                limit=_bounded_int(arguments.get("limit"), default=100, minimum=1, maximum=100),
            )
        )
    if name == "get_operation_video_context":
        return _text_content(_get_operation_video_context(store, arguments))
    if name == "get_story_context":
        return _text_content(_get_story_context(store, arguments))
    if name == "push_knowledge_document":
        return _text_content(
            store.push_knowledge_document(
                application_id=str(arguments.get("applicationId") or ""),
                file_name=str(arguments.get("fileName") or ""),
                mime_type=str(arguments.get("mimeType") or ""),
                content=str(arguments.get("content") or ""),
                content_base64=str(arguments.get("contentBase64") or ""),
                title=str(arguments.get("title") or ""),
                description=str(arguments.get("description") or ""),
                story_id=str(arguments.get("storyId") or ""),
                operation_video_id=str(arguments.get("operationVideoId") or ""),
                tags=arguments.get("tags") if isinstance(arguments.get("tags"), list) else [],
                source_note=str(arguments.get("sourceNote") or ""),
            )
        )
    raise HTTPException(status_code=404, detail=f"Unknown tool: {name}")


def _read_resource(principal: McpPrincipal, uri: str) -> dict[str, Any]:
    store = _store(principal)
    if uri == "vibe://applications":
        return {
            "contents": [
                {
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": json.dumps(store.list_applications(limit=50), ensure_ascii=False, indent=2),
                }
            ]
        }
    if uri.startswith("vibe://applications/") and uri.endswith("/stories"):
        application_id = uri.removeprefix("vibe://applications/").removesuffix("/stories")
        return {
            "contents": [
                {
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": json.dumps(
                        store.list_stories(application_id=application_id, limit=100),
                        ensure_ascii=False,
                        indent=2,
                    ),
                }
            ]
        }
    if uri.startswith("vibe://stories/") and (uri.endswith("/context.md") or uri.endswith("/context.html")):
        is_markdown = uri.endswith("/context.md")
        story_id = uri.removeprefix("vibe://stories/").removesuffix("/context.md").removesuffix("/context.html")
        story = store.get_story(story_id)
        payload = _get_story_context_raw(
            store,
            {
                "applicationId": story.get("applicationId"),
                "storyId": story_id,
            },
            format_name="markdown" if is_markdown else "html",
        )
        return {
            "contents": [
                {
                    "uri": uri,
                    "mimeType": "text/markdown" if is_markdown else "text/html",
                    "text": payload,
                }
            ]
        }
    raise HTTPException(status_code=404, detail=f"Unknown resource: {uri}")


def _handle_method(principal: McpPrincipal, method: str, params: dict[str, Any]) -> Any:
    if method == "initialize":
        return {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}, "resources": {}},
            "serverInfo": {"name": "storyvault-mcp", "version": "0.1.0"},
        }
    if method == "notifications/initialized":
        return {}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": _tool_definitions()}
    if method == "tools/call":
        name = str(params.get("name") or "")
        arguments = params.get("arguments")
        if not isinstance(arguments, dict):
            arguments = {}
        return _call_tool(principal, name, arguments)
    if method == "resources/list":
        resources = _resource_definitions()
        for application in _store(principal).list_applications(limit=50):
            application_id = str(application.get("id") or "")
            if application_id:
                resources.append(
                    {
                        "uri": f"vibe://applications/{application_id}/stories",
                        "name": f"{application.get('name') or application_id} stories",
                        "description": "Stories for this StoryVault application.",
                        "mimeType": "application/json",
                    }
                )
        return {"resources": resources}
    if method == "resources/read":
        uri = str(params.get("uri") or "")
        return _read_resource(principal, uri)
    raise HTTPException(status_code=404, detail=f"Unsupported MCP method: {method}")


def _handle_json_rpc_message(principal: McpPrincipal, message: dict[str, Any]) -> dict[str, Any] | None:
    request_id = message.get("id")
    method = str(message.get("method") or "")
    params = message.get("params")
    if not isinstance(params, dict):
        params = {}
    if not method:
        return _json_rpc_error(request_id, -32600, "Invalid JSON-RPC request")
    try:
        result = _handle_method(principal, method, params)
        if request_id is None:
            return None
        return _json_rpc_result(request_id, result)
    except HTTPException as exc:
        if request_id is None:
            return None
        return _json_rpc_error(request_id, -32000, str(exc.detail), {"httpStatus": exc.status_code})
    except Exception as exc:  # pragma: no cover - defensive boundary for remote clients.
        logger.exception("Unhandled MCP error")
        if request_id is None:
            return None
        return _json_rpc_error(request_id, -32603, "Internal error", {"message": str(exc)})


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"ok": True, "service": "storyvault-mcp"}


@app.get("/_healthz")
def private_healthz() -> dict[str, Any]:
    return healthz()


@app.get("/r/{report_id}/{file_name}")
def download_report(report_id: str, file_name: str) -> Response:
    clean_report_id = safe_report_id(report_id)
    if not clean_report_id or file_name not in {
        "story-context.html",
        "story-context.md",
        "operation-video-context.html",
        "operation-video-context.md",
    }:
        raise HTTPException(status_code=404, detail="Report not found")

    storage_path = f"{_report_path_prefix()}/{clean_report_id}/{file_name}"
    blob = storage.Client().bucket(_report_bucket_name()).blob(storage_path)
    try:
        blob.reload(timeout=10)
    except Exception:
        raise HTTPException(status_code=404, detail="Report not found")

    metadata = blob.metadata or {}
    expires_at_raw = metadata.get("storyvaultReportExpiresAt")
    if expires_at_raw:
        try:
            expires_at = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00"))
        except ValueError:
            expires_at = None
        if expires_at and datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=410, detail="Report URL expired")

    data = blob.download_as_bytes(timeout=30)
    media_type = "text/html; charset=utf-8" if file_name.endswith(".html") else "text/markdown; charset=utf-8"
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Cache-Control": "private, max-age=60",
            "X-StoryVault-Report-Id": clean_report_id,
        },
    )


@app.post("/mcp")
async def mcp_endpoint(
    request: Request,
    principal: McpPrincipal = Depends(require_mcp_principal),
) -> JSONResponse:
    payload = await request.json()
    if isinstance(payload, list):
        responses = [
            response
            for item in payload
            if isinstance(item, dict)
            for response in [_handle_json_rpc_message(principal, item)]
            if response is not None
        ]
        return JSONResponse(responses)
    if not isinstance(payload, dict):
        return JSONResponse(_json_rpc_error(None, -32600, "Invalid JSON-RPC request"), status_code=400)
    response = _handle_json_rpc_message(principal, payload)
    if response is None:
        return JSONResponse({}, status_code=202)
    return JSONResponse(response)
