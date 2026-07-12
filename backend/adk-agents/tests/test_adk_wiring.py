"""Smoke: ADK services wiring."""
from __future__ import annotations

from fastapi import FastAPI

from common.services import create_runner, init_adk_app_state


def test_init_adk_app_state_memory_backends(monkeypatch):
    monkeypatch.setenv("ADK_SESSION_BACKEND", "memory")
    monkeypatch.setenv("ADK_ARTIFACT_BACKEND", "memory")
    app = FastAPI()
    services = init_adk_app_state(app)
    assert app.state.adk_services is services
    assert app.state.session_service is services.session_service
    assert app.state.artifact_service is services.artifact_service

    runner = create_runner(
        agent=object(),
        app_name="smoke-app",
        services=services,
    )
    assert runner is not None
