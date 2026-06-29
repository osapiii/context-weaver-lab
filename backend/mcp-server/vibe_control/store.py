"""Firestore access layer for StoryVault MCP tools."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import google.auth
from google.auth.transport.requests import Request as GoogleAuthRequest
import os
from fastapi import HTTPException
from google.cloud import firestore
from google.cloud import storage

from auth import McpPrincipal


def _clean_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _doc_to_dict(snap: Any) -> dict[str, Any]:
    data = snap.to_dict() or {}
    data["id"] = snap.id
    return data


def _serialize_firestore(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serialize_firestore(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_firestore(item) for item in value]
    return value


def _default_storage_bucket() -> str:
    return (
        _clean_text(os.getenv("STORYVAULT_MCP_DEFAULT_STORAGE_BUCKET"))
        or _clean_text(os.getenv("VIBE_CONTROL_MCP_DEFAULT_STORAGE_BUCKET"))
        or "vibe-control-dev.firebasestorage.app"
    )


def _storage_ref_from_values(
    *,
    bucket_name: Any = "",
    storage_path: Any = "",
    gcs_path: Any = "",
    uri: Any = "",
) -> tuple[str, str]:
    bucket = _clean_text(bucket_name)
    path = _clean_text(storage_path)
    cloud_uri = _clean_text(gcs_path) or _clean_text(uri)
    if cloud_uri.startswith("gs://"):
        rest = cloud_uri[len("gs://") :]
        parsed_bucket, _, parsed_path = rest.partition("/")
        return parsed_bucket, parsed_path
    if bucket and path:
        return bucket, path
    return "", path


class VibeControlStore:
    def __init__(
        self,
        principal: McpPrincipal,
        *,
        db: firestore.Client | None = None,
    ) -> None:
        self.principal = principal
        self.db = db or firestore.Client()
        self.storage = storage.Client()
        self._signed_url_credentials: Any | None = None
        self._signed_url_service_account_email: str | None = None
        self._signed_url_access_token: str | None = None

    def _collection(self, name: str):
        return (
            self.db.collection("organizations")
            .document(self.principal.organization_id)
            .collection("spaces")
            .document(self.principal.space_id)
            .collection(name)
        )

    def _require_application(self, application_id: str) -> None:
        if not self.principal.can_access_application(application_id):
            raise HTTPException(status_code=403, detail="Application is not allowed for this MCP token")

    def list_applications(self, *, limit: int = 20) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        docs = self._collection("vibeControlApplications").limit(max(1, min(limit, 50))).stream()
        applications = [_serialize_firestore(_doc_to_dict(snap)) for snap in docs]
        if self.principal.allowed_application_ids:
            applications = [
                app
                for app in applications
                if str(app.get("id") or "") in self.principal.allowed_application_ids
            ]
        return applications

    def get_application(self, application_id: str) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        snap = self._collection("vibeControlApplications").document(application_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Application not found")
        return _serialize_firestore(_doc_to_dict(snap))

    def list_stories(
        self,
        *,
        application_id: str,
        status: str = "",
        capability_id: str = "",
        query: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        q = self._collection("vibeControlStories").where(
            filter=firestore.FieldFilter("applicationId", "==", application_id)
        )
        if status:
            q = q.where(filter=firestore.FieldFilter("status", "==", status))
        if capability_id:
            q = q.where(filter=firestore.FieldFilter("capabilityId", "==", capability_id))
        docs = [_serialize_firestore(_doc_to_dict(snap)) for snap in q.limit(max(1, min(limit, 100))).stream()]
        needle = query.strip().lower()
        if needle:
            docs = [
                story
                for story in docs
                if needle
                in " ".join(
                    str(story.get(key) or "")
                    for key in ("storyKey", "title", "summary", "userStory", "domain", "milestone")
                ).lower()
            ]
        return docs

    def list_operation_video_groups(
        self,
        *,
        application_id: str,
        query: str = "",
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        q = self._collection("vibeControlOperationVideoGroups").where(
            filter=firestore.FieldFilter("applicationId", "==", application_id)
        )
        docs = [_serialize_firestore(_doc_to_dict(snap)) for snap in q.limit(max(1, min(limit, 100))).stream()]
        needle = query.strip().lower()
        if needle:
            docs = [
                group
                for group in docs
                if needle
                in " ".join(
                    str(group.get(key) or "")
                    for key in (
                        "id",
                        "name",
                        "description",
                        "applicationKey",
                    )
                ).lower()
            ]
        return sorted(docs, key=lambda item: str(item.get("createdAt") or item.get("name") or ""))

    def list_operation_videos(
        self,
        *,
        application_id: str,
        operation_video_group_id: str = "",
        query: str = "",
        discovery_status: str = "",
        analysis_status: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        q = self._collection("vibeControlOperationVideos").where(
            filter=firestore.FieldFilter("applicationId", "==", application_id)
        )
        if operation_video_group_id:
            q = q.where(filter=firestore.FieldFilter("groupId", "==", operation_video_group_id))
        if discovery_status:
            q = q.where(filter=firestore.FieldFilter("discoveryStatus", "==", discovery_status))
        if analysis_status:
            q = q.where(filter=firestore.FieldFilter("analysisStatus", "==", analysis_status))
        docs = [_serialize_firestore(_doc_to_dict(snap)) for snap in q.limit(max(1, min(limit, 100))).stream()]
        needle = query.strip().lower()
        if needle:
            docs = [
                video
                for video in docs
                if needle
                in " ".join(
                    str(video.get(key) or "")
                    for key in (
                        "id",
                        "title",
                        "description",
                        "transcriptSummary",
                        "recordedAt",
                        "discoveryStatus",
                        "analysisStatus",
                    )
                ).lower()
            ]
        group_ids = {
            str(video.get("groupId") or "")
            for video in docs
            if str(video.get("groupId") or "")
        }
        groups = {group_id: self._operation_video_group_by_id(group_id) for group_id in group_ids}
        docs = [
            {
                **video,
                "videoGroup": self._operation_video_group_ref(
                    groups.get(str(video.get("groupId") or "")),
                    fallback_id=str(video.get("groupId") or ""),
                    fallback_name=str(video.get("groupNameSnapshot") or ""),
                ),
            }
            for video in docs
        ]
        return docs

    def get_operation_video(self, operation_video_id: str) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        snap = self._collection("vibeControlOperationVideos").document(operation_video_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Operation video not found")
        video = _serialize_firestore(_doc_to_dict(snap))
        self._require_application(str(video.get("applicationId") or ""))
        return video

    def get_story(self, story_id: str) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        snap = self._collection("vibeControlStories").document(story_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Story not found")
        story = _serialize_firestore(_doc_to_dict(snap))
        self._require_application(str(story.get("applicationId") or ""))
        return story

    def get_capability(self, capability_id: str) -> dict[str, Any] | None:
        self.principal.require_scope("context:read")
        if not capability_id:
            return None
        snap = self._collection("vibeControlCapabilities").document(capability_id).get()
        if not snap.exists:
            return None
        capability = _serialize_firestore(_doc_to_dict(snap))
        self._require_application(str(capability.get("applicationId") or ""))
        return capability

    def evidence_for_story(self, *, application_id: str, story_id: str, story_key: str) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        collection = self._collection("vibeControlStoryEvidence")
        docs: dict[str, dict[str, Any]] = {}
        for field, value in (("storyId", story_id), ("storyKey", story_key)):
            if not value:
                continue
            q = collection.where(filter=firestore.FieldFilter("applicationId", "==", application_id)).where(
                filter=firestore.FieldFilter(field, "==", value)
            )
            for snap in q.limit(100).stream():
                docs[snap.id] = _serialize_firestore(_doc_to_dict(snap))
        return list(docs.values())

    def source_assets_by_ids(self, *, application_id: str, source_asset_ids: list[str]) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        assets: list[dict[str, Any]] = []
        for source_asset_id in source_asset_ids[:30]:
            snap = self._collection("vibeControlSourceAssets").document(source_asset_id).get()
            if snap.exists:
                item = _serialize_firestore(_doc_to_dict(snap))
                if item.get("applicationId") == application_id:
                    self._attach_markdown_body(item)
                    assets.append(item)
        return assets

    def _attach_markdown_body(self, item: dict[str, Any]) -> None:
        uri = _clean_text(item.get("gcsPath") or item.get("uri"))
        storage_path = _clean_text(item.get("storagePath"))
        if not (uri.endswith(".md") or storage_path.endswith(".md")):
            return
        bucket_name, blob_name = _storage_ref_from_values(
            bucket_name=item.get("bucketName") or _default_storage_bucket(),
            storage_path=storage_path,
            gcs_path=item.get("gcsPath"),
            uri=item.get("uri"),
        )
        if not bucket_name or not blob_name:
            return
        try:
            blob = self.storage.bucket(bucket_name).blob(blob_name)
            raw = blob.download_as_text(encoding="utf-8", timeout=20)
        except Exception as exc:
            item["markdownBodyError"] = str(exc)[:300]
            return
        max_chars = 12000
        item["markdownBody"] = raw[:max_chars]
        item["markdownTruncated"] = len(raw) > max_chars

    def get_story_asset_manifest(
        self,
        *,
        application_id: str,
        story_id: str,
        signed_url_ttl_seconds: int = 3600,
        include_signed_urls: bool = True,
    ) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        story = self.get_story(story_id)
        if story.get("applicationId") != application_id:
            raise HTTPException(status_code=400, detail="storyId does not belong to applicationId")
        evidence = self.evidence_for_story(
            application_id=application_id,
            story_id=story_id,
            story_key=str(story.get("storyKey") or ""),
        )
        source_asset_ids = [
            str(item.get("sourceAssetId"))
            for item in evidence
            if item.get("sourceAssetId")
        ]
        source_assets = self.source_assets_by_ids(
            application_id=application_id,
            source_asset_ids=source_asset_ids,
        )
        operation_video_ids = self._operation_video_ids_from_source_assets(source_assets)
        operation_videos = self._operation_videos_by_ids(
            application_id=application_id,
            operation_video_ids=operation_video_ids,
        )
        ttl = max(60, min(int(signed_url_ttl_seconds or 3600), 86400))
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl)
        manifest = {
            "schemaVersion": "vibe-control-story-assets-v1",
            "applicationId": application_id,
            "storyId": story_id,
            "storyKey": story.get("storyKey"),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "signedUrlExpiresAt": expires_at.isoformat() if include_signed_urls else None,
            "evidenceIds": [str(item.get("id")) for item in evidence if item.get("id")],
            "sourceAssets": [
                self._source_asset_ref(
                    item,
                    include_signed_urls=include_signed_urls,
                    expires_at=expires_at,
                )
                for item in source_assets
            ],
            "operationVideos": [
                self._operation_video_ref(
                    item,
                    include_signed_urls=include_signed_urls,
                    expires_at=expires_at,
                )
                for item in operation_videos
            ],
            "githubPullRequests": self._github_pull_requests(operation_videos),
            "knowledgeDocuments": self._knowledge_documents(
                operation_videos,
                include_signed_urls=include_signed_urls,
                expires_at=expires_at,
            ),
        }
        manifest["assetCounts"] = {
            "sourceAssets": len(manifest["sourceAssets"]),
            "operationVideos": len(manifest["operationVideos"]),
            "screenshots": sum(len(item.get("screenshots") or []) for item in manifest["operationVideos"]),
            "githubPullRequests": len(manifest["githubPullRequests"]),
            "knowledgeDocuments": len(manifest["knowledgeDocuments"]),
        }
        return manifest

    def get_operation_video_context_manifest(
        self,
        *,
        application_id: str,
        operation_video_id: str,
        signed_url_ttl_seconds: int = 3600,
        include_signed_urls: bool = True,
    ) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        application = self.get_application(application_id)
        video = self.get_operation_video(operation_video_id)
        if video.get("applicationId") != application_id:
            raise HTTPException(status_code=400, detail="operationVideoId does not belong to applicationId")
        video_group = self._operation_video_group_ref(
            self._operation_video_group_by_id(str(video.get("groupId") or "")),
            fallback_id=str(video.get("groupId") or ""),
            fallback_name=str(video.get("groupNameSnapshot") or ""),
        )

        source_asset_ids = [
            item
            for item in [
                _clean_text(video.get("sourceAssetId")),
                _clean_text(video.get("journeySourceAssetId")),
            ]
            if item
        ]
        source_assets = self.source_assets_by_ids(
            application_id=application_id,
            source_asset_ids=source_asset_ids,
        )
        evidence = self.evidence_for_source_assets(
            application_id=application_id,
            source_asset_ids=source_asset_ids,
        )
        stories = self.stories_for_evidence(application_id=application_id, evidence=evidence)
        ttl = max(60, min(int(signed_url_ttl_seconds or 3600), 86400))
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl)
        video_ref = self._operation_video_ref(
            video,
            include_signed_urls=include_signed_urls,
            expires_at=expires_at,
        )
        source_asset_refs = [
            self._source_asset_ref(item, include_signed_urls=include_signed_urls, expires_at=expires_at)
            for item in source_assets
        ]
        pull_requests = self._github_pull_requests([video])
        knowledge_documents = self._knowledge_documents(
            [video],
            include_signed_urls=include_signed_urls,
            expires_at=expires_at,
        )
        return {
            "schemaVersion": "vibe-control-operation-video-context-v1",
            "applicationId": application_id,
            "application": {
                "id": application.get("id"),
                "name": application.get("name"),
                "applicationKey": application.get("applicationKey"),
                "repoFullName": application.get("repoFullName"),
                "defaultBranch": application.get("defaultBranch"),
                "fileSpaceId": application.get("fileSpaceId"),
            },
            "operationVideoId": operation_video_id,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "signedUrlExpiresAt": expires_at.isoformat() if include_signed_urls else None,
            "videoGroup": video_group,
            "operationVideo": video_ref,
            "linkedStories": [self._story_ref(item) for item in stories],
            "evidence": [self._evidence_ref(item) for item in evidence],
            "sourceAssets": source_asset_refs,
            "githubPullRequests": pull_requests,
            "knowledgeDocuments": knowledge_documents,
            "counts": {
                "linkedStories": len(stories),
                "evidence": len(evidence),
                "sourceAssets": len(source_asset_refs),
                "screenshots": len(video_ref.get("screenshots") or []),
                "githubPullRequests": len(pull_requests),
                "knowledgeDocuments": len(knowledge_documents),
            },
            "agentInstructions": [
                "Treat the operation video as the primary context object.",
                "Use linkedStories as interpretations attached to this video, not as the root of the context.",
                "When the user's request is ambiguous, summarize the operation video first, then list linked user stories and evidence.",
                "Preserve evidence IDs and operationVideoId in implementation plans, PR descriptions, and release notes.",
            ],
        }

    def evidence_for_source_assets(
        self,
        *,
        application_id: str,
        source_asset_ids: list[str],
    ) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        collection = self._collection("vibeControlStoryEvidence")
        docs: dict[str, dict[str, Any]] = {}
        for source_asset_id in source_asset_ids[:30]:
            if not source_asset_id:
                continue
            q = collection.where(filter=firestore.FieldFilter("applicationId", "==", application_id)).where(
                filter=firestore.FieldFilter("sourceAssetId", "==", source_asset_id)
            )
            for snap in q.limit(100).stream():
                docs[snap.id] = _serialize_firestore(_doc_to_dict(snap))
        return list(docs.values())

    def stories_for_evidence(self, *, application_id: str, evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        story_ids = {
            _clean_text(item.get("storyId"))
            for item in evidence
            if _clean_text(item.get("storyId"))
        }
        story_keys = {
            _clean_text(item.get("storyKey"))
            for item in evidence
            if _clean_text(item.get("storyKey"))
        }
        stories: dict[str, dict[str, Any]] = {}
        for story_id in story_ids:
            try:
                story = self.get_story(story_id)
            except HTTPException:
                continue
            if story.get("applicationId") == application_id:
                stories[str(story.get("id") or story_id)] = story
        if story_keys:
            collection = self._collection("vibeControlStories")
            for story_key in list(story_keys)[:30]:
                q = collection.where(filter=firestore.FieldFilter("applicationId", "==", application_id)).where(
                    filter=firestore.FieldFilter("storyKey", "==", story_key)
                )
                for snap in q.limit(20).stream():
                    item = _serialize_firestore(_doc_to_dict(snap))
                    stories[str(item.get("id") or snap.id)] = item
        return list(stories.values())

    def _operation_video_group_by_id(self, group_id: str) -> dict[str, Any] | None:
        if not group_id:
            return None
        snap = self._collection("vibeControlOperationVideoGroups").document(group_id).get()
        if not snap.exists:
            return None
        group = _serialize_firestore(_doc_to_dict(snap))
        self._require_application(str(group.get("applicationId") or ""))
        return group

    def _operation_video_group_ref(
        self,
        group: dict[str, Any] | None,
        *,
        fallback_id: str = "",
        fallback_name: str = "",
    ) -> dict[str, Any] | None:
        if not group and not (fallback_id or fallback_name):
            return None
        return {
            "id": (group or {}).get("id") or fallback_id or None,
            "name": (group or {}).get("name") or fallback_name or None,
            "description": (group or {}).get("description") or None,
            "videoCount": (group or {}).get("videoCount"),
            "createdAt": (group or {}).get("createdAt"),
            "updatedAt": (group or {}).get("updatedAt"),
        }

    def _story_ref(self, item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": item.get("id"),
            "storyKey": item.get("storyKey"),
            "title": item.get("title"),
            "summary": item.get("summary"),
            "userStory": item.get("userStory"),
            "status": item.get("status"),
            "reviewState": item.get("reviewState"),
            "capabilityId": item.get("capabilityId"),
            "capabilityKey": item.get("capabilityKey"),
            "capabilityName": item.get("capabilityName"),
            "acceptanceCriteria": item.get("acceptanceCriteria") if isinstance(item.get("acceptanceCriteria"), list) else [],
            "evidenceIds": item.get("evidenceIds") if isinstance(item.get("evidenceIds"), list) else [],
            "labels": item.get("labels") if isinstance(item.get("labels"), list) else [],
            "driftLevel": item.get("driftLevel"),
            "confidenceScore": item.get("confidenceScore"),
        }

    def _evidence_ref(self, item: dict[str, Any]) -> dict[str, Any]:
        citation = item.get("citation") if isinstance(item.get("citation"), dict) else {}
        return {
            "id": item.get("id"),
            "storyId": item.get("storyId"),
            "storyKey": item.get("storyKey"),
            "type": item.get("type"),
            "title": item.get("title"),
            "excerpt": item.get("excerpt"),
            "observedUserAction": item.get("observedUserAction"),
            "observedUiSurface": item.get("observedUiSurface"),
            "sourceAssetId": item.get("sourceAssetId"),
            "sourceUrl": item.get("sourceUrl") or citation.get("uri"),
            "citation": citation,
            "freshness": item.get("freshness"),
        }

    def _operation_video_ids_from_source_assets(self, source_assets: list[dict[str, Any]]) -> list[str]:
        seen: set[str] = set()
        ids: list[str] = []
        for asset in source_assets:
            metadata = asset.get("metadata") if isinstance(asset.get("metadata"), dict) else {}
            operation_video_id = _clean_text(metadata.get("operationVideoId"))
            if operation_video_id and operation_video_id not in seen:
                seen.add(operation_video_id)
                ids.append(operation_video_id)
        return ids

    def _operation_videos_by_ids(
        self,
        *,
        application_id: str,
        operation_video_ids: list[str],
    ) -> list[dict[str, Any]]:
        videos: list[dict[str, Any]] = []
        for operation_video_id in operation_video_ids[:20]:
            snap = self._collection("vibeControlOperationVideos").document(operation_video_id).get()
            if not snap.exists:
                continue
            item = _serialize_firestore(_doc_to_dict(snap))
            if item.get("applicationId") == application_id:
                videos.append(item)
        return videos

    def _source_asset_ref(
        self,
        item: dict[str, Any],
        *,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> dict[str, Any]:
        bucket_name, storage_path = _storage_ref_from_values(
            bucket_name=item.get("bucketName") or _default_storage_bucket(),
            storage_path=item.get("storagePath"),
            gcs_path=item.get("gcsPath"),
            uri=item.get("uri"),
        )
        ref = {
            "id": item.get("id"),
            "kind": "source_asset",
            "sourceType": item.get("sourceType"),
            "title": item.get("title"),
            "summary": item.get("summary"),
            "contentType": item.get("contentType"),
            "bucketName": bucket_name or None,
            "storagePath": storage_path or None,
            "gcsPath": f"gs://{bucket_name}/{storage_path}" if bucket_name and storage_path else item.get("gcsPath"),
            "uri": item.get("uri"),
            "fileSpaceDocumentId": item.get("fileSpaceDocumentId"),
            "repoFullName": item.get("repoFullName"),
            "path": item.get("path"),
            "pullRequest": item.get("pullRequest"),
            "commit": item.get("commit"),
            "discoveryStatus": item.get("discoveryStatus"),
        }
        self._attach_signed_url(ref, bucket_name, storage_path, include_signed_urls=include_signed_urls, expires_at=expires_at)
        return ref

    def _operation_video_ref(
        self,
        item: dict[str, Any],
        *,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> dict[str, Any]:
        bucket_name = _clean_text(item.get("bucketName"))
        storage_path = _clean_text(item.get("storagePath"))
        video_ref = {
            "id": item.get("id"),
            "kind": "operation_video",
            "title": item.get("title"),
            "description": item.get("description"),
            "contentType": item.get("contentType"),
            "sizeBytes": item.get("sizeBytes"),
            "durationMs": item.get("durationMs"),
            "recordedAt": item.get("recordedAt"),
            "bucketName": bucket_name or None,
            "storagePath": storage_path or None,
            "gcsPath": f"gs://{bucket_name}/{storage_path}" if bucket_name and storage_path else None,
            "transcriptSummary": item.get("transcriptSummary"),
            "quickScan": item.get("quickScan"),
            "sourceAssetId": item.get("sourceAssetId"),
            "journeySourceAssetId": item.get("journeySourceAssetId"),
            "journeyStoragePath": item.get("journeyStoragePath"),
            "videoGroup": self._operation_video_group_ref(
                None,
                fallback_id=str(item.get("groupId") or ""),
                fallback_name=str(item.get("groupNameSnapshot") or ""),
            ),
            "screenshots": [
                self._frame_ref(
                    frame,
                    default_bucket_name=bucket_name,
                    include_signed_urls=include_signed_urls,
                    expires_at=expires_at,
                )
                for frame in _as_list(item.get("frameCaptures"))
                if isinstance(frame, dict)
            ],
        }
        self._attach_signed_url(video_ref, bucket_name, storage_path, include_signed_urls=include_signed_urls, expires_at=expires_at)
        return video_ref

    def _frame_ref(
        self,
        frame: dict[str, Any],
        *,
        default_bucket_name: str,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> dict[str, Any]:
        bucket_name = _clean_text(frame.get("bucketName")) or default_bucket_name
        storage_path = _clean_text(frame.get("storagePath"))
        ref = {
            "id": frame.get("id"),
            "kind": "operation_video_screenshot",
            "timestampMs": frame.get("timestampMs"),
            "fileName": frame.get("fileName"),
            "contentType": frame.get("contentType"),
            "width": frame.get("width"),
            "height": frame.get("height"),
            "bucketName": bucket_name or None,
            "storagePath": storage_path or None,
            "gcsPath": f"gs://{bucket_name}/{storage_path}" if bucket_name and storage_path else None,
        }
        self._attach_signed_url(ref, bucket_name, storage_path, include_signed_urls=include_signed_urls, expires_at=expires_at)
        return ref

    def _github_pull_requests(self, operation_videos: list[dict[str, Any]]) -> list[dict[str, Any]]:
        by_url: dict[str, dict[str, Any]] = {}
        for video in operation_videos:
            related = video.get("relatedContexts") if isinstance(video.get("relatedContexts"), dict) else {}
            github = related.get("github") if isinstance(related.get("github"), dict) else {}
            repo_full_name = github.get("repoFullName")
            for pr in _as_list(github.get("pullRequests")):
                if not isinstance(pr, dict):
                    continue
                key = str(pr.get("htmlUrl") or pr.get("number") or len(by_url))
                by_url[key] = {
                    "repoFullName": repo_full_name,
                    "number": pr.get("number"),
                    "title": pr.get("title"),
                    "htmlUrl": pr.get("htmlUrl"),
                    "author": pr.get("author"),
                    "state": pr.get("state"),
                    "mergedAt": pr.get("mergedAt"),
                    "updatedAt": pr.get("updatedAt"),
                    "labels": _as_list(pr.get("labels")),
                    "changedFiles": pr.get("changedFiles"),
                    "additions": pr.get("additions"),
                    "deletions": pr.get("deletions"),
                    "relevanceScore": pr.get("relevanceScore"),
                    "reason": pr.get("reason"),
                    "matchedSignals": _as_list(pr.get("matchedSignals")),
                }
        return sorted(
            by_url.values(),
            key=lambda item: (-(item.get("relevanceScore") or 0), item.get("updatedAt") or ""),
        )

    def _knowledge_documents(
        self,
        operation_videos: list[dict[str, Any]],
        *,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> list[dict[str, Any]]:
        by_key: dict[str, dict[str, Any]] = {}
        for video in operation_videos:
            related = video.get("relatedContexts") if isinstance(video.get("relatedContexts"), dict) else {}
            knowledge = related.get("knowledge") if isinstance(related.get("knowledge"), dict) else {}
            file_space_id = _clean_text(knowledge.get("fileSpaceId")) or _clean_text(video.get("fileSpaceId"))
            for raw_doc in _as_list(knowledge.get("documents")):
                if not isinstance(raw_doc, dict):
                    continue
                resolved_doc = self._resolve_file_space_document(file_space_id=file_space_id, raw_doc=raw_doc)
                ref = self._knowledge_document_ref(
                    resolved_doc,
                    file_space_id=file_space_id,
                    include_signed_urls=include_signed_urls,
                    expires_at=expires_at,
                )
                key = _clean_text(ref.get("documentId")) or _clean_text(ref.get("name")) or _clean_text(ref.get("gcsPath"))
                if not key:
                    continue
                by_key[key] = ref
        return sorted(
            by_key.values(),
            key=lambda item: (-(item.get("relevanceScore") or 0), item.get("displayName") or ""),
        )

    def _resolve_file_space_document(self, *, file_space_id: str, raw_doc: dict[str, Any]) -> dict[str, Any]:
        document_id = _clean_text(raw_doc.get("documentId"))
        name = _clean_text(raw_doc.get("name"))
        if not document_id and name:
            document_id = name.rstrip("/").split("/")[-1]
        if not file_space_id or not document_id:
            return raw_doc
        snap = (
            self._collection("fileSpaces")
            .document(file_space_id)
            .collection("documents")
            .document(document_id)
            .get()
        )
        if not snap.exists:
            return raw_doc
        resolved = _serialize_firestore(_doc_to_dict(snap))
        return {**raw_doc, **resolved, "documentId": document_id}

    def _knowledge_document_ref(
        self,
        item: dict[str, Any],
        *,
        file_space_id: str,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> dict[str, Any]:
        bucket_name, storage_path = _storage_ref_from_values(
            bucket_name=item.get("bucketName") or _default_storage_bucket(),
            storage_path=item.get("filePath") or item.get("storagePath"),
            gcs_path=item.get("gcsPath"),
            uri=item.get("gcsUrl") or item.get("uri"),
        )
        ref = {
            "documentId": item.get("documentId") or item.get("id"),
            "name": item.get("name"),
            "displayName": item.get("displayName") or item.get("title"),
            "description": item.get("description"),
            "mimeType": item.get("mimeType"),
            "sourceKind": item.get("sourceKind"),
            "fileSpaceId": file_space_id or item.get("storeId"),
            "bucketName": bucket_name or None,
            "filePath": storage_path or None,
            "storagePath": storage_path or None,
            "gcsUrl": f"gs://{bucket_name}/{storage_path}" if bucket_name and storage_path else item.get("gcsUrl"),
            "gcsPath": f"gs://{bucket_name}/{storage_path}" if bucket_name and storage_path else item.get("gcsPath"),
            "relevanceScore": item.get("relevanceScore"),
            "reason": item.get("reason"),
            "matchedSignals": _as_list(item.get("matchedSignals")),
        }
        self._attach_signed_url(ref, bucket_name, storage_path, include_signed_urls=include_signed_urls, expires_at=expires_at)
        return ref

    def _attach_signed_url(
        self,
        ref: dict[str, Any],
        bucket_name: str,
        storage_path: str,
        *,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> None:
        if not include_signed_urls or not bucket_name or not storage_path:
            return
        try:
            ref["downloadUrl"] = self._signed_url(bucket_name, storage_path, expires_at=expires_at)
            ref["downloadUrlExpiresAt"] = expires_at.isoformat()
        except Exception as exc:
            ref["downloadUrlError"] = str(exc)[:300]

    def _signed_url(self, bucket_name: str, storage_path: str, *, expires_at: datetime) -> str:
        blob = self.storage.bucket(bucket_name).blob(storage_path)
        try:
            return blob.generate_signed_url(expiration=expires_at, method="GET", version="v4")
        except Exception:
            credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
            credentials.refresh(GoogleAuthRequest())
            service_account_email = getattr(credentials, "service_account_email", None) or self._signed_url_service_account_email
            access_token = getattr(credentials, "token", None)
            if not service_account_email or not access_token:
                raise
            self._signed_url_credentials = credentials
            self._signed_url_service_account_email = service_account_email
            self._signed_url_access_token = access_token
            return blob.generate_signed_url(
                expiration=expires_at,
                method="GET",
                version="v4",
                service_account_email=service_account_email,
                access_token=access_token,
            )
