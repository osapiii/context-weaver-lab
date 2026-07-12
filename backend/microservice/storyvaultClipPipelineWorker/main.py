"""Durable step runner for the StoryVault clip pipeline.

Each coarse step is idempotent: completed steps are returned from the parent
RequestDoc, and external processors receive the deterministic child request id.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any

import requests
from fastapi import FastAPI, HTTPException, Request
from google.cloud import firestore

from completion_email import build_completion_email, completion_email_request_id

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "storyvault-dev")
STEP_IDS = (
    "upload", "trimSilence", "transcribe", "section", "split",
    "registerClips", "quickScan", "zappingAnalysis", "capabilityStructuring",
    "storyGeneration", "verifyUiAssets", "notification",
)
STEP_PROGRESS = {step: round(index / len(STEP_IDS) * 100) for index, step in enumerate(STEP_IDS)}
SERVICE_ENV = {
    "trimSilence": "STORYVAULT_VIDEO_TRIM_SILENCE_URL",
    "transcribe": "STORYVAULT_VIDEO_TRANSCRIBE_AUDIO_WITH_GCP_STT_URL",
    "section": "STORYVAULT_VIDEO_AI_SECTIONING_URL",
    "split": "STORYVAULT_VIDEO_SPLIT_BY_TIMESTAMPS_URL",
    "registerClips": "STORYVAULT_PIPELINE_REGISTER_CLIPS_URL",
    "quickScan": "STORYVAULT_PIPELINE_QUICK_SCAN_URL",
    "zappingAnalysis": "STORYVAULT_PIPELINE_ZAPPING_URL",
    "capabilityStructuring": "STORYVAULT_PIPELINE_CAPABILITY_URL",
    "storyGeneration": "STORYVAULT_PIPELINE_STORY_URL",
}
ROUTES = {
    "trimSilence": "/trim-silence", "transcribe": "/transcribe",
    "section": "/auto-section", "split": "/split",
    "registerClips": "/register-clips", "quickScan": "/quick-scan",
    "zappingAnalysis": "/zapping-analysis",
    "capabilityStructuring": "/capability-structuring",
    "storyGeneration": "/story-generation",
}

app = FastAPI(title="storyvault-clip-pipeline-worker")
db = firestore.Client(project=PROJECT_ID)


def _event(ref, *, level: str, message: str, step: str, retry: int, clip_id: str = "", child_id: str = "") -> None:
    entry = {
        "level": level, "message": message, "step": step, "clipId": clip_id or None,
        "requestDocId": child_id or None, "retryCount": retry,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    ref.collection("events").document().set(entry)
    snapshot = ref.get().to_dict() or {}
    latest = list(snapshot.get("latestLogs") or [])[-49:]
    latest.append({**entry, "createdAt": datetime.now(timezone.utc)})
    ref.update({"latestLogs": latest, "updatedAt": firestore.SERVER_TIMESTAMP})


def _patch_step(ref, step: str, status: str, **extra: Any) -> None:
    update = {
        "currentStep": step, "progress": STEP_PROGRESS.get(step, 0),
        f"steps.{step}.status": status,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    update.update({f"steps.{step}.{key}": value for key, value in extra.items()})
    ref.update(update)


def _source_draft_ref(parent: dict[str, Any]):
    """Return the originating manual-draft document when this is a recording pipeline."""
    draft_id = str((parent.get("input") or {}).get("sourceDraftId") or "").strip()
    metadata = parent.get("operationMetadata") or {}
    organization_id = str(metadata.get("organizationId") or "").strip()
    space_id = str(metadata.get("spaceId") or "").strip()
    if not draft_id or not organization_id or not space_id:
        return None
    return db.document(
        f"organizations/{organization_id}/spaces/{space_id}/storyVaultClipDrafts/{draft_id}"
    )


def _finalize_source_draft(ref, parent: dict[str, Any]) -> None:
    """Remove a submitted draft only after its assets are verified in StoryVault."""
    draft_ref = _source_draft_ref(parent)
    if not draft_ref:
        return
    try:
        draft_ref.delete()
        ref.update({
            "draftCleanup": {
                "status": "completed",
                "sourceDraftId": draft_ref.id,
                "message": "下書きを正式クリップへ確定しました",
                "completedAt": firestore.SERVER_TIMESTAMP,
            },
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        _event(ref, level="info", message="source draft finalized into clips", step="verifyUiAssets", retry=0)
    except Exception as exc:  # Asset results must remain usable even if cleanup has a transient failure.
        ref.update({
            "draftCleanup": {
                "status": "error",
                "sourceDraftId": draft_ref.id,
                "message": str(exc)[:1000],
            },
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        _event(ref, level="warning", message=f"source draft cleanup failed: {exc}", step="verifyUiAssets", retry=0)


def _restore_source_draft_for_error(parent: dict[str, Any], pipeline_id: str, error_message: str) -> None:
    """Keep the draft editable only when the background workflow itself failed."""
    draft_ref = _source_draft_ref(parent)
    if not draft_ref:
        return
    draft_ref.set({
        "status": "error",
        "statusMessage": f"バックグラウンド解析に失敗しました ({pipeline_id}): {error_message[:300]}",
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }, merge=True)


def _call_step(step: str, payload: dict[str, Any]) -> dict[str, Any]:
    env_name = SERVICE_ENV.get(step)
    if not env_name:
        return {}
    base = os.getenv(env_name, "").rstrip("/")
    if not base:
        raise RuntimeError(f"{env_name} is not configured")
    response = requests.post(f"{base}{ROUTES[step]}", json=payload, timeout=1790)
    if response.status_code >= 400:
        raise RuntimeError(f"{step} HTTP {response.status_code}: {response.text[:500]}")
    body = response.json()
    if body.get("status") not in (None, "success", "completed"):
        raise RuntimeError(str(body.get("error") or f"{step} returned non-success"))
    return body.get("output") or body


def _gcs_parts(uri: str) -> tuple[str, str]:
    value = str(uri or "")
    if not value.startswith("gs://") or "/" not in value[5:]:
        raise RuntimeError(f"invalid GCS URI: {value}")
    bucket, path = value[5:].split("/", 1)
    return bucket, path


def _processor_payload(step: str, parent: dict[str, Any], state: dict[str, Any], child_id: str, ref) -> dict[str, Any]:
    metadata = parent.get("operationMetadata") or {}
    child_collection = f"{ref.path}/processorRequests"
    child_ref = db.document(f"{child_collection}/{child_id}")
    child_ref.set({
        "id": child_id, "step": step, "status": "processing", "output": {},
        "createdAt": firestore.SERVER_TIMESTAMP, "updatedAt": firestore.SERVER_TIMESTAMP,
    }, merge=True)
    system_metadata = {
        **metadata,
        "loggingCollectionId": child_collection,
        "loggingDocumentId": child_id,
    }
    source_uri = str((parent.get("input") or {}).get("sourceGcsUri") or "")
    source_bucket, source_path = _gcs_parts(source_uri)
    prefix = f"storyVault/clip-pipelines/{ref.id}"
    trim = state.get("trimSilence") or {}
    trimmed_asset = trim.get("trimmedVideo") or trim
    trimmed_bucket = trimmed_asset.get("resultBucketName") or source_bucket
    trimmed_path = trimmed_asset.get("resultFilePath") or f"{prefix}/trimmed.mp4"
    common = {
        "request_id": child_id, "requestId": child_id, "requestPath": child_ref.path,
        "organizationId": metadata.get("organizationId"), "spaceId": metadata.get("spaceId"),
        "systemMetadata": system_metadata, "operationMetadata": system_metadata,
    }
    if step == "trimSilence":
        common["input"] = {
            "videoBucketName": source_bucket, "videoFilePath": source_path,
            "outputBucketName": source_bucket, "outputFilePath": trimmed_path,
            "manifestOutputFilePath": f"{prefix}/silence-manifest.json",
            "splitPointsSeconds": [], "segmentOutputFilePaths": [f"{prefix}/trimmed-segment-001.mp4"],
            "settings": {
                "enabled": True, "noiseReductionEnabled": True,
                "thresholdDb": -38, "minSilenceMs": 5000, "keepPaddingMs": 180,
                "minSegmentMs": 450, "mergeGapMs": 10000,
            },
        }
    elif step == "transcribe":
        common["input"] = {
            "mode": "videoFile", "sourceFileBucketName": trimmed_bucket,
            "sourceFilePath": trimmed_path, "outputBucketName": source_bucket,
            "outputFilePath": f"{prefix}/transcript.txt", "enableParagraphFormatting": True,
            "videoId": ref.id, "projectId": parent.get("applicationId"),
        }
    elif step == "section":
        common["input"] = {
            "sourceBucketName": trimmed_bucket, "sourceFilePath": trimmed_path,
            "outputBucketName": source_bucket, "videoId": ref.id,
            "projectId": parent.get("applicationId"),
            "sectioningPrompt": "操作単位で自動分割し、確認なしで採用できるタイトルを付ける",
        }
    else:
        common.update({
            "pipelineRequestId": ref.id, "input": parent.get("input") or {},
            "pipelineState": state, "applicationId": parent.get("applicationId"),
            "clipGroupId": parent.get("clipGroupId"),
        })
    return common


def _verify_ui_assets(parent: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    required = {
        "storyVaultClips": state.get("clipIds") or [],
        "storyVaultCapabilities": state.get("capabilityIds") or [],
        "storyVaultStories": state.get("storyIds") or [],
        "storyVaultStoryEvidence": state.get("evidenceIds") or [],
    }
    base = f"organizations/{parent['organizationId']}/spaces/{parent['spaceId']}"
    missing: list[str] = []
    for collection_name, ids in required.items():
        for document_id in ids:
            if not db.document(f"{base}/{collection_name}/{document_id}").get().exists:
                missing.append(f"{collection_name}/{document_id}")
    if not required["storyVaultClips"] or not required["storyVaultStories"]:
        missing.append("required clip/story ids were not produced")
    if missing:
        raise RuntimeError("UI asset verification failed: " + ", ".join(missing[:20]))
    return {"verifiedCollections": list(required), "verifiedAt": datetime.now(timezone.utc).isoformat()}


def _enqueue_notification(ref, parent: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    recipient = str((parent.get("input") or {}).get("notificationEmail") or "").strip()
    if not recipient:
        return {"status": "skipped", "reason": "notificationEmail is empty"}
    metadata = parent.get("operationMetadata") or {}
    org_id = metadata.get("organizationId")
    space_id = metadata.get("spaceId")
    if not org_id or not space_id:
        raise RuntimeError("organizationId and spaceId are required for notification")
    failed = state.get("failedClipIds") or []
    partial = bool(failed)
    request_id = completion_email_request_id(ref.id)
    email_ref = db.document(
        f"organizations/{org_id}/spaces/{space_id}/requests/"
        f"transactionalEmailRequests/logs/{request_id}"
    )
    if not email_ref.get().exists:
        report_state = dict(state)
        if not report_state.get("storyTitles"):
            story_titles: list[str] = []
            base = f"organizations/{org_id}/spaces/{space_id}/storyVaultStories"
            for story_id in list(state.get("storyIds") or [])[:3]:
                story = db.document(f"{base}/{story_id}").get().to_dict() or {}
                story_title = str(story.get("title") or story.get("name") or "").strip()
                if story_title:
                    story_titles.append(story_title)
            report_state["storyTitles"] = story_titles
        report = build_completion_email(
            pipeline_id=ref.id,
            parent=parent,
            state=report_state,
            app_url=os.getenv("STORYVAULT_APP_URL", "https://storyvault-dev.web.app"),
        )
        email_ref.set({
            "input": {
                "to": [recipient],
                "subject": report["subject"],
                "html": report["html"],
                "text": report["text"],
                "template": "generic",
                "context": {},
            },
            "operationMetadata": metadata,
            "output": None, "status": "pending", "logs": [],
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
    ref.update({
        "notification": {
            "status": "processing", "requestId": request_id,
            "emailRequestId": request_id,
            "message": "解析結果レポートをメール送信しています",
        },
        "steps.notification.emailRequestId": request_id,
        "steps.notification.message": "解析結果レポートをメール送信しています",
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    deadline = time.time() + 120
    while time.time() < deadline:
        email_data = email_ref.get().to_dict() or {}
        email_status = email_data.get("status")
        if email_status == "completed":
            ref.update({
                "notification.status": "completed",
                "notification.message": "完了メールを送信しました",
                "updatedAt": firestore.SERVER_TIMESTAMP,
            })
            return {"status": "completed", "requestId": request_id, "partial": partial}
        if email_status == "error":
            error_message = str(email_data.get("errorMessage") or "email notification failed")
            ref.update({
                "notification.status": "error",
                "notification.errorMessage": error_message,
                "notification.message": "完了メールの送信に失敗しました",
                "updatedAt": firestore.SERVER_TIMESTAMP,
            })
            return {
                "status": "error", "requestId": request_id, "partial": partial,
                "errorMessage": error_message, "failedNotification": True,
            }
        time.sleep(3)
    return {
        "status": "error", "requestId": request_id, "partial": partial,
        "errorMessage": "email notification timed out", "failedNotification": True,
    }


def _run_clip_command(ref, parent: dict[str, Any], state: dict[str, Any], step: str, child_id: str) -> dict[str, Any]:
    metadata = parent.get("operationMetadata") or {}
    org_id, space_id = metadata.get("organizationId"), metadata.get("spaceId")
    if not org_id or not space_id:
        raise RuntimeError("organizationId and spaceId are required")
    command_ref = db.document(
        f"organizations/{org_id}/spaces/{space_id}/requests/"
        f"storyVaultClipCommandRequests/logs/{child_id}"
    )
    payload = {
        "title": parent.get("title"),
        "sections": (state.get("split") or {}).get("sections") or [],
        "transcription": state.get("transcribe") or {},
        "clipIds": state.get("clipIds") or [],
        "capabilityIds": state.get("capabilityIds") or [],
        "storyIds": state.get("storyIds") or [],
        "evidenceIds": state.get("evidenceIds") or [],
    }
    if not command_ref.get().exists:
        command_ref.set({
            "id": child_id,
            "input": {
                "operation": step, "pipelineRequestId": ref.id,
                "applicationId": parent.get("applicationId"),
                "clipGroupId": parent.get("clipGroupId"),
                "clipIds": state.get("clipIds") or [], "payload": payload,
            },
            "operationMetadata": {**metadata, "loggingDocumentId": child_id},
            "output": None, "status": "pending", "logs": [],
            "createdAt": firestore.SERVER_TIMESTAMP, "updatedAt": firestore.SERVER_TIMESTAMP,
        })
    deadline = time.time() + 1800
    while time.time() < deadline:
        request = command_ref.get().to_dict() or {}
        if request.get("status") in ("completed", "partial_error"):
            return request.get("output") or {}
        if request.get("status") == "error":
            raise RuntimeError(str(request.get("errorMessage") or f"{step} command failed"))
        time.sleep(3)
    raise RuntimeError(f"{step} command timed out")


def _patch_clip_rollup(ref, step: str, output: dict[str, Any]) -> None:
    current = ref.get().to_dict() or {}
    clips = list(current.get("clips") or [])
    if step == "registerClips":
        clips = list(output.get("clips") or [])
    succeeded = set(output.get("clipIds") or [])
    failed = {item.get("clipId"): item for item in (output.get("failedClips") or []) if item.get("clipId")}
    if step in ("quickScan", "zappingAnalysis"):
        for clip in clips:
            clip_id = clip.get("clipId")
            status_key = "quickScanStatus" if step == "quickScan" else "zappingStatus"
            if clip_id in succeeded:
                clip[status_key] = "completed"
                clip["status"] = "processing"
                clip.pop("failedStep", None)
                clip.pop("errorMessage", None)
                if step == "zappingAnalysis":
                    clip["status"] = "completed"
                    clip["storyCandidateCount"] = int(output.get("storyCandidateCount") or 0)
            elif clip_id in failed:
                clip[status_key] = "error"
                clip["status"] = "error"
                clip["failedStep"] = step
                clip["errorMessage"] = failed[clip_id].get("errorMessage")
    failed_count = sum(1 for clip in clips if clip.get("status") == "error")
    completed_count = sum(
        1 for clip in clips
        if clip.get("quickScanStatus") == "completed" and clip.get("zappingStatus") == "completed"
    )
    processing_count = max(0, len(clips) - completed_count - failed_count)
    ref.update({
        "clips": clips,
        "counters": {
            "total": len(clips), "completed": completed_count,
            "processing": processing_count, "failed": failed_count,
        },
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })


@app.post("/run-step")
async def run_step(request: Request):
    body = await request.json()
    step = str(body.get("stepId") or "")
    if step not in STEP_IDS:
        raise HTTPException(400, f"unknown step: {step}")
    ref = db.document(str(body.get("requestPath") or ""))
    parent = ref.get().to_dict() or {}
    previous = (parent.get("steps") or {}).get(step) or {}
    state = dict(body.get("state") or {})
    attempt = int(body.get("attempt") or 1)
    if previous.get("status") == "completed" and previous.get("output") is not None:
        previous_output = previous["output"]
        state[step] = previous_output
        for key in ("clipIds", "capabilityIds", "storyIds", "evidenceIds", "failedClipIds", "failedNotification", "clips"):
            if key in previous_output:
                if key == "failedClipIds":
                    state[key] = sorted(set(state.get(key) or []) | set(previous_output.get(key) or []))
                elif key.endswith("Ids") and not previous_output.get(key) and state.get(key):
                    continue
                else:
                    state[key] = previous_output[key]
        return {"skipped": True, "state": state}
    child_id = f"{body.get('requestId')}_{step}_a{attempt}"
    _patch_step(ref, step, "processing", startedAt=firestore.SERVER_TIMESTAMP, requestDocId=child_id, retryCount=max(0, attempt - 1))
    _event(ref, level="info", message=f"{step} started", step=step, retry=max(0, attempt - 1), child_id=child_id)
    try:
        if step == "upload":
            output = {"sourceGcsUri": (parent.get("input") or {}).get("sourceGcsUri")}
            if not output["sourceGcsUri"]:
                raise RuntimeError("sourceGcsUri is required")
        elif step == "notification":
            output = _enqueue_notification(ref, parent, state)
        elif step == "split":
            # aiVideoSectioning already renders and uploads every accepted section.
            output = {"sections": (state.get("section") or {}).get("sections") or []}
        elif step in {
            "registerClips", "quickScan", "zappingAnalysis",
            "capabilityStructuring", "storyGeneration", "verifyUiAssets",
        }:
            output = _run_clip_command(ref, parent, state, step, child_id)
        else:
            output = _call_step(step, _processor_payload(step, parent, state, child_id, ref))
        state[step] = output
        for key in ("clipIds", "capabilityIds", "storyIds", "evidenceIds", "failedClipIds", "failedNotification", "clips"):
            if key in output:
                if key == "failedClipIds":
                    state[key] = sorted(set(state.get(key) or []) | set(output.get(key) or []))
                elif key.endswith("Ids") and not output.get(key) and state.get(key):
                    continue
                else:
                    state[key] = output[key]
        if step in ("registerClips", "quickScan", "zappingAnalysis"):
            _patch_clip_rollup(ref, step, output)
        if step == "notification":
            step_status = output.get("status") if output.get("status") in {"error", "skipped"} else "completed"
            step_message = {
                "completed": "完了メールを送信しました",
                "error": "完了メールの送信に失敗しました",
                "skipped": "通知先が未設定のためメール送信を省略しました",
            }[step_status]
            step_extra = {
                "emailRequestId": output.get("requestId"),
                "message": step_message,
            }
        else:
            step_status = "completed"
            step_extra = {}
        _patch_step(ref, step, step_status, progress=100, completedAt=firestore.SERVER_TIMESTAMP, requestDocId=child_id, retryCount=max(0, attempt - 1), output=output, **step_extra)
        _event(ref, level="info", message=f"{step} completed", step=step, retry=max(0, attempt - 1), child_id=child_id)
        return {"state": state}
    except Exception as exc:
        _restore_source_draft_for_error(parent, ref.id, str(exc))
        _patch_step(ref, step, "error", completedAt=firestore.SERVER_TIMESTAMP, requestDocId=child_id, retryCount=max(0, attempt - 1), errorMessage=str(exc))
        ref.update({
            "status": "error", "failedStep": step, "errorMessage": str(exc),
            "workflow.state": "FAILED", "workflow.endedAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        _event(ref, level="error", message=str(exc), step=step, retry=max(0, attempt - 1), child_id=child_id)
        raise HTTPException(500, str(exc)) from exc


@app.post("/finalize")
async def finalize(request: Request):
    body = await request.json()
    ref = db.document(str(body.get("requestPath") or ""))
    state = body.get("state") or {}
    failed = state.get("failedClipIds") or []
    # Notification failure is represented by steps.notification/error and must
    # not downgrade otherwise successful analysis assets to partial_error.
    status = "partial_error" if failed else "completed"
    _finalize_source_draft(ref, ref.get().to_dict() or {})
    ref.update({
        "status": status, "progress": 100, "currentStep": "notification",
        "output": state, "workflow.state": "SUCCEEDED",
        "errorMessage": firestore.DELETE_FIELD,
        "failedStep": firestore.DELETE_FIELD,
        "workflow.endedAt": firestore.SERVER_TIMESTAMP,
        "completedAt": firestore.SERVER_TIMESTAMP, "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    return {"status": status, "failedClipIds": failed}


@app.get("/health")
def health():
    return {"status": "ok"}
