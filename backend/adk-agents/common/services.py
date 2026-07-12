"""ADK session + artifact service registry (Cloud Run 本番用)."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

from google.adk.artifacts import GcsArtifactService, InMemoryArtifactService
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from .firestore_session_service import FirestoreSessionService

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AdkServices:
    session_service: Any
    artifact_service: Any
    bucket_name: str


def _resolve_project_id() -> str | None:
    return (
        os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("FIREBASE_PROJECT_ID")
        or os.environ.get("GCP_PROJECT")
    )


def _resolve_sessions_collection() -> str:
    return (
        os.environ.get("FIRESTORE_ADK_SESSIONS_COLLECTION")
        or os.environ.get("FIRESTORE_SESSIONS_COLLECTION")
        or "adkSessions"
    ).strip()


def _resolve_artifact_bucket() -> str:
    return (
        os.environ.get("ADK_ARTIFACT_BUCKET")
        or os.environ.get("GCS_ARTIFACT_BUCKET")
        or os.environ.get("FIREBASE_STORAGE_BUCKET")
        or ""
    ).strip()


def create_session_service():
    """Firestore / InMemory session backend."""
    backend = os.environ.get("ADK_SESSION_BACKEND", "firestore").strip().lower()
    if backend in {"memory", "inmemory", "in_memory"}:
        logger.info("ADK session backend: InMemorySessionService")
        return InMemorySessionService()

    project_id = _resolve_project_id()
    collection = _resolve_sessions_collection()
    logger.info(
        "ADK session backend: FirestoreSessionService project=%s collection=%s",
        project_id,
        collection,
    )
    return FirestoreSessionService(project_id=project_id, collection=collection)


def create_artifact_service(*, bucket_name: str | None = None):
    """GcsArtifactService / InMemory artifact backend."""
    backend = os.environ.get("ADK_ARTIFACT_BACKEND", "gcs").strip().lower()
    if backend in {"memory", "inmemory", "in_memory"}:
        logger.info("ADK artifact backend: InMemoryArtifactService")
        return InMemoryArtifactService()

    bucket = (bucket_name or _resolve_artifact_bucket()).strip()
    if not bucket:
        logger.warning(
            "ADK_ARTIFACT_BUCKET unset; falling back to InMemoryArtifactService"
        )
        return InMemoryArtifactService()

    logger.info("ADK artifact backend: GcsArtifactService bucket=%s", bucket)
    return GcsArtifactService(bucket_name=bucket)


def create_adk_services() -> AdkServices:
    bucket_name = _resolve_artifact_bucket()
    session_service = create_session_service()
    artifact_service = create_artifact_service(bucket_name=bucket_name or None)
    return AdkServices(
        session_service=session_service,
        artifact_service=artifact_service,
        bucket_name=bucket_name,
    )


def create_runner(
    *,
    agent: Any,
    app_name: str,
    services: AdkServices,
) -> Runner:
    return Runner(
        app_name=app_name,
        agent=agent,
        session_service=services.session_service,
        artifact_service=services.artifact_service,
    )


def init_adk_app_state(app: Any) -> AdkServices:
    """FastAPI lifespan: session + artifact services を app.state に載せる."""
    services = create_adk_services()
    app.state.adk_services = services
    app.state.session_service = services.session_service
    app.state.artifact_service = services.artifact_service
    return services


def register_adk_artifact_routes(app: Any, *, app_name: str) -> None:
    from .artifact_routes import register_artifact_routes

    register_artifact_routes(
        app,
        app_name=app_name,
        get_artifact_service=lambda: app.state.artifact_service,
        get_session_service=lambda: app.state.session_service,
    )
