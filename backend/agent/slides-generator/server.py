"""FastAPI 入口 (Cloud Run の `uvicorn server:app`).

Research Agent (slides-generator) — ADK common runtime 利用.
"""
from __future__ import annotations

import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

_HERE = Path(__file__).resolve().parent
_BACKEND_ROOT = _HERE.parent.parent.parent
_ADK_AGENTS_ROOT = _BACKEND_ROOT / "adk-agents"
for _p in (str(_HERE), str(_HERE / "adk"), str(_ADK_AGENTS_ROOT)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import byok_patch  # noqa: E402

byok_patch.install()

import firebase_admin  # noqa: E402
from firebase_admin import auth as fb_auth  # noqa: E402
from google.cloud import firestore as _fs  # noqa: E402
from google.cloud import storage as _gcs  # noqa: E402

from common.services import (  # type: ignore  # noqa: E402
    create_runner,
    init_adk_app_state,
    register_adk_artifact_routes,
)
from common.session_routes import register_session_routes  # type: ignore  # noqa: E402

from adk import agent as adk_agent_module  # noqa: E402

logger = logging.getLogger("slides_agent_server")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

APP_NAME = "slides-generator"


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
        logger.info("firebase_admin initialized (ADC)")
    services = init_adk_app_state(_app)
    _app.state.fs_client_sync = _fs.Client()
    _app.state.storage_client = _gcs.Client()
    root_agent = adk_agent_module._make_root_agent()
    if root_agent is None:
        logger.error("ADK root_agent unavailable at startup")
        _app.state.runner = None
    else:
        _app.state.runner = create_runner(
            agent=root_agent,
            app_name=APP_NAME,
            services=services,
        )
    logger.info("startup complete (app_name=%s)", APP_NAME)
    yield
    logger.info("shutdown")


app = FastAPI(title="EN AIstudio Research Agent", lifespan=_lifespan)

_CORS_ALLOW = [
    o.strip()
    for o in os.environ.get(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000,https://en-aistudio.app,https://en-aistudio-development.web.app",
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ALLOW,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


async def require_user(request: Request) -> dict[str, Any]:
    auth_header = request.headers.get("Authorization") or request.headers.get(
        "authorization"
    )
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    id_token = auth_header.split(" ", 1)[1].strip()
    try:
        decoded = fb_auth.verify_id_token(id_token, check_revoked=False)
    except Exception as exc:
        logger.warning("token verify failed: %s", exc)
        raise HTTPException(status_code=401, detail="invalid id token") from exc

    uid: str = decoded["uid"]
    fs_client: _fs.Client = request.app.state.fs_client_sync
    snap = (
        fs_client.collection("users")
        .document(uid)
        .collection("secrets")
        .document("geminiApiKey")
        .get()
    )
    if not snap.exists:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY_NOT_REGISTERED")
    data = snap.to_dict() or {}
    api_key = data.get("apiKey")
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY_NOT_REGISTERED")

    byok_patch.current_user_api_key.set(api_key)
    os.environ["GEMINI_API_KEY"] = api_key
    return {"uid": uid, "email": decoded.get("email"), "api_key": api_key}


def _get_services(request: Request):
    return request.app.state.adk_services


def _get_runner(request: Request):
    return request.app.state.runner


def _get_storage_client(request: Request):
    return request.app.state.storage_client


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"status": "ok", "app": APP_NAME, "time": int(time.time())}


register_adk_artifact_routes(app, app_name=APP_NAME)
register_session_routes(
    app,
    app_name=APP_NAME,
    get_services=_get_services,
    get_runner=_get_runner,
    require_user=require_user,
    get_storage_client=_get_storage_client,
)
