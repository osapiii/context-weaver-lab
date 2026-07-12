"""Publish StoryVault context reports and return compact link payloads."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import re
from typing import Any
from uuid import uuid4

from google.cloud import storage

STORY_REPORT_SCHEMA_VERSION = "storyvault-story-context-report-links-v1"
OPERATION_VIDEO_REPORT_SCHEMA_VERSION = "storyvault-operation-video-context-report-links-v1"


def _clean_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def safe_report_id(value: Any) -> str:
    text = _clean_text(value)
    if not re.fullmatch(r"[a-zA-Z0-9_.=-]{8,160}", text):
        return ""
    return text


def _short_report_url(public_base_url: str, report_id: str, file_name: str) -> str:
    return f"{public_base_url.rstrip('/')}/r/{report_id}/{file_name}"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


@dataclass(frozen=True)
class PublishedReport:
    url: str
    gcs_path: str
    storage_path: str
    content_type: str
    bytes: int


@dataclass(frozen=True)
class ReportLinkBundle:
    html: PublishedReport
    markdown: PublishedReport
    generated_at: datetime
    expires_at: datetime


class StoryContextReportPublisher:
    """Uploads generated HTML/Markdown reports and creates short Cloud Run URLs."""

    def __init__(
        self,
        *,
        storage_client: storage.Client | Any | None = None,
        bucket_name: str,
        path_prefix: str = "storyvault/reports",
        public_base_url: str,
    ) -> None:
        self.storage_client = storage_client or storage.Client()
        self.bucket_name = bucket_name
        self.path_prefix = path_prefix.strip("/")
        self.public_base_url = public_base_url.rstrip("/")

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
        return self.publish_story(
            application=application,
            story=story,
            html=html,
            markdown=markdown,
            asset_manifest=asset_manifest,
            ttl_seconds=ttl_seconds,
        )

    def publish_story(
        self,
        *,
        application: dict[str, Any],
        story: dict[str, Any],
        html: str,
        markdown: str,
        asset_manifest: dict[str, Any],
        ttl_seconds: int = 86400,
    ) -> dict[str, Any]:
        generated_at = _utc_now()
        ttl = max(60, min(int(ttl_seconds or 86400), 604800))
        expires_at = generated_at + timedelta(seconds=ttl)
        report_id = f"{generated_at.strftime('%Y%m%dT%H%M%SZ')}-{uuid4().hex[:10]}"
        base_path = "/".join([self.path_prefix, report_id])

        bundle = ReportLinkBundle(
            html=self._upload_report(
                storage_path=f"{base_path}/story-context.html",
                public_url=_short_report_url(self.public_base_url, report_id, "story-context.html"),
                text=html,
                content_type="text/html; charset=utf-8",
                application=application,
                story=story,
                report_kind="story",
                expires_at=expires_at,
            ),
            markdown=self._upload_report(
                storage_path=f"{base_path}/story-context.md",
                public_url=_short_report_url(self.public_base_url, report_id, "story-context.md"),
                text=markdown,
                content_type="text/markdown; charset=utf-8",
                application=application,
                story=story,
                report_kind="story",
                expires_at=expires_at,
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
        generated_at = _utc_now()
        ttl = max(60, min(int(ttl_seconds or 86400), 604800))
        expires_at = generated_at + timedelta(seconds=ttl)
        report_id = f"{generated_at.strftime('%Y%m%dT%H%M%SZ')}-{uuid4().hex[:10]}"
        base_path = "/".join([self.path_prefix, report_id])
        synthetic_story = {
            "applicationId": context_manifest.get("applicationId"),
            "id": context_manifest.get("operationVideoId"),
        }
        bundle = ReportLinkBundle(
            html=self._upload_report(
                storage_path=f"{base_path}/operation-video-context.html",
                public_url=_short_report_url(self.public_base_url, report_id, "operation-video-context.html"),
                text=html,
                content_type="text/html; charset=utf-8",
                application=application,
                story=synthetic_story,
                report_kind="operation_video",
                expires_at=expires_at,
            ),
            markdown=self._upload_report(
                storage_path=f"{base_path}/operation-video-context.md",
                public_url=_short_report_url(self.public_base_url, report_id, "operation-video-context.md"),
                text=markdown,
                content_type="text/markdown; charset=utf-8",
                application=application,
                story=synthetic_story,
                report_kind="operation_video",
                expires_at=expires_at,
            ),
            generated_at=generated_at,
            expires_at=expires_at,
        )
        return build_operation_video_report_link_response(
            application=application,
            context_manifest=context_manifest,
            bundle=bundle,
        )

    def _upload_report(
        self,
        *,
        storage_path: str,
        public_url: str,
        text: str,
        content_type: str,
        application: dict[str, Any],
        story: dict[str, Any],
        report_kind: str,
        expires_at: datetime,
    ) -> PublishedReport:
        encoded = text.encode("utf-8")
        blob = self.storage_client.bucket(self.bucket_name).blob(storage_path)
        blob.metadata = {
            "storyvaultReportExpiresAt": expires_at.isoformat(),
            "storyvaultApplicationId": str(application.get("id") or story.get("applicationId") or ""),
            "storyvaultStoryId": str(story.get("id") or ""),
            "storyvaultReportKind": report_kind,
        }
        blob.upload_from_string(encoded, content_type=content_type, timeout=30)
        return PublishedReport(
            url=public_url,
            gcs_path=f"gs://{self.bucket_name}/{storage_path}",
            storage_path=storage_path,
            content_type=content_type,
            bytes=len(encoded),
        )


def build_report_link_response(
    *,
    application: dict[str, Any],
    story: dict[str, Any],
    asset_manifest: dict[str, Any],
    bundle: ReportLinkBundle,
) -> dict[str, Any]:
    return {
        "schemaVersion": STORY_REPORT_SCHEMA_VERSION,
        "applicationId": application.get("id") or story.get("applicationId"),
        "storyId": story.get("id"),
        "storyKey": story.get("storyKey"),
        "title": story.get("title"),
        "generatedAt": bundle.generated_at.isoformat(),
        "expiresAt": bundle.expires_at.isoformat(),
        "recommendedForAgent": "markdown",
        "reports": {
            "html": _report_dict(bundle.html),
            "markdown": _report_dict(bundle.markdown),
        },
        "implementationContext": {
            "readThisFirst": "reports.markdown.url",
            "notes": [
                "Coding agents should fetch the Markdown report and use evidence IDs in plans.",
                "HTML is intended for human visual review in a browser.",
            ],
        },
        "assets": _compact_assets(asset_manifest),
    }


def build_operation_video_report_link_response(
    *,
    application: dict[str, Any],
    context_manifest: dict[str, Any],
    bundle: ReportLinkBundle,
) -> dict[str, Any]:
    return {
        "schemaVersion": OPERATION_VIDEO_REPORT_SCHEMA_VERSION,
        "applicationId": application.get("id") or context_manifest.get("applicationId"),
        "operationVideoId": context_manifest.get("operationVideoId"),
        "title": (context_manifest.get("operationVideo") or {}).get("title"),
        "generatedAt": bundle.generated_at.isoformat(),
        "expiresAt": bundle.expires_at.isoformat(),
        "recommendedForAgent": "markdown",
        "reports": {
            "html": _report_dict(bundle.html),
            "markdown": _report_dict(bundle.markdown),
        },
        "implementationContext": {
            "readThisFirst": "reports.markdown.url",
            "notes": [
                "Coding agents should treat the operation video as the primary context object.",
                "The Markdown report bundles every linked user story for this video.",
                "HTML is intended for human visual review in a browser.",
            ],
        },
        "operationVideo": {
            "id": context_manifest.get("operationVideoId"),
            "downloadUrl": (context_manifest.get("operationVideo") or {}).get("downloadUrl"),
            "screenshotCount": len(_as_list((context_manifest.get("operationVideo") or {}).get("screenshots"))),
            "generatedAssetCount": len(_as_list((context_manifest.get("operationVideo") or {}).get("generatedAssets"))),
            "generatedAssets": [
                {
                    "kind": asset.get("kind"),
                    "role": asset.get("role"),
                    "label": asset.get("label"),
                    "contentType": asset.get("contentType"),
                    "gcsPath": asset.get("gcsPath"),
                    "downloadUrl": asset.get("downloadUrl"),
                    "downloadUrlExpiresAt": asset.get("downloadUrlExpiresAt"),
                }
                for asset in _as_list((context_manifest.get("operationVideo") or {}).get("generatedAssets"))
                if isinstance(asset, dict)
            ][:12],
        },
        "counts": context_manifest.get("counts") or {},
        "linkedStories": [
            {
                "id": story.get("id"),
                "storyKey": story.get("storyKey"),
                "title": story.get("title"),
            }
            for story in _as_list(context_manifest.get("linkedStories"))
            if isinstance(story, dict)
        ],
    }


def _report_dict(report: PublishedReport) -> dict[str, Any]:
    return {
        "url": report.url,
        "gcsPath": report.gcs_path,
        "storagePath": report.storage_path,
        "contentType": report.content_type,
        "bytes": report.bytes,
    }


def _compact_assets(asset_manifest: dict[str, Any]) -> dict[str, Any]:
    videos = []
    for video in _as_list(asset_manifest.get("operationVideos")):
        if not isinstance(video, dict):
            continue
        videos.append(
            {
                "id": video.get("id"),
                "title": video.get("title"),
                "downloadUrl": video.get("downloadUrl"),
                "downloadUrlExpiresAt": video.get("downloadUrlExpiresAt"),
                "screenshotCount": len([frame for frame in _as_list(video.get("screenshots")) if isinstance(frame, dict)]),
                "generatedAssetCount": len([asset for asset in _as_list(video.get("generatedAssets")) if isinstance(asset, dict)]),
                "generatedAssets": [
                    {
                        "kind": asset.get("kind"),
                        "role": asset.get("role"),
                        "label": asset.get("label"),
                        "contentType": asset.get("contentType"),
                        "gcsPath": asset.get("gcsPath"),
                        "downloadUrl": asset.get("downloadUrl"),
                        "downloadUrlExpiresAt": asset.get("downloadUrlExpiresAt"),
                    }
                    for asset in _as_list(video.get("generatedAssets"))
                    if isinstance(asset, dict)
                ][:12],
            }
        )
    return {
        "signedUrlExpiresAt": asset_manifest.get("signedUrlExpiresAt"),
        "counts": asset_manifest.get("assetCounts") or {},
        "videos": videos,
    }
