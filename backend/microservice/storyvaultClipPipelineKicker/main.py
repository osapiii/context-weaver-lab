"""Kicker for the StoryVault clip analysis GCP Workflow."""

from __future__ import annotations

import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from google.cloud import firestore, storage
from google.cloud.workflows.executions_v1 import Execution, ExecutionsClient

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "storyvault-dev")
LOCATION = os.getenv("WORKFLOW_LOCATION", "asia-northeast1")
WORKFLOW_NAME = os.getenv("WORKFLOW_NAME", "storyvault-clip-pipeline")
INPUT_BUCKET = os.getenv("PIPELINE_INPUTS_BUCKET", f"{PROJECT_ID}-storyvault-clip-pipeline-inputs")

app = FastAPI(title="storyvault-clip-pipeline-kicker")
db = firestore.Client(project=PROJECT_ID)
storage_client = storage.Client(project=PROJECT_ID)
executions = ExecutionsClient()


def _console_url(name: str) -> str:
    execution_id = name.split("/")[-1]
    return f"https://console.cloud.google.com/workflows/workflow/{LOCATION}/{WORKFLOW_NAME}/execution/{execution_id}?project={PROJECT_ID}"


def _existing_active(data: dict[str, Any]) -> dict[str, Any] | None:
    workflow = data.get("workflow") or {}
    if workflow.get("executionName") and workflow.get("state") == "ACTIVE":
        return workflow
    return None


def _start(body: dict[str, Any], *, retry: bool = False) -> dict[str, Any]:
    request_path = str(body.get("requestPath") or "")
    request_id = str(body.get("requestId") or "")
    if not request_path or not request_id:
        raise ValueError("requestPath and requestId are required")
    ref = db.document(request_path)
    snapshot = ref.get()
    current = snapshot.to_dict() or {}
    existing = _existing_active(current)
    if existing and not retry:
        return {"accepted": True, "alreadyStarted": True, **existing}

    manifest = {
        "requestPath": request_path,
        "requestId": request_id,
        "organizationId": body.get("organizationId"),
        "spaceId": body.get("spaceId"),
        "applicationId": body.get("applicationId") or current.get("applicationId"),
        "clipGroupId": body.get("clipGroupId") or current.get("clipGroupId"),
        "title": body.get("title") or current.get("title"),
        "input": body.get("input") or current.get("input") or {},
        "operationMetadata": body.get("operationMetadata") or current.get("operationMetadata") or {},
        "resume": body.get("command") or {},
    }
    attempt = int((current.get("workflow") or {}).get("attempt") or 0) + 1
    object_name = f"{body.get('organizationId') or 'unknown'}/{request_id}/attempt-{attempt}.json"
    storage_client.bucket(INPUT_BUCKET).blob(object_name).upload_from_string(
        json.dumps(manifest, ensure_ascii=False, default=str), content_type="application/json"
    )
    artifact_uri = f"gs://{INPUT_BUCKET}/{object_name}"
    parent = f"projects/{PROJECT_ID}/locations/{LOCATION}/workflows/{WORKFLOW_NAME}"
    created = executions.create_execution(
        parent=parent,
        execution=Execution(argument=json.dumps({
            "requestPath": request_path,
            "requestId": request_id,
            "inputArtifactUri": artifact_uri,
            "attempt": attempt,
        })),
    )
    name = created.name or ""
    workflow = {
        "executionName": name,
        "executionId": name.split("/")[-1],
        "consoleUrl": _console_url(name),
        "state": "ACTIVE",
        "attempt": attempt,
        "startedAt": firestore.SERVER_TIMESTAMP,
        "endedAt": None,
    }
    ref.update({
        "status": "processing", "workflow": workflow,
        "inputArtifactUri": artifact_uri, "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    return {
        "accepted": True,
        "executionName": name,
        "executionId": name.split("/")[-1],
        "consoleUrl": _console_url(name),
        "state": "ACTIVE",
        "attempt": attempt,
        "inputArtifactUri": artifact_uri,
    }


@app.post("/kick", status_code=202)
async def kick(request: Request):
    try:
        return _start(await request.json())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/retry", status_code=202)
async def retry(request: Request):
    try:
        return _start(await request.json(), retry=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/health")
def health():
    return {"status": "ok", "workflow": WORKFLOW_NAME}
