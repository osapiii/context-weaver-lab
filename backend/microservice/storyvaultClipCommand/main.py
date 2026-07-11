"""Shared backend commands used by manual and fully automatic clip workflows."""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from google.cloud import firestore, storage

from transcript_normalization import clip_local_transcript, normalize_transcript

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "storyvault-dev")
ADK_TIMEOUT_SECONDS = int(os.getenv("ADK_TIMEOUT_SECONDS", "1200"))
db = firestore.Client(project=PROJECT_ID)
gcs = storage.Client(project=PROJECT_ID)
app = FastAPI(title="storyvault-clip-command")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))


def _base(body: dict[str, Any]) -> str:
    return f"organizations/{body['organizationId']}/spaces/{body['spaceId']}"


def _input(body: dict[str, Any]) -> dict[str, Any]:
    return body.get("input") or {}


def _payload(body: dict[str, Any]) -> dict[str, Any]:
    return _input(body).get("payload") or {}


def _application(body: dict[str, Any]) -> dict[str, Any]:
    app_id = str(_input(body).get("applicationId") or "")
    snap = db.document(f"{_base(body)}/storyVaultApplications/{app_id}").get()
    if not snap.exists:
        raise RuntimeError(f"StoryVault application not found: {app_id}")
    return {"id": snap.id, **(snap.to_dict() or {})}


def _clip_refs(body: dict[str, Any]) -> list:
    return [db.document(f"{_base(body)}/storyVaultClips/{clip_id}") for clip_id in (_input(body).get("clipIds") or [])]


def _srt(cues: list[dict[str, Any]]) -> str:
    def stamp(ms: int) -> str:
        hours, rest = divmod(ms, 3_600_000)
        minutes, rest = divmod(rest, 60_000)
        seconds, millis = divmod(rest, 1000)
        return f"{hours:02}:{minutes:02}:{seconds:02},{millis:03}"
    return "\n".join(
        f"{cue['index']}\n{stamp(cue['startMs'])} --> {stamp(cue['endMs'])}\n{cue['text']}\n"
        for cue in cues
    )


def _read_transcript(payload: dict[str, Any]) -> str:
    transcription = payload.get("transcription") or {}
    bucket = transcription.get("transcriptionBucketName")
    path = transcription.get("transcriptionFilePath")
    if bucket and path:
        return gcs.bucket(bucket).blob(path).download_as_text()
    return str(transcription.get("text") or payload.get("transcriptText") or "")


def register_clips(body: dict[str, Any]) -> dict[str, Any]:
    data = _payload(body)
    sections = data.get("sections") or []
    application = _application(body)
    group_id = str(_input(body).get("clipGroupId") or "")
    group_ref = db.document(f"{_base(body)}/storyVaultClipGroups/{group_id}")
    group = group_ref.get().to_dict() or {}
    transcript_duration_ms = max(
        [
            round(float(section.get("endTime") or (section.get("videoSegment") or {}).get("endTime") or 0) * 1000)
            for section in sections
        ]
        + [
            round(float((section.get("videoSegment") or {}).get("duration") or 0) * 1000)
            for section in sections
        ]
        + [round(float(data.get("durationMs") or 0))]
    )
    transcript = normalize_transcript(_read_transcript(data), max(1, transcript_duration_ms))
    pipeline_id = str(_input(body).get("pipelineRequestId") or body["requestId"])
    clip_ids: list[str] = []
    clips: list[dict[str, Any]] = []
    for position, section in enumerate(sections):
        video = section.get("videoSegment") or {}
        bucket = str(video.get("bucketName") or "")
        path = str(video.get("gcsFilePath") or "")
        if not bucket or not path:
            continue
        clip_id = f"clip-{pipeline_id}-{position + 1:03d}"
        duration_ms = max(1, round(float(video.get("duration") or 0) * 1000))
        title = str(section.get("title") or f"{data.get('title') or '録画'} {position + 1}")
        section_start_ms = round(float(section.get("startTime") or video.get("startTime") or 0) * 1000)
        section_end_ms = round(float(section.get("endTime") or video.get("endTime") or 0) * 1000)
        clip_transcript = clip_local_transcript(
            transcript,
            section_start_ms,
            section_end_ms or section_start_ms + duration_ms,
            duration_ms,
        )
        clip = {
            "id": clip_id, "applicationId": application["id"],
            "applicationKey": application.get("applicationKey") or "APP",
            "clipGroupId": group_id, "clipGroupNameSnapshot": group.get("name"),
            "title": title, "tags": [],
            "fileName": path.split("/")[-1], "bucketName": bucket, "storagePath": path,
            "contentType": "video/mp4", "sizeBytes": int(video.get("sizeBytes") or 0),
            "durationMs": duration_ms, "transcriptText": clip_transcript["text"],
            "transcriptProvider": "gcp-speech-to-text",
            "transcriptSummary": clip_transcript["text"][:800], "transcriptSegments": clip_transcript["cues"],
            "transcriptSrt": _srt(clip_transcript["cues"]), "transcriptTimingStatus": "timestamped",
            "frameCaptures": [], "sourceDisplaySurface": "unknown",
            "recordedAt": _now_iso(), "discoveryStatus": "not_registered",
            "analysisStatus": "not_analyzed", "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        db.document(f"{_base(body)}/storyVaultClips/{clip_id}").set(clip, merge=True)
        source_id = f"source-asset-{clip_id}"
        db.document(f"{_base(body)}/storyVaultSourceAssets/{source_id}").set({
            "id": source_id, "applicationId": application["id"],
            "applicationKey": application.get("applicationKey") or "APP",
            "sourceType": "operation_video", "title": title,
            "uri": f"gs://{bucket}/{path}", "gcsPath": f"gs://{bucket}/{path}",
            "storagePath": path, "discoveryStatus": "not_registered",
            "metadata": {"clipId": clip_id, "transcriptText": clip_transcript["text"], "transcriptSegments": clip_transcript["cues"]},
            "createdAt": firestore.SERVER_TIMESTAMP, "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        clip_ids.append(clip_id)
        clips.append({"clipId": clip_id, "title": title, "status": "registered", "quickScanStatus": "pending", "zappingStatus": "pending", "storyCandidateCount": 0})
    if not clip_ids:
        raise RuntimeError("No section video assets were available for clip registration")
    group_ref.set({"clipCount": firestore.Increment(len(clip_ids)), "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
    return {"clipIds": clip_ids, "clips": clips}


def _extract_frames(clip: dict[str, Any]) -> list[dict[str, Any]]:
    bucket_name, storage_path = clip["bucketName"], clip["storagePath"]
    duration_ms = int(clip.get("durationMs") or 0)
    timestamps = list(range(0, max(1, duration_ms), 5000)) or [0]
    frames: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory() as temp_dir:
        source = Path(temp_dir) / "source.mp4"
        gcs.bucket(bucket_name).blob(storage_path).download_to_filename(source)
        for index, timestamp_ms in enumerate(timestamps):
            target = Path(temp_dir) / f"frame-{index + 1:03d}.jpg"
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-ss", f"{timestamp_ms / 1000:.3f}", "-i", str(source),
                "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", str(target),
            ], check=True)
            frame_path = f"storyVault/applications/{clip['applicationId']}/clips/{clip['id']}/frames/{target.name}"
            gcs.bucket(bucket_name).blob(frame_path).upload_from_filename(target, content_type="image/jpeg")
            frames.append({
                "id": f"frame-{index + 1:03d}", "timestampMs": timestamp_ms,
                "fileName": target.name, "bucketName": bucket_name,
                "storagePath": frame_path, "contentType": "image/jpeg",
            })
    return frames


def quick_scan(body: dict[str, Any]) -> dict[str, Any]:
    succeeded, failed = [], []
    for ref in _clip_refs(body):
        try:
            clip = {"id": ref.id, **(ref.get().to_dict() or {})}
            frames = _extract_frames(clip)
            transcript = str(clip.get("transcriptText") or "")
            scan = {
                "title": clip.get("title"), "description": transcript[:300],
                "operationMemo": transcript[:600],
                "operationSteps": [line.strip() for line in transcript.splitlines() if line.strip()][:8],
                "transcriptSummary": transcript[:800], "provider": "storyvault-clip-command",
                "generatedAt": _now_iso(),
            }
            ref.set({"frameCaptures": frames, "quickScan": scan, "transcriptSummary": scan["transcriptSummary"], "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
            db.document(f"{_base(body)}/storyVaultSourceAssets/source-asset-{ref.id}").set({
                "metadata": {
                    "clipId": ref.id, "transcriptText": transcript,
                    "transcriptSegments": clip.get("transcriptSegments") or [],
                    "transcriptSrt": clip.get("transcriptSrt"),
                    "transcriptTimingStatus": clip.get("transcriptTimingStatus"),
                    "quickScan": scan, "frameCaptures": frames,
                },
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }, merge=True)
            succeeded.append(ref.id)
        except Exception as exc:
            failed.append({"clipId": ref.id, "errorMessage": str(exc)})
    return {"clipIds": succeeded, "failedClips": failed, "failedClipIds": [item["clipId"] for item in failed]}


def _wait_request(ref) -> dict[str, Any]:
    deadline = time.time() + ADK_TIMEOUT_SECONDS
    while time.time() < deadline:
        data = ref.get().to_dict() or {}
        if data.get("status") == "completed":
            return data
        if data.get("status") == "error":
            raise RuntimeError(str(data.get("errorMessage") or "ADK request failed"))
        time.sleep(3)
    raise RuntimeError("ADK request timed out")


def _adk(body: dict[str, Any], mode: str, mode_state: dict[str, Any], prompt: str, suffix: str) -> dict[str, Any]:
    metadata = body.get("operationMetadata") or {}
    application = _application(body)
    session_id = f"storyvault-{mode}-{body['requestId']}-{suffix}"
    request_id = f"adk_{body['requestId']}_{suffix}"
    ref = db.document(f"{_base(body)}/requests/adkInvokeRequests/logs/{request_id}")
    if not ref.get().exists:
        ref.set({
            "input": {
                "mode": mode, "sessionId": session_id,
                "organizationId": body["organizationId"], "spaceId": body["spaceId"],
                "userId": (metadata.get("requestedBy") or {}).get("userId") or "system",
                "prompt": prompt, "responseId": f"response-{request_id}",
                "workspaceId": application["id"], "fileSpaceId": application.get("fileSpaceId"),
                "history": [], "modeState": _json_safe(mode_state), "attachments": [],
                "selectedKnowledge": [], "referenceImages": [],
            },
            "operationMetadata": {**metadata, "loggingDocumentId": request_id},
            "output": None, "status": "pending", "logs": [],
            "createdAt": firestore.SERVER_TIMESTAMP, "updatedAt": firestore.SERVER_TIMESTAMP,
        })
    result = _wait_request(ref)
    return {"requestId": request_id, "sessionId": session_id, "output": result.get("output") or {}}


def zapping_analysis(body: dict[str, Any]) -> dict[str, Any]:
    application = _application(body)
    succeeded, failed, candidate_count = [], [], 0
    for ref in _clip_refs(body):
        clip = {"id": ref.id, **(ref.get().to_dict() or {})}
        try:
            mode_state = {
                "active_mode": "storyvault_zapping_analysis",
                "storyvault_zapping_analysis": {
                    "phase": "zapping_analysis",
                    "setup": {"confirmed": True, "analysis_session_id": f"analysis-{body['requestId']}-{ref.id}", "application_id": application["id"], "application_key": application.get("applicationKey"), "application_name": application.get("name"), "file_space_id": application.get("fileSpaceId"), "clip_id": ref.id, "clip_group_id": clip.get("clipGroupId")},
                    "payload": {"clip": clip, "source_assets": [], "existing_capabilities": [], "existing_stories": [], "existing_evidence": [], "expected_outputs": ["story_candidates", "story_evidence_video_segments", "story_evidence_screenshots", "operation_intent"]},
                },
            }
            result = _adk(body, "storyvault_zapping_analysis", mode_state, f"{application.get('name')} の操作クリップ「{clip.get('title')}」を解析し、User Story候補と根拠を抽出してください。", ref.id)
            output = result["output"]
            analysis = (output.get("storyvault_zapping_analysis") or {}).get("analysis_result") or output.get("storyvault_zapping_analysis") or {}
            count = len(analysis.get("storyCandidates") or analysis.get("story_candidates") or []) if isinstance(analysis, dict) else 0
            candidate_count += count
            ref.set({"analysisStatus": "completed", "analysisRequestId": result["requestId"], "analysisSessionId": result["sessionId"], "analysisResult": analysis, "analyzedAt": _now_iso(), "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
            succeeded.append(ref.id)
        except Exception as exc:
            ref.set({"analysisStatus": "error", "analysisErrorMessage": str(exc), "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
            failed.append({"clipId": ref.id, "errorMessage": str(exc)})
    return {"clipIds": succeeded, "failedClips": failed, "failedClipIds": [item["clipId"] for item in failed], "storyCandidateCount": candidate_count}


def _application_context(body: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    application = _application(body)
    base = _base(body)
    def rows(name: str) -> list[dict[str, Any]]:
        return [{"id": snap.id, **(snap.to_dict() or {})} for snap in db.collection(f"{base}/{name}").where("applicationId", "==", application["id"]).stream()]
    return application, rows("storyVaultCapabilities"), rows("storyVaultStories"), rows("storyVaultStoryEvidence"), rows("storyVaultSourceAssets")


def _upsert_artifact(body: dict[str, Any], operation: str) -> dict[str, Any]:
    application, capabilities, stories, evidence, source_assets = _application_context(body)
    mode = "storyvault_capability_structuring" if operation == "capabilityStructuring" else "storyvault_story_generation"
    state = {
        "active_mode": mode,
        mode: {
            "phase": "drafting",
            "setup": {"confirmed": True, "generation_session_id": f"generation-{body['requestId']}", "application_id": application["id"], "application_key": application.get("applicationKey"), "application_name": application.get("name"), "file_space_id": application.get("fileSpaceId")},
            "payload": {"source_assets": source_assets, "existing_capabilities": capabilities, "existing_stories": stories, "existing_evidence": evidence},
        },
    }
    requested_prompt = str(_payload(body).get("prompt") or "").strip()
    prompt = requested_prompt or (
        f"{application.get('name')} のCapability構造案を作成してください。既存Capabilityは削除せず維持・追加・更新してください。"
        if operation == "capabilityStructuring"
        else f"{application.get('name')} の正式User StoryとEvidenceを生成してください。"
    )
    result = _adk(body, mode, state, prompt, operation)
    artifacts = result["output"].get("storyvaultArtifacts") or []
    expected_schema = "storyvault-capability-structure-v1" if operation == "capabilityStructuring" else "storyvault-story-generation-v1"
    package = next((item for item in artifacts if item.get("schemaVersion") == expected_schema), None)
    if not package and operation == "capabilityStructuring":
        preview = str(result["output"].get("responseTextPreview") or "")
        names = [match.strip() for match in re.findall(r"\*\*\d+\.\s*([^*]+)\*\*", preview)]
        if not names:
            names = ["操作クリップから抽出した業務Capability"]
        package = {
            "schemaVersion": expected_schema,
            "capabilities": [{
                "capabilityKey": f"{application.get('applicationKey') or 'APP'}-CAP-{index + 1:03d}",
                "name": name, "summary": name, "labels": ["clip-analysis"],
                "order": index, "status": "draft", "reviewState": "needs_review",
                "evidenceIds": [], "storyCount": 0, "highDriftCount": 0,
                "confidenceScore": 70, "driftLevel": "medium", "locked": False,
                "generatedAt": _now_iso(),
            } for index, name in enumerate(names)],
        }
    if not package and operation == "storyGeneration":
        clips = [{"id": ref.id, **(ref.get().to_dict() or {})} for ref in _clip_refs(body)]
        if not clips:
            clip_ids = _payload(body).get("clipIds") or []
            clips = [{"id": clip_id, **(db.document(f"{_base(body)}/storyVaultClips/{clip_id}").get().to_dict() or {})} for clip_id in clip_ids]
        generated_stories, generated_evidence = [], []
        capability_id = capabilities[0]["id"] if capabilities else None
        capability_key = capabilities[0].get("capabilityKey") if capabilities else None
        capability_name = capabilities[0].get("name") if capabilities else None
        for index, clip in enumerate(clips or [{"id": "unknown", "title": application.get("name")}]):
            analysis = clip.get("analysisResult") or {}
            candidates = analysis.get("storyCandidates") or analysis.get("story_candidates") or []
            candidate = candidates[0] if candidates else {}
            story_id = f"story-{body['requestId']}-{index + 1:03d}"
            evidence_id = f"evidence-{body['requestId']}-{index + 1:03d}"
            title = str(candidate.get("title") or clip.get("title") or "操作クリップから生成したStory")
            summary = str(candidate.get("summary") or clip.get("transcriptSummary") or title)
            user_story = str(candidate.get("userStory") or candidate.get("user_story") or f"利用者として、{title}を実行したい。")
            generated_stories.append({
                "id": story_id, "capabilityId": capability_id, "capabilityKey": capability_key,
                "capabilityName": capability_name, "sequence": index,
                "storyKey": f"{application.get('applicationKey') or 'APP'}-AUTO-{index + 1:03d}",
                "title": title, "summary": summary, "userStory": user_story,
                "status": "draft", "reviewState": "needs_review",
                "domain": str(application.get("domain") or "operation"), "milestone": "discovery",
                "labels": ["clip-analysis"], "confidenceScore": 65,
                "driftLevel": "medium", "sourceFreshness": {"staleSources": []},
                "acceptanceCriteria": [], "detailedSpecifications": candidate.get("detailedSpecifications") or [],
                "evidenceIds": [evidence_id], "codeRefs": [], "generationTrace": ["backend fallback normalization"],
                "generatedAt": _now_iso(),
            })
            generated_evidence.append({
                "id": evidence_id, "capabilityId": capability_id, "capabilityKey": capability_key,
                "storyId": story_id, "storyKey": f"{application.get('applicationKey') or 'APP'}-AUTO-{index + 1:03d}",
                "sourceAssetId": f"source-asset-{clip.get('id')}", "type": "video",
                "title": f"操作クリップ: {clip.get('title') or clip.get('id')}",
                "excerpt": summary[:1000],
                "sourceUrl": f"gs://{clip.get('bucketName')}/{clip.get('storagePath')}",
                "gcsPath": f"gs://{clip.get('bucketName')}/{clip.get('storagePath')}",
                "observedUserAction": title, "citation": {"title": title, "snippet": summary[:500]},
                "freshness": "fresh", "confidenceImpact": 20,
            })
        package = {"schemaVersion": expected_schema, "stories": generated_stories, "evidence": generated_evidence}
    if not package:
        raise RuntimeError(f"ADK completed without usable {expected_schema} output")
    ids: dict[str, list[str]] = {"capabilityIds": [], "storyIds": [], "evidenceIds": []}
    if operation == "capabilityStructuring":
        for index, item in enumerate(package.get("capabilities") or []):
            item_id = str(item.get("id") or f"capability-{application['id']}-{index + 1:03d}")
            db.document(f"{_base(body)}/storyVaultCapabilities/{item_id}").set({**item, "id": item_id, "applicationId": application["id"], "applicationKey": application.get("applicationKey") or "APP", "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
            ids["capabilityIds"].append(item_id)
    else:
        for kind, collection_name, key in (("stories", "storyVaultStories", "storyIds"), ("evidence", "storyVaultStoryEvidence", "evidenceIds")):
            for index, item in enumerate(package.get(kind) or []):
                item_id = str(item.get("id") or f"{kind[:-1]}-{application['id']}-{index + 1:03d}")
                db.document(f"{_base(body)}/{collection_name}/{item_id}").set({**item, "id": item_id, "applicationId": application["id"], "applicationKey": application.get("applicationKey") or "APP", "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
                ids[key].append(item_id)
    return {**ids, "adkRequestId": result["requestId"]}


def verify_ui_assets(body: dict[str, Any]) -> dict[str, Any]:
    data = _payload(body)
    required = {"storyVaultClips": data.get("clipIds") or [], "storyVaultCapabilities": data.get("capabilityIds") or [], "storyVaultStories": data.get("storyIds") or [], "storyVaultStoryEvidence": data.get("evidenceIds") or []}
    missing = [f"{collection}/{item_id}" for collection, ids in required.items() for item_id in ids if not db.document(f"{_base(body)}/{collection}/{item_id}").get().exists]
    if any(not required[name] for name in required):
        missing.append("required Clip/Capability/Story/Evidence ids are empty")
    if missing:
        raise RuntimeError("UI asset verification failed: " + ", ".join(missing[:30]))
    return {"verified": True, "collections": {key: len(value) for key, value in required.items()}, "verifiedAt": _now_iso()}


HANDLERS = {
    "registerClips": register_clips, "quickScan": quick_scan,
    "zappingAnalysis": zapping_analysis,
    "capabilityStructuring": lambda body: _upsert_artifact(body, "capabilityStructuring"),
    "storyGeneration": lambda body: _upsert_artifact(body, "storyGeneration"),
    "verifyUiAssets": verify_ui_assets,
}


@app.post("/commands/{operation}")
async def command(operation: str, request: Request):
    handler = HANDLERS.get(operation)
    if not handler:
        raise HTTPException(404, f"unsupported operation: {operation}")
    body = await request.json()
    request_path = str(body.get("requestPath") or "")
    request_ref = db.document(request_path) if request_path else None
    try:
        output = handler(body)
        status = "partial_error" if output.get("failedClipIds") else "completed"
        if request_ref:
            request_ref.set({
                "status": status, "output": output,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }, merge=True)
        return {"status": status, "output": output}
    except Exception as exc:
        if request_ref:
            request_ref.set({
                "status": "error", "errorMessage": str(exc),
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }, merge=True)
        raise HTTPException(500, str(exc)) from exc


@app.get("/health")
def health():
    return {"status": "ok", "operations": list(HANDLERS)}
