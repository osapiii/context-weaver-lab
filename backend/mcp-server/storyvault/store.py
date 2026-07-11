"""Firestore access layer for StoryVault MCP tools."""
from __future__ import annotations

import base64
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

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


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


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
        or _clean_text(os.getenv("STORYVAULT_MCP_DEFAULT_STORAGE_BUCKET"))
        or "storyvault-dev.firebasestorage.app"
    )


def _max_push_knowledge_bytes() -> int:
    raw = (
        _clean_text(os.getenv("STORYVAULT_MCP_PUSH_MAX_BYTES"))
        or _clean_text(os.getenv("STORYVAULT_MCP_PUSH_MAX_BYTES"))
    )
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 10 * 1024 * 1024
    return max(1, min(value, 50 * 1024 * 1024))


def _safe_storage_file_name(file_name: str) -> str:
    basename = file_name.replace("\\", "/").rstrip("/").split("/")[-1].strip()
    basename = re.sub(r"[^A-Za-z0-9._() -]+", "_", basename)
    basename = re.sub(r"\s+", " ", basename).strip(" .")
    return basename[:160] or "knowledge.md"


def _custom_metadata(key: str, value: Any) -> dict[str, str]:
    return {"key": key, "value": str(value)}


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


def _storage_ref_from_output(
    value: Any,
    *,
    preferred_nested_key: str = "",
    default_bucket_name: Any = "",
) -> tuple[str, str]:
    if not isinstance(value, dict):
        return "", ""

    candidates: list[Any] = []
    if preferred_nested_key:
        nested = value.get(preferred_nested_key)
        if isinstance(nested, dict):
            candidates.append(nested)
    candidates.append(value)

    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        bucket_name = (
            candidate.get("resultBucketName")
            or candidate.get("bucketName")
            or candidate.get("outputBucketName")
            or default_bucket_name
        )
        storage_path = (
            candidate.get("resultFilePath")
            or candidate.get("filePath")
            or candidate.get("storagePath")
            or candidate.get("outputPath")
            or candidate.get("outputFilePath")
            or candidate.get("gcsFilePath")
        )
        bucket, path = _storage_ref_from_values(
            bucket_name=bucket_name,
            storage_path=storage_path,
            gcs_path=candidate.get("gcsPath") or candidate.get("gcsUrl"),
            uri=candidate.get("uri"),
        )
        if bucket and path:
            return bucket, path
    return "", ""


def _content_type_from_path(storage_path: str) -> str | None:
    path = storage_path.lower().split("?", 1)[0]
    if path.endswith(".mp4"):
        return "video/mp4"
    if path.endswith(".webm"):
        return "video/webm"
    if path.endswith(".mov"):
        return "video/quicktime"
    if path.endswith(".m4v"):
        return "video/x-m4v"
    if path.endswith(".mp3"):
        return "audio/mpeg"
    if path.endswith(".m4a"):
        return "audio/mp4"
    if path.endswith(".wav"):
        return "audio/wav"
    if path.endswith(".aac"):
        return "audio/aac"
    if path.endswith(".ogg"):
        return "audio/ogg"
    if path.endswith(".srt"):
        return "application/x-subrip"
    if path.endswith(".ass"):
        return "text/x-ssa"
    if path.endswith(".json"):
        return "application/json"
    if path.endswith(".zip"):
        return "application/zip"
    return None


class StoryVaultStore:
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
        docs = self._collection("storyVaultApplications").limit(max(1, min(limit, 50))).stream()
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
        snap = self._collection("storyVaultApplications").document(application_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Application not found")
        return _serialize_firestore(_doc_to_dict(snap))

    def _get_application_for_write(self, application_id: str) -> dict[str, Any]:
        self._require_application(application_id)
        snap = self._collection("storyVaultApplications").document(application_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Application not found")
        return _serialize_firestore(_doc_to_dict(snap))

    def push_knowledge_document(
        self,
        *,
        application_id: str,
        file_name: str,
        mime_type: str,
        content: str = "",
        content_base64: str = "",
        title: str = "",
        description: str = "",
        story_id: str = "",
        operation_video_id: str = "",
        tags: list[Any] | None = None,
        source_note: str = "",
    ) -> dict[str, Any]:
        self.principal.require_scope("knowledge:write")
        if not application_id:
            raise HTTPException(status_code=400, detail="applicationId is required")
        if not file_name:
            raise HTTPException(status_code=400, detail="fileName is required")
        if not mime_type:
            raise HTTPException(status_code=400, detail="mimeType is required")
        if not content and not content_base64:
            raise HTTPException(status_code=400, detail="content or contentBase64 is required")

        application = self._get_application_for_write(application_id)
        file_space_id = _clean_text(application.get("fileSpaceId"))
        if not file_space_id:
            raise HTTPException(
                status_code=409,
                detail="Application does not have a FileSpace. Create the app FileSpace before pushing knowledge.",
            )

        try:
            raw_bytes = base64.b64decode(content_base64, validate=True) if content_base64 else content.encode("utf-8")
        except Exception as exc:
            raise HTTPException(status_code=400, detail="contentBase64 is not valid base64") from exc

        max_bytes = _max_push_knowledge_bytes()
        if len(raw_bytes) > max_bytes:
            raise HTTPException(status_code=413, detail=f"Knowledge document is too large. Max bytes: {max_bytes}")

        safe_name = _safe_storage_file_name(file_name)
        now = datetime.now(timezone.utc)
        stamp = now.strftime("%Y%m%dT%H%M%SZ")
        connection_id = _safe_storage_file_name(self.principal.connection_id or "mcp")
        document_id = f"mcp-{uuid4().hex[:20]}"
        file_path = (
            f"organizations/{self.principal.organization_id}/spaces/{self.principal.space_id}/"
            f"fileSpaces/{file_space_id}/knowledges/manual_upload/ai_editor/"
            f"{connection_id}/{stamp}-{document_id}-{safe_name}"
        )
        bucket_name = _default_storage_bucket()

        blob = self.storage.bucket(bucket_name).blob(file_path)
        blob.upload_from_string(raw_bytes, content_type=mime_type, timeout=120)

        gcs_url = f"gs://{bucket_name}/{file_path}"
        clean_tags = [str(tag).strip() for tag in _as_list(tags) if str(tag).strip()]
        display_name = title.strip() or safe_name
        description_text = description.strip() or source_note.strip() or None

        metadata: list[dict[str, str]] = [
            _custom_metadata("sourceKind", "en-aistudioData"),
            _custom_metadata("documentKind", "en-aistudioData"),
            _custom_metadata("source", "en-aistudioData"),
            _custom_metadata("uploadedVia", "remote_mcp"),
            _custom_metadata("externalAgent", self.principal.external_agent),
            _custom_metadata("mcpConnectionId", self.principal.connection_id),
            _custom_metadata("applicationId", application_id),
            _custom_metadata("fileName", safe_name),
            _custom_metadata("displayName", display_name),
        ]
        if story_id:
            metadata.append(_custom_metadata("storyId", story_id))
        if operation_video_id:
            metadata.append(_custom_metadata("operationVideoId", operation_video_id))
        if clean_tags:
            metadata.append(_custom_metadata("tags", ",".join(clean_tags)))
        if source_note:
            metadata.append(_custom_metadata("sourceNote", source_note))

        request_id = f"fileSpace_fileSpaceUpload_{int(now.timestamp() * 1000)}_{uuid4().hex[:8]}"
        request_data = {
            "input": {
                "operationType": "fileSpaceUpload",
                "storeId": file_space_id,
                "bucketName": bucket_name,
                "filePath": file_path,
                "customMetadata": metadata,
                "mimeType": mime_type,
                "documentId": document_id,
                "description": description_text,
                "originalFileInfo": {
                    "fileName": safe_name,
                    "bytes": len(raw_bytes),
                },
            },
            "operationMetadata": {
                "organizationId": self.principal.organization_id,
                "spaceId": self.principal.space_id,
                "loggingCollectionId": "requests/contextStoreRequests/logs",
                "loggingDocumentId": request_id,
                "requestedBy": {
                    "userId": self.principal.connection_id,
                    "email": f"{self.principal.external_agent}@remote-mcp.local",
                    "role": 3,
                },
                "isCommand": True,
                "isOouiCrud": True,
                "isLlmCall": False,
                "isAdminCrud": False,
                "externalAgent": self.principal.external_agent,
                "mcpConnectionId": self.principal.connection_id,
            },
            "output": None,
            "status": "pending",
            "logs": [],
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        (
            self.db.collection("organizations")
            .document(self.principal.organization_id)
            .collection("spaces")
            .document(self.principal.space_id)
            .collection("requests")
            .document("contextStoreRequests")
            .collection("logs")
            .document(request_id)
            .set(request_data)
        )

        document_data = {
            "name": f"fileSearchStores/{file_space_id}/documents/{document_id}",
            "displayName": display_name,
            "description": description_text,
            "createTime": now.isoformat(),
            "updateTime": now.isoformat(),
            "state": "STATE_PENDING",
            "sizeBytes": str(len(raw_bytes)),
            "mimeType": mime_type,
            "bucketName": bucket_name,
            "filePath": file_path,
            "gcsUrl": gcs_url,
            "status": "uploading",
            "subCategory": "fileUpload",
            "originalFileInfo": {
                "fileName": safe_name,
                "bytes": len(raw_bytes),
            },
            "storeId": file_space_id,
            "organizationId": self.principal.organization_id,
            "spaceId": self.principal.space_id,
            "sourceKind": "en-aistudioData",
            "enAiStudioDataKind": "en-aistudioData",
            "uploadedVia": "remote_mcp",
            "externalAgent": self.principal.external_agent,
            "mcpConnectionId": self.principal.connection_id,
            "applicationId": application_id,
            "storyId": story_id or None,
            "operationVideoId": operation_video_id or None,
            "tags": clean_tags,
            "sourceNote": source_note or None,
            "registration": {
                "stage": "uploading",
                "gcsUploaded": True,
                "geminiRegistered": False,
            },
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        (
            self._collection("fileSpaces")
            .document(file_space_id)
            .collection("documents")
            .document(document_id)
            .set(document_data, merge=True)
        )

        return {
            "requestId": request_id,
            "fileSpaceId": file_space_id,
            "documentId": document_id,
            "bucketName": bucket_name,
            "filePath": file_path,
            "gcsUrl": gcs_url,
            "status": "accepted",
            "registrationStatus": "processing",
            "message": "アップロードリクエストを受け付けました。少し時間が経つとSearch Storeへの登録が完了します。",
        }

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
        q = self._collection("storyVaultStories").where(
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
        q = self._collection("storyVaultOperationVideoGroups").where(
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

    def list_clip_groups(
        self,
        *,
        application_id: str,
        query: str = "",
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        """List the clip groups used by the current StoryVault UI."""
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        q = self._collection("storyVaultClipGroups").where(
            filter=firestore.FieldFilter("applicationId", "==", application_id)
        )
        docs = [_serialize_firestore(_doc_to_dict(snap)) for snap in q.limit(max(1, min(limit, 200))).stream()]
        needle = query.strip().lower()
        if needle:
            docs = [
                group
                for group in docs
                if needle
                in " ".join(
                    str(group.get(key) or "")
                    for key in ("id", "name", "description", "applicationKey")
                ).lower()
            ]
        return sorted(docs, key=lambda item: str(item.get("updatedAt") or item.get("createdAt") or ""), reverse=True)

    def list_clips(
        self,
        *,
        application_id: str,
        clip_group_id: str = "",
        query: str = "",
        discovery_status: str = "",
        analysis_status: str = "",
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        """List the clips used by the current StoryVault UI, with group refs and story counts."""
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        q = self._collection("storyVaultClips").where(
            filter=firestore.FieldFilter("applicationId", "==", application_id)
        )
        if clip_group_id:
            q = q.where(filter=firestore.FieldFilter("clipGroupId", "==", clip_group_id))
        if discovery_status:
            q = q.where(filter=firestore.FieldFilter("discoveryStatus", "==", discovery_status))
        if analysis_status:
            q = q.where(filter=firestore.FieldFilter("analysisStatus", "==", analysis_status))
        docs = [_serialize_firestore(_doc_to_dict(snap)) for snap in q.limit(max(1, min(limit, 200))).stream()]
        needle = query.strip().lower()
        if needle:
            docs = [
                clip
                for clip in docs
                if needle
                in " ".join(
                    str(clip.get(key) or "")
                    for key in (
                        "id",
                        "title",
                        "description",
                        "clipGroupNameSnapshot",
                        "transcriptSummary",
                        "discoveryStatus",
                        "analysisStatus",
                    )
                ).lower()
            ]
        group_ids = {str(clip.get("clipGroupId") or "") for clip in docs if clip.get("clipGroupId")}
        groups: dict[str, dict[str, Any]] = {}
        for group_id in group_ids:
            snap = self._collection("storyVaultClipGroups").document(group_id).get()
            if snap.exists:
                groups[group_id] = _serialize_firestore(_doc_to_dict(snap))
        result: list[dict[str, Any]] = []
        for clip in docs:
            analysis_result = _as_dict(clip.get("analysisResult"))
            candidates = _as_list(analysis_result.get("storyCandidates") or analysis_result.get("story_candidates"))
            group_id = str(clip.get("clipGroupId") or "")
            group = groups.get(group_id) or {}
            result.append(
                {
                    **clip,
                    "clipGroup": {
                        "id": group_id,
                        "name": group.get("name") or clip.get("clipGroupNameSnapshot") or "",
                        "description": group.get("description"),
                        "clipCount": group.get("clipCount"),
                    },
                    "storyCandidateCount": len(candidates),
                }
            )
        return sorted(result, key=lambda item: str(item.get("recordedAt") or item.get("createdAt") or ""), reverse=True)

    def list_clip_stories(
        self,
        *,
        application_id: str,
        clip_group_id: str = "",
        clip_id: str = "",
        query: str = "",
        limit: int = 500,
    ) -> list[dict[str, Any]]:
        """Flatten story candidates embedded in current UI clips."""
        clips = self.list_clips(
            application_id=application_id,
            clip_group_id=clip_group_id,
            limit=200,
        )
        if clip_id:
            clips = [clip for clip in clips if str(clip.get("id") or "") == clip_id]
        stories: list[dict[str, Any]] = []
        for clip in clips:
            analysis_result = _as_dict(clip.get("analysisResult"))
            candidates = _as_list(analysis_result.get("storyCandidates") or analysis_result.get("story_candidates"))
            for index, candidate_value in enumerate(candidates):
                candidate = _as_dict(candidate_value)
                candidate_id = str(candidate.get("id") or f"story-{index + 1:03d}")
                evidence = _as_list(candidate.get("evidence"))
                stories.append(
                    {
                        **candidate,
                        "id": f"{clip.get('id')}:{candidate_id}",
                        "candidateId": candidate_id,
                        "sourceType": "clip_story_candidate",
                        "applicationId": application_id,
                        "clipId": clip.get("id"),
                        "clipTitle": clip.get("title"),
                        "clipGroupId": clip.get("clipGroupId"),
                        "clipGroup": clip.get("clipGroup"),
                        "evidenceCount": len(evidence),
                        "analysisStatus": clip.get("analysisStatus"),
                        "analyzedAt": clip.get("analyzedAt"),
                    }
                )
        needle = query.strip().lower()
        if needle:
            stories = [
                story
                for story in stories
                if needle
                in " ".join(
                    str(story.get(key) or "")
                    for key in (
                        "id",
                        "candidateId",
                        "storyKey",
                        "title",
                        "summary",
                        "userStory",
                        "goal",
                        "benefit",
                        "clipTitle",
                    )
                ).lower()
            ]
        return stories[: max(1, min(limit, 500))]

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
        q = self._collection("storyVaultOperationVideos").where(
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
        snap = self._collection("storyVaultOperationVideos").document(operation_video_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Operation video not found")
        video = _serialize_firestore(_doc_to_dict(snap))
        self._require_application(str(video.get("applicationId") or ""))
        return video

    def get_story(self, story_id: str) -> dict[str, Any]:
        self.principal.require_scope("context:read")
        snap = self._collection("storyVaultStories").document(story_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Story not found")
        story = _serialize_firestore(_doc_to_dict(snap))
        self._require_application(str(story.get("applicationId") or ""))
        return story

    def get_capability(self, capability_id: str) -> dict[str, Any] | None:
        self.principal.require_scope("context:read")
        if not capability_id:
            return None
        snap = self._collection("storyVaultCapabilities").document(capability_id).get()
        if not snap.exists:
            return None
        capability = _serialize_firestore(_doc_to_dict(snap))
        self._require_application(str(capability.get("applicationId") or ""))
        return capability

    def evidence_for_story(self, *, application_id: str, story_id: str, story_key: str) -> list[dict[str, Any]]:
        self.principal.require_scope("context:read")
        self._require_application(application_id)
        collection = self._collection("storyVaultStoryEvidence")
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
            snap = self._collection("storyVaultSourceAssets").document(source_asset_id).get()
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
            "schemaVersion": "storyvault-story-assets-v1",
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
                    include_video_studio_assets=True,
                )
                for item in operation_videos
            ],
            "githubPullRequests": self._github_pull_requests(operation_videos),
            "slackMessages": self._slack_messages(operation_videos),
            "jiraIssues": self._jira_issues(operation_videos),
            "knowledgeDocuments": self._knowledge_documents(
                operation_videos,
                include_signed_urls=include_signed_urls,
                expires_at=expires_at,
            ),
        }
        manifest["assetCounts"] = {
            "sourceAssets": len(manifest["sourceAssets"]),
            "operationVideos": len(manifest["operationVideos"]),
            "videoClips": sum(len(item.get("clips") or []) for item in manifest["operationVideos"]),
            "screenshots": sum(
                len(clip.get("screenshots") or [])
                for item in manifest["operationVideos"]
                for clip in _as_list(item.get("clips"))
                if isinstance(clip, dict)
            ),
            "githubPullRequests": len(manifest["githubPullRequests"]),
            "slackMessages": len(manifest["slackMessages"]),
            "jiraIssues": len(manifest["jiraIssues"]),
            "knowledgeDocuments": len(manifest["knowledgeDocuments"]),
            "generatedAssets": sum(
                len(_as_list(item.get("generatedAssets")))
                for item in manifest["operationVideos"]
                if isinstance(item, dict)
            ),
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

        source_asset_ids = []
        for item in [
            _clean_text(video.get("sourceAssetId")),
            _clean_text(video.get("journeySourceAssetId")),
        ]:
            if item and item not in source_asset_ids:
                source_asset_ids.append(item)
        for clip in self._operation_video_clips(video):
            for item in [
                _clean_text(clip.get("sourceAssetId")),
                _clean_text(clip.get("journeySourceAssetId")),
            ]:
                if item and item not in source_asset_ids:
                    source_asset_ids.append(item)
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
            include_video_studio_assets=True,
        )
        source_asset_refs = [
            self._source_asset_ref(item, include_signed_urls=include_signed_urls, expires_at=expires_at)
            for item in source_assets
        ]
        pull_requests = self._github_pull_requests([video])
        slack_messages = self._slack_messages([video])
        jira_issues = self._jira_issues([video])
        knowledge_documents = self._knowledge_documents(
            [video],
            include_signed_urls=include_signed_urls,
            expires_at=expires_at,
        )
        return {
            "schemaVersion": "storyvault-operation-video-context-v1",
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
            "slackMessages": slack_messages,
            "jiraIssues": jira_issues,
            "knowledgeDocuments": knowledge_documents,
            "counts": {
                "linkedStories": len(stories),
                "evidence": len(evidence),
                "sourceAssets": len(source_asset_refs),
                "videoClips": len(video_ref.get("clips") or []),
                "screenshots": sum(
                    len(clip.get("screenshots") or [])
                    for clip in _as_list(video_ref.get("clips"))
                    if isinstance(clip, dict)
                ),
                "githubPullRequests": len(pull_requests),
                "slackMessages": len(slack_messages),
                "jiraIssues": len(jira_issues),
                "knowledgeDocuments": len(knowledge_documents),
                "generatedAssets": len(_as_list(video_ref.get("generatedAssets"))),
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
        collection = self._collection("storyVaultStoryEvidence")
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
            collection = self._collection("storyVaultStories")
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
        snap = self._collection("storyVaultOperationVideoGroups").document(group_id).get()
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
            "detailedSpecifications": item.get("detailedSpecifications") if isinstance(item.get("detailedSpecifications"), list) else [],
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
            snap = self._collection("storyVaultOperationVideos").document(operation_video_id).get()
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
        include_video_studio_assets: bool = False,
    ) -> dict[str, Any]:
        clips = self._operation_video_clips(item)
        primary_clip = clips[0] if clips else {}
        bucket_name = _clean_text(primary_clip.get("bucketName") or item.get("bucketName"))
        storage_path = _clean_text(primary_clip.get("storagePath") or item.get("storagePath"))
        analysis_result = _as_dict(item.get("analysisResult"))
        clip_refs = [
            self._operation_video_clip_ref(
                clip,
                include_signed_urls=include_signed_urls,
                expires_at=expires_at,
            )
            for clip in clips
        ]
        screenshots = [
            frame
            for clip_ref in clip_refs
            for frame in _as_list(clip_ref.get("screenshots"))
            if isinstance(frame, dict)
        ]
        transcript_source = primary_clip if _as_list(primary_clip.get("transcriptSegments")) else item
        transcript_segments = self._transcript_segment_refs(transcript_source)
        raw_transcript_segments = _as_list(transcript_source.get("transcriptSegments"))
        story_candidates = self._story_candidate_refs(
            analysis_result.get("storyCandidates"),
            screenshots=screenshots,
        )
        video_studio_projects = (
            self._video_studio_project_refs(
                operation_video_id=str(item.get("id") or ""),
                include_signed_urls=include_signed_urls,
                expires_at=expires_at,
            )
            if include_video_studio_assets
            else []
        )
        generated_assets = [
            asset
            for project in video_studio_projects
            for asset in _as_list(project.get("generatedAssets"))
            if isinstance(asset, dict)
        ]
        video_ref = {
            "id": item.get("id"),
            "kind": "operation_video",
            "title": item.get("title"),
            "description": item.get("description"),
            "contentType": primary_clip.get("contentType") or item.get("contentType"),
            "sizeBytes": primary_clip.get("sizeBytes") or item.get("sizeBytes"),
            "durationMs": item.get("totalDurationMs") or primary_clip.get("durationMs") or item.get("durationMs"),
            "recordedAt": primary_clip.get("recordedAt") or item.get("recordedAt"),
            "bucketName": bucket_name or None,
            "storagePath": storage_path or None,
            "gcsPath": f"gs://{bucket_name}/{storage_path}" if bucket_name and storage_path else None,
            "transcriptSummary": primary_clip.get("transcriptSummary") or item.get("transcriptSummary"),
            "transcriptProvider": primary_clip.get("transcriptProvider") or item.get("transcriptProvider"),
            "transcriptTimingStatus": primary_clip.get("transcriptTimingStatus") or item.get("transcriptTimingStatus"),
            "transcriptSegmentCount": len(raw_transcript_segments),
            "transcriptSegments": transcript_segments,
            "transcriptSegmentsTruncated": len(raw_transcript_segments) > len(transcript_segments),
            "quickScan": primary_clip.get("quickScan") or item.get("quickScan"),
            "analysisStatus": item.get("analysisStatus"),
            "analyzedAt": item.get("analyzedAt"),
            "analysisResult": {
                "generatedAt": analysis_result.get("generatedAt"),
                "operationIntent": analysis_result.get("operationIntent"),
                "productContextSummary": analysis_result.get("productContextSummary"),
                "transcriptSummary": analysis_result.get("transcriptSummary"),
                "notes": analysis_result.get("notes"),
            }
            if analysis_result
            else None,
            "storyCandidateCount": len(story_candidates),
            "storyCandidates": story_candidates,
            "sourceAssetId": primary_clip.get("sourceAssetId") or item.get("sourceAssetId"),
            "journeySourceAssetId": primary_clip.get("journeySourceAssetId") or item.get("journeySourceAssetId"),
            "journeyStoragePath": primary_clip.get("journeyStoragePath") or item.get("journeyStoragePath"),
            "clipCount": len(clip_refs),
            "clips": clip_refs,
            "videoStudio": {
                "videoId": f"storyvault_{item.get('id')}",
                "projectCount": len(video_studio_projects),
                "projects": video_studio_projects,
            }
            if include_video_studio_assets
            else None,
            "generatedAssetCount": len(generated_assets),
            "generatedAssets": generated_assets,
            "videoGroup": self._operation_video_group_ref(
                None,
                fallback_id=str(item.get("groupId") or ""),
                fallback_name=str(item.get("groupNameSnapshot") or ""),
            ),
            "screenshots": screenshots,
        }
        self._attach_signed_url(video_ref, bucket_name, storage_path, include_signed_urls=include_signed_urls, expires_at=expires_at)
        return video_ref

    def _video_studio_project_refs(
        self,
        *,
        operation_video_id: str,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> list[dict[str, Any]]:
        if not operation_video_id:
            return []
        video_id = f"storyvault_{operation_video_id}"
        preferred_project_id = f"storyvault_narration_{operation_video_id}"
        collection = self._collection("videos").document(video_id).collection("narrationProjects")
        projects: dict[str, dict[str, Any]] = {}

        try:
            snap = collection.document(preferred_project_id).get()
            if snap.exists:
                projects[snap.id] = _serialize_firestore(_doc_to_dict(snap))
        except Exception:
            pass

        if not projects:
            try:
                for snap in collection.limit(10).stream():
                    projects[snap.id] = _serialize_firestore(_doc_to_dict(snap))
            except Exception:
                return []

        refs = [
            self._video_studio_project_ref(
                project,
                video_id=video_id,
                include_signed_urls=include_signed_urls,
                expires_at=expires_at,
            )
            for project in projects.values()
        ]
        return [
            ref
            for ref in sorted(refs, key=lambda item: str(item.get("updatedAt") or item.get("lastEditedAt") or ""), reverse=True)
            if ref.get("generatedAssets")
        ]

    def _video_studio_project_ref(
        self,
        project: dict[str, Any],
        *,
        video_id: str,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> dict[str, Any]:
        generated_assets = self._video_studio_generated_assets(
            project,
            video_id=video_id,
            include_signed_urls=include_signed_urls,
            expires_at=expires_at,
        )
        return {
            "id": project.get("id"),
            "videoId": video_id,
            "name": project.get("name"),
            "description": project.get("description"),
            "status": project.get("status"),
            "currentStep": project.get("currentStep"),
            "completedSteps": _as_list(project.get("completedSteps")),
            "updatedAt": project.get("updatedAt"),
            "lastEditedAt": project.get("lastEditedAt"),
            "subtitleSettings": project.get("subtitleSettings"),
            "silenceCutSettings": project.get("silenceCutSettings"),
            "generatedAssetCount": len(generated_assets),
            "generatedAssets": generated_assets,
        }

    def _video_studio_generated_assets(
        self,
        project: dict[str, Any],
        *,
        video_id: str,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> list[dict[str, Any]]:
        assets: list[dict[str, Any]] = []
        default_bucket_name = _default_storage_bucket()
        project_id = _clean_text(project.get("id"))
        project_name = _clean_text(project.get("name"))

        def add_asset(
            *,
            key: str,
            kind: str,
            label: str,
            role: str,
            source_field: str,
            bucket_name: str,
            storage_path: str,
            request_id: Any = None,
            generated_at: Any = None,
            statistics: Any = None,
            settings: Any = None,
        ) -> None:
            if not bucket_name or not storage_path:
                return
            content_type = _content_type_from_path(storage_path)
            if role == "audio" and storage_path.lower().split("?", 1)[0].endswith(".webm"):
                content_type = "audio/webm"
            ref = {
                "id": f"{project_id}:{key}" if project_id else key,
                "key": key,
                "kind": kind,
                "role": role,
                "label": label,
                "sourceField": source_field,
                "projectId": project_id or None,
                "projectName": project_name or None,
                "videoStudioVideoId": video_id,
                "bucketName": bucket_name,
                "storagePath": storage_path,
                "filePath": storage_path,
                "gcsPath": f"gs://{bucket_name}/{storage_path}",
                "contentType": content_type,
                "requestId": request_id,
                "generatedAt": generated_at,
                "statistics": statistics if isinstance(statistics, dict) else None,
                "settings": settings if isinstance(settings, dict) else None,
                "externalEditingHint": "downloadUrl is a signed URL suitable for DaVinci Resolve or other external video tools until downloadUrlExpiresAt.",
            }
            self._attach_signed_url(ref, bucket_name, storage_path, include_signed_urls=include_signed_urls, expires_at=expires_at)
            assets.append(ref)

        merged_output = _as_dict(project.get("mergedVideoOutput"))
        bucket_name, storage_path = _storage_ref_from_output(
            merged_output,
            preferred_nested_key="mergedVideoPath",
            default_bucket_name=default_bucket_name,
        )
        add_asset(
            key="final-video",
            kind="final_video",
            role="video",
            label="字幕なし最終動画",
            source_field="mergedVideoOutput",
            bucket_name=bucket_name,
            storage_path=storage_path,
            request_id=merged_output.get("requestId"),
            generated_at=merged_output.get("generatedAt"),
            statistics=merged_output.get("statistics"),
        )

        legacy_silence_output = _as_dict(project.get("mergedVideoOutputSilenceCut"))
        bucket_name, storage_path = _storage_ref_from_output(
            legacy_silence_output,
            default_bucket_name=default_bucket_name,
        )
        add_asset(
            key="legacy-silence-cut-video",
            kind="silence_cut_video",
            role="video",
            label="無音カット版動画",
            source_field="mergedVideoOutputSilenceCut",
            bucket_name=bucket_name,
            storage_path=storage_path,
            request_id=legacy_silence_output.get("requestId"),
            generated_at=legacy_silence_output.get("generatedAt"),
            statistics=legacy_silence_output.get("statistics"),
            settings=legacy_silence_output.get("settings") or project.get("silenceCutSettings"),
        )

        silence_output = _as_dict(project.get("silenceCutOutput"))
        bucket_name, storage_path = _storage_ref_from_output(
            silence_output,
            preferred_nested_key="trimmedVideo",
            default_bucket_name=default_bucket_name,
        )
        add_asset(
            key="silence-cut-video",
            kind="silence_cut_video",
            role="video",
            label="無音カット版動画",
            source_field="silenceCutOutput.trimmedVideo",
            bucket_name=bucket_name,
            storage_path=storage_path,
            request_id=silence_output.get("requestId"),
            generated_at=silence_output.get("generatedAt"),
            statistics=silence_output.get("statistics"),
            settings=silence_output.get("settings") or project.get("silenceCutSettings"),
        )
        bucket_name, storage_path = _storage_ref_from_output(
            silence_output,
            preferred_nested_key="manifest",
            default_bucket_name=default_bucket_name,
        )
        add_asset(
            key="silence-cut-manifest",
            kind="silence_cut_manifest",
            role="json_manifest",
            label="無音カット manifest JSON",
            source_field="silenceCutOutput.manifest",
            bucket_name=bucket_name,
            storage_path=storage_path,
            request_id=silence_output.get("requestId"),
            generated_at=silence_output.get("generatedAt"),
            statistics=silence_output.get("statistics"),
            settings=silence_output.get("settings") or project.get("silenceCutSettings"),
        )

        subtitle_output = _as_dict(project.get("subtitleOutput"))
        bucket_name, storage_path = _storage_ref_from_output(
            subtitle_output,
            preferred_nested_key="subtitledVideo",
            default_bucket_name=default_bucket_name,
        )
        add_asset(
            key="subtitled-video",
            kind="subtitled_video",
            role="video",
            label="字幕付き最終動画",
            source_field="subtitleOutput.subtitledVideo",
            bucket_name=bucket_name,
            storage_path=storage_path,
            request_id=subtitle_output.get("requestId"),
            generated_at=subtitle_output.get("generatedAt"),
            statistics=subtitle_output.get("statistics"),
            settings=project.get("subtitleSettings"),
        )
        for nested_key, kind, label, role in [
            ("srt", "subtitle_srt", "字幕 SRT", "subtitle"),
            ("ass", "subtitle_ass", "字幕 ASS", "subtitle"),
        ]:
            bucket_name, storage_path = _storage_ref_from_output(
                subtitle_output,
                preferred_nested_key=nested_key,
                default_bucket_name=default_bucket_name,
            )
            add_asset(
                key=f"subtitle-{nested_key}",
                kind=kind,
                role=role,
                label=label,
                source_field=f"subtitleOutput.{nested_key}",
                bucket_name=bucket_name,
                storage_path=storage_path,
                request_id=subtitle_output.get("requestId"),
                generated_at=subtitle_output.get("generatedAt"),
                statistics=subtitle_output.get("statistics"),
                settings=project.get("subtitleSettings"),
            )

        for section_index, section in enumerate(_as_list(project.get("sections"))):
            if not isinstance(section, dict):
                continue
            section_id = _clean_text(section.get("id")) or str(section_index + 1)
            section_label = _clean_text(section.get("title")) or f"セクション {section_index + 1}"
            section_output = _as_dict(section.get("mergedVideoOutput"))
            bucket_name, storage_path = _storage_ref_from_output(
                section_output,
                default_bucket_name=default_bucket_name,
            )
            add_asset(
                key=f"section-video-{section_id}",
                kind="section_video",
                role="video",
                label=f"{section_label} / 音声付き動画",
                source_field=f"sections[{section_index}].mergedVideoOutput",
                bucket_name=bucket_name,
                storage_path=storage_path,
                request_id=section_output.get("requestId"),
                generated_at=section_output.get("generatedAt"),
                statistics=section_output.get("statistics"),
            )

            recording = _as_dict(section.get("recording"))
            bucket_name, storage_path = _storage_ref_from_values(
                bucket_name=recording.get("audioBucketName"),
                storage_path=recording.get("audioFilePath"),
            )
            add_asset(
                key=f"recording-audio-{section_id}",
                kind="recording_audio",
                role="audio",
                label=f"{section_label} / 録音音声",
                source_field=f"sections[{section_index}].recording",
                bucket_name=bucket_name,
                storage_path=storage_path,
                request_id=recording.get("transcriptionRequestId"),
                generated_at=recording.get("recordedAt"),
            )

            for segment_index, segment in enumerate(_as_list(section.get("finalyNarrations"))):
                if not isinstance(segment, dict):
                    continue
                request_output = _as_dict(segment.get("requestOutput"))
                bucket_name, storage_path = _storage_ref_from_output(
                    request_output,
                    default_bucket_name=default_bucket_name,
                )
                add_asset(
                    key=f"ai-audio-{section_id}-{segment_index}",
                    kind="ai_audio",
                    role="audio",
                    label=f"{section_label} / AI音声 {segment_index + 1}",
                    source_field=f"sections[{section_index}].finalyNarrations[{segment_index}].requestOutput",
                    bucket_name=bucket_name,
                    storage_path=storage_path,
                    request_id=request_output.get("requestId"),
                    generated_at=request_output.get("generatedAt"),
                    statistics={"durationSeconds": request_output.get("durationSeconds")}
                    if request_output.get("durationSeconds") is not None
                    else None,
                )

        seen: set[tuple[str, str, str]] = set()
        unique_assets: list[dict[str, Any]] = []
        for asset in assets:
            key = (
                _clean_text(asset.get("kind")),
                _clean_text(asset.get("bucketName")),
                _clean_text(asset.get("storagePath")),
            )
            if key in seen:
                continue
            seen.add(key)
            unique_assets.append(asset)
        return unique_assets

    def _operation_video_clips(self, item: dict[str, Any]) -> list[dict[str, Any]]:
        clips = [clip for clip in _as_list(item.get("clips")) if isinstance(clip, dict)]
        if clips:
            return sorted(clips, key=lambda clip: str(clip.get("recordedAt") or ""))
        return [
            {
                "id": "clip-001",
                "fileName": item.get("fileName"),
                "bucketName": item.get("bucketName"),
                "storagePath": item.get("storagePath"),
                "contentType": item.get("contentType"),
                "sizeBytes": item.get("sizeBytes"),
                "durationMs": item.get("durationMs"),
                "recordedAt": item.get("recordedAt"),
                "transcriptSummary": item.get("transcriptSummary"),
                "quickScan": item.get("quickScan"),
                "sourceAssetId": item.get("sourceAssetId"),
                "journeySourceAssetId": item.get("journeySourceAssetId"),
                "journeyStoragePath": item.get("journeyStoragePath"),
                "frameCaptures": item.get("frameCaptures"),
                "transcriptProvider": item.get("transcriptProvider"),
                "transcriptTimingStatus": item.get("transcriptTimingStatus"),
                "transcriptSegments": item.get("transcriptSegments"),
            }
        ]

    def _operation_video_clip_ref(
        self,
        clip: dict[str, Any],
        *,
        include_signed_urls: bool,
        expires_at: datetime,
    ) -> dict[str, Any]:
        bucket_name = _clean_text(clip.get("bucketName"))
        storage_path = _clean_text(clip.get("storagePath"))
        transcript_segments = self._transcript_segment_refs(clip)
        raw_transcript_segments = _as_list(clip.get("transcriptSegments"))
        ref = {
            "id": clip.get("id"),
            "kind": "operation_video_clip",
            "fileName": clip.get("fileName"),
            "contentType": clip.get("contentType"),
            "sizeBytes": clip.get("sizeBytes"),
            "durationMs": clip.get("durationMs"),
            "recordedAt": clip.get("recordedAt"),
            "bucketName": bucket_name or None,
            "storagePath": storage_path or None,
            "gcsPath": f"gs://{bucket_name}/{storage_path}" if bucket_name and storage_path else None,
            "transcriptSummary": clip.get("transcriptSummary"),
            "transcriptProvider": clip.get("transcriptProvider"),
            "transcriptTimingStatus": clip.get("transcriptTimingStatus"),
            "transcriptSegmentCount": len(raw_transcript_segments),
            "transcriptSegments": transcript_segments,
            "transcriptSegmentsTruncated": len(raw_transcript_segments) > len(transcript_segments),
            "quickScan": clip.get("quickScan"),
            "sourceAssetId": clip.get("sourceAssetId"),
            "journeySourceAssetId": clip.get("journeySourceAssetId"),
            "journeyStoragePath": clip.get("journeyStoragePath"),
            "screenshots": [
                self._frame_ref(
                    frame,
                    default_bucket_name=bucket_name,
                    include_signed_urls=include_signed_urls,
                    expires_at=expires_at,
                )
                for frame in _as_list(clip.get("frameCaptures"))
                if isinstance(frame, dict)
            ],
        }
        self._attach_signed_url(ref, bucket_name, storage_path, include_signed_urls=include_signed_urls, expires_at=expires_at)
        return ref

    def _transcript_segment_refs(self, item: dict[str, Any], *, limit: int = 300) -> list[dict[str, Any]]:
        segments: list[dict[str, Any]] = []
        for cue in _as_list(item.get("transcriptSegments"))[:limit]:
            if not isinstance(cue, dict):
                continue
            segments.append(
                {
                    "id": cue.get("id"),
                    "index": cue.get("index"),
                    "startMs": cue.get("startMs"),
                    "endMs": cue.get("endMs"),
                    "text": cue.get("text"),
                    "confidence": cue.get("confidence"),
                }
            )
        return segments

    def _story_candidate_refs(
        self,
        candidates: Any,
        *,
        screenshots: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        refs: list[dict[str, Any]] = []
        for index, candidate in enumerate(_as_list(candidates)):
            if not isinstance(candidate, dict):
                continue
            refs.append(self._story_candidate_ref(candidate, index=index, screenshots=screenshots))
        return refs

    def _story_candidate_ref(
        self,
        candidate: dict[str, Any],
        *,
        index: int,
        screenshots: list[dict[str, Any]],
    ) -> dict[str, Any]:
        role = _as_dict(candidate.get("role"))
        who = _clean_text(role.get("value")) or _clean_text(candidate.get("asA"))
        what = _clean_text(candidate.get("goal")) or _clean_text(candidate.get("iWant"))
        why = _clean_text(candidate.get("benefit")) or _clean_text(candidate.get("soThat"))
        evidence = [
            self._story_candidate_evidence_ref(item, screenshots=screenshots)
            for item in _as_list(candidate.get("evidence"))
            if isinstance(item, dict)
        ]
        confidence = candidate.get("confidenceScore")
        if confidence is None:
            confidence = candidate.get("confidence")
        return {
            "id": candidate.get("id") or f"candidate-{index + 1:03d}",
            "storyKey": candidate.get("storyKey"),
            "title": candidate.get("title"),
            "summary": candidate.get("summary"),
            "userStory": candidate.get("userStory"),
            "who": who or None,
            "what": what or None,
            "why": why or None,
            "role": role or None,
            "asA": candidate.get("asA"),
            "iWant": candidate.get("iWant"),
            "soThat": candidate.get("soThat"),
            "goal": candidate.get("goal"),
            "benefit": candidate.get("benefit"),
            "acceptanceCriteria": [
                str(item).strip()
                for item in _as_list(candidate.get("acceptanceCriteria"))
                if str(item).strip()
            ],
            "detailedSpecifications": [
                str(item).strip()
                for item in _as_list(candidate.get("detailedSpecifications"))
                if str(item).strip()
            ],
            "confidenceScore": confidence,
            "unverified": candidate.get("unverified"),
            "evidence": evidence,
            "evidenceCount": len(evidence),
            "transcriptCueIds": sorted(
                {
                    str(cue_id)
                    for evidence_item in evidence
                    for cue_id in _as_list(evidence_item.get("transcriptCueIds"))
                    if str(cue_id).strip()
                }
            ),
            "screenshotCount": sum(len(_as_list(evidence_item.get("screenshots"))) for evidence_item in evidence),
        }

    def _story_candidate_evidence_ref(
        self,
        evidence: dict[str, Any],
        *,
        screenshots: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return {
            "videoId": evidence.get("videoId"),
            "clipId": evidence.get("clipId"),
            "title": evidence.get("title"),
            "summary": evidence.get("summary"),
            "tRange": evidence.get("tRange") if isinstance(evidence.get("tRange"), list) else [],
            "transcriptCueIds": evidence.get("transcriptCueIds")
            if isinstance(evidence.get("transcriptCueIds"), list)
            else [],
            "transcriptQuote": evidence.get("transcriptQuote"),
            "representativeScreenshotId": evidence.get("representativeScreenshotId"),
            "screenshotIds": evidence.get("screenshotIds") if isinstance(evidence.get("screenshotIds"), list) else [],
            "screenshots": self._screenshots_for_story_evidence(evidence, screenshots=screenshots),
        }

    def _screenshots_for_story_evidence(
        self,
        evidence: dict[str, Any],
        *,
        screenshots: list[dict[str, Any]],
        limit: int = 6,
    ) -> list[dict[str, Any]]:
        frames = [frame for frame in screenshots if isinstance(frame, dict)]
        if not frames:
            return []

        ids = [
            _clean_text(evidence.get("representativeScreenshotId")),
            *[
                _clean_text(item)
                for item in _as_list(evidence.get("screenshotIds"))
                if _clean_text(item)
            ],
        ]
        ordered_ids = [item for item in ids if item]
        if ordered_ids:
            by_id = {str(frame.get("id")): frame for frame in frames if frame.get("id")}
            matched = [by_id[item] for item in ordered_ids if item in by_id]
            if matched:
                return matched[:limit]

        t_range = _as_list(evidence.get("tRange"))
        start_seconds = _as_float(t_range[0]) if len(t_range) > 0 else None
        end_seconds = _as_float(t_range[1]) if len(t_range) > 1 else None
        if start_seconds is None:
            return frames[: min(limit, 3)]

        start_ms = start_seconds * 1000
        end_ms = (end_seconds if end_seconds is not None else start_seconds) * 1000
        within = [
            frame
            for frame in frames
            if _as_float(frame.get("timestampMs")) is not None
            and start_ms <= float(frame.get("timestampMs")) <= end_ms
        ]
        if within:
            return sorted(within, key=lambda frame: float(frame.get("timestampMs") or 0))[:limit]

        nearest = sorted(
            [
                frame
                for frame in frames
                if _as_float(frame.get("timestampMs")) is not None
            ],
            key=lambda frame: abs(float(frame.get("timestampMs") or 0) - start_ms),
        )
        return sorted(nearest[: min(limit, 3)], key=lambda frame: float(frame.get("timestampMs") or 0))

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

    def _slack_messages(self, operation_videos: list[dict[str, Any]]) -> list[dict[str, Any]]:
        by_key: dict[str, dict[str, Any]] = {}
        for video in operation_videos:
            related = video.get("relatedContexts") if isinstance(video.get("relatedContexts"), dict) else {}
            slack = related.get("slack") if isinstance(related.get("slack"), dict) else {}
            team_id = _clean_text(slack.get("teamId"))
            team_name = _clean_text(slack.get("teamName"))
            checked_at = _clean_text(slack.get("checkedAt"))
            for message in _as_list(slack.get("messages")):
                if not isinstance(message, dict):
                    continue
                channel_id = _clean_text(message.get("channelId"))
                message_ts = _clean_text(message.get("messageTs"))
                permalink = _clean_text(message.get("permalink"))
                key = permalink or f"{channel_id}:{message_ts}" or str(len(by_key))
                by_key[key] = {
                    "teamId": team_id,
                    "teamName": team_name,
                    "checkedAt": checked_at,
                    "channelId": channel_id,
                    "channelName": _clean_text(message.get("channelName")),
                    "messageTs": message_ts,
                    "threadTs": _clean_text(message.get("threadTs")),
                    "permalink": permalink,
                    "author": _clean_text(message.get("author")),
                    "text": _clean_text(message.get("text")),
                    "postedAt": _clean_text(message.get("postedAt")),
                    "relevanceScore": message.get("relevanceScore"),
                    "reason": message.get("reason"),
                    "matchedSignals": _as_list(message.get("matchedSignals")),
                }
        return sorted(
            by_key.values(),
            key=lambda item: (-(item.get("relevanceScore") or 0), item.get("postedAt") or ""),
        )

    def _jira_issues(self, operation_videos: list[dict[str, Any]]) -> list[dict[str, Any]]:
        by_key: dict[str, dict[str, Any]] = {}
        for video in operation_videos:
            related = video.get("relatedContexts") if isinstance(video.get("relatedContexts"), dict) else {}
            jira = related.get("jira") if isinstance(related.get("jira"), dict) else {}
            cloud_id = _clean_text(jira.get("cloudId"))
            site_name = _clean_text(jira.get("siteName"))
            site_url = _clean_text(jira.get("siteUrl"))
            checked_at = _clean_text(jira.get("checkedAt"))
            for issue in _as_list(jira.get("issues")):
                if not isinstance(issue, dict):
                    continue
                issue_key = _clean_text(issue.get("key"))
                resolved_cloud_id = _clean_text(issue.get("cloudId")) or cloud_id
                if not issue_key:
                    continue
                key = f"{resolved_cloud_id}:{issue_key}"
                by_key[key] = {
                    **issue,
                    "cloudId": resolved_cloud_id,
                    "siteName": site_name,
                    "siteUrl": _clean_text(issue.get("siteUrl")) or site_url,
                    "checkedAt": checked_at,
                    "labels": _as_list(issue.get("labels")),
                    "components": _as_list(issue.get("components")),
                    "fixVersions": _as_list(issue.get("fixVersions")),
                    "matchedSignals": _as_list(issue.get("matchedSignals")),
                }
        return sorted(
            by_key.values(),
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
