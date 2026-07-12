"""StoryVault video RequestDoc triggers.

Thin Firebase Functions bridge:
Firestore RequestDoc -> corresponding StoryVault Cloud Run worker.
The workers live under backend/microservice/storyvaultVideo and keep the original
media-processing implementation.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any

import requests
from firebase_functions import firestore_fn
from google.cloud import firestore


db = firestore.Client()


def _event_info(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> dict[str, Any]:
    snap = event.data
    if snap is None:
        return {}
    data = snap.to_dict() or {}
    path = snap.reference.path
    return {
        "requestId": snap.id,
        "requestPath": path,
        "collectionPath": "/".join(path.split("/")[:-1]),
        "data": data,
    }


def _patch(collection_path: str, request_id: str, payload: dict[str, Any]) -> None:
    db.collection(collection_path).document(request_id).update(
        {**payload, "updatedAt": firestore.SERVER_TIMESTAMP}
    )


def _append_log(
    collection_path: str,
    request_id: str,
    message: str,
    log_type: str = "info",
) -> None:
    db.collection(collection_path).document(request_id).update(
        {
            "logs": firestore.ArrayUnion(
                [
                    {
                        "timestamp": datetime.now(),
                        "message": message,
                        "type": log_type,
                    }
                ]
            )
        }
    )


def _worker_url(env_names: tuple[str, ...], route: str) -> str:
    for env_name in env_names:
        base = os.getenv(env_name, "").rstrip("/")
        if base:
            return f"{base}{route}"
    raise RuntimeError(f"None of {', '.join(env_names)} is configured")


def _post_to_worker(
    *,
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
    env_names: tuple[str, ...],
    route: str,
    request_timeout: int = 520,
) -> None:
    info = _event_info(event)
    request_id = info.get("requestId")
    collection_path = info.get("collectionPath")
    request_path = info.get("requestPath")
    data = info.get("data") or {}
    if not request_id or not collection_path or not request_path:
        print("storyvault video trigger: missing event data; skipping")
        return

    body = {
        "request_id": request_id,
        "requestId": request_id,
        "requestPath": request_path,
        "organizationId": event.params.get("organizationId"),
        "spaceId": event.params.get("spaceId"),
        "input": data.get("input") or {},
        "systemMetadata": data.get("systemMetadata") or {},
        "operationMetadata": data.get("operationMetadata") or {},
    }
    url = _worker_url(env_names, route)
    _patch(collection_path, request_id, {"status": "processing"})
    _append_log(collection_path, request_id, f"StoryVault worker start: {route}", "info")
    try:
        response = requests.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=request_timeout,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"{url} returned {response.status_code}: {response.text[:500]}")
        response_body = response.json()
        if response_body.get("status") != "success":
            error_payload = response_body.get("error")
            message = (
                error_payload.get("message")
                if isinstance(error_payload, dict)
                else str(error_payload)
            )
            raise RuntimeError(message or f"{url} returned non-success status")
        _patch(
            collection_path,
            request_id,
            {
                "status": "completed",
                "output": response_body.get("output") or {},
            },
        )
        _append_log(collection_path, request_id, f"StoryVault worker completed: {route}", "info")
    except Exception as exc:
        _patch(
            collection_path,
            request_id,
            {
                "status": "error",
                "errorMessage": str(exc),
            },
        )
        raise


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "autoSectionVideoRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=540,
)
def on_auto_section_video_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    _post_to_worker(
        event=event,
        env_names=(
            "STORYVAULT_VIDEO_AI_SECTIONING_URL",
            "VOHANCE_AI_VIDEO_SECTIONING_URL",
        ),
        route="/auto-section",
        request_timeout=520,
    )


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "splitVideoRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=540,
)
def on_split_video_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    _post_to_worker(
        event=event,
        env_names=(
            "STORYVAULT_VIDEO_SPLIT_BY_TIMESTAMPS_URL",
            "VOHANCE_SPLIT_VIDEO_BY_TIMESTAMPS_URL",
        ),
        route="/split",
    )


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "videoTranscriptionRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=540,
)
def on_video_transcription_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    _post_to_worker(
        event=event,
        env_names=(
            "STORYVAULT_VIDEO_TRANSCRIBE_AUDIO_WITH_GCP_STT_URL",
            "VOHANCE_TRANSCRIBE_AUDIO_WITH_GCP_STT_URL",
        ),
        route="/transcribe",
    )


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "textToSpeechRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=540,
)
def on_text_to_speech_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    _post_to_worker(
        event=event,
        env_names=(
            "STORYVAULT_VIDEO_TEXT_TO_SPEECH_WITH_GOOGLE_URL",
            "VOHANCE_TEXT_TO_SPEECH_WITH_GOOGLE_URL",
        ),
        route="/synthesize",
    )


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "mergeVideoAudioNarrationRequests/logs/{requestId}"
    ),
    memory=1024,
    timeout_sec=540,
)
def on_merge_video_audio_narration_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    _post_to_worker(
        event=event,
        env_names=(
            "STORYVAULT_VIDEO_MERGE_VIDEO_AUDIO_NARRATION_URL",
            "VOHANCE_MERGE_VIDEO_AUDIO_NARRATION_URL",
        ),
        route="/merge",
    )


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "concatenateSectionVideosRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=540,
)
def on_concatenate_section_videos_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    _post_to_worker(
        event=event,
        env_names=(
            "STORYVAULT_VIDEO_CONCATENATE_SECTION_VIDEOS_URL",
            "VOHANCE_CONCATENATE_SECTION_VIDEOS_URL",
        ),
        route="/concatenate",
    )


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "addVideoSubtitleRequests/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=540,
)
def on_add_video_subtitle_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    _post_to_worker(
        event=event,
        env_names=(
            "STORYVAULT_VIDEO_ADD_SUBTITLE_URL",
            "VOHANCE_ADD_VIDEO_SUBTITLE_URL",
        ),
        route="/add-subtitles",
    )


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/spaces/{spaceId}/requests/"
        "trimSilenceVideoRequests/logs/{requestId}"
    ),
    memory=1024,
    timeout_sec=540,
)
def on_trim_silence_video_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    _post_to_worker(
        event=event,
        env_names=(
            "STORYVAULT_VIDEO_TRIM_SILENCE_URL",
            "VOHANCE_TRIM_SILENCE_VIDEO_URL",
        ),
        route="/trim-silence",
    )
