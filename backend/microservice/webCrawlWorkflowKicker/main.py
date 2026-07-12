"""
Web Crawl Workflow Kicker (Cloud Run)

webCrawlRequests RequestDoc を 1 件受け取り、Workflow `web-crawl` を起動する。
"""

from __future__ import annotations

import json
import os
import traceback
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore, storage
from google.cloud.workflows.executions_v1 import Execution, ExecutionsClient

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "en-aistudio-development")
WORKFLOW_LOCATION = os.getenv("WORKFLOW_LOCATION", "us-central1")
WORKFLOW_NAME = os.getenv("WORKFLOW_NAME", "web-crawl")
INPUTS_BUCKET = os.getenv(
    "WEB_CRAWL_INPUTS_BUCKET",
    f"{PROJECT_ID}-web-crawl-inputs",
)

app = FastAPI(title="web-crawl-workflow-kicker")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

_db_client: firestore.Client | None = None
_storage_client: storage.Client | None = None
_executions_client: ExecutionsClient | None = None


def _get_db() -> firestore.Client:
    global _db_client
    if _db_client is None:
        _db_client = firestore.Client(project=PROJECT_ID)
    return _db_client


def _get_storage() -> storage.Client:
    global _storage_client
    if _storage_client is None:
        _storage_client = storage.Client(project=PROJECT_ID)
    return _storage_client


def _get_executions_client() -> ExecutionsClient:
    global _executions_client
    if _executions_client is None:
        _executions_client = ExecutionsClient()
    return _executions_client


def _yaml_dump(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def _input_artifact_path(organization_id: str, request_id: str) -> tuple[str, str]:
    object_name = f"{organization_id}/{request_id}.yml"
    gs_uri = f"gs://{INPUTS_BUCKET}/{object_name}"
    return object_name, gs_uri


def _put_input_artifact(
    *,
    organization_id: str,
    request_id: str,
    payload: dict[str, Any],
) -> str:
    object_name, gs_uri = _input_artifact_path(organization_id, request_id)
    blob = _get_storage().bucket(INPUTS_BUCKET).blob(object_name)
    blob.upload_from_string(
        _yaml_dump(payload),
        content_type="application/x-yaml",
    )
    return gs_uri


def _console_url_for_execution(execution_name: str) -> str:
    parts = execution_name.split("/")
    try:
        loc = parts[3]
        wf = parts[5]
        eid = parts[7]
    except IndexError:
        return ""
    return (
        f"https://console.cloud.google.com/workflows/workflow/"
        f"{loc}/{wf}/execution/{eid}?project={PROJECT_ID}"
    )


def _patch_request_doc(request_path: str, updates: dict[str, Any]) -> None:
    if not request_path:
        return
    payload = {**updates, "updatedAt": firestore.SERVER_TIMESTAMP}
    _get_db().document(request_path).update(payload)


def _existing_active_execution(doc: dict[str, Any]) -> dict[str, Any] | None:
    """FE kick + Firestore trigger の二重起動を避ける。"""
    workflow = doc.get("workflow") or {}
    execution_name = str(workflow.get("executionName") or "").strip()
    state = workflow.get("state")
    if not execution_name:
        return None
    if state in ("ACTIVE", "SUCCEEDED"):
        return {
            "accepted": True,
            "alreadyStarted": True,
            "executionName": execution_name,
            "executionId": workflow.get("executionId") or execution_name.split("/")[-1],
            "consoleUrl": workflow.get("consoleUrl") or "",
            "inputArtifactUri": (doc.get("input") or {}).get("inputArtifactUri"),
        }
    return None


def _kick(body: dict[str, Any]) -> dict[str, Any]:
    request_path = body.get("requestPath")
    request_id = body.get("requestId")
    input_data = body.get("input") or {}
    organization_id = body.get("organizationId") or ""
    if not request_path or not request_id:
        raise ValueError("requestPath and requestId are required")

    doc_ref = _get_db().document(request_path)
    snap = doc_ref.get()
    if snap.exists:
        existing = _existing_active_execution(snap.to_dict() or {})
        if existing:
            return existing

    artifact_payload = {
        "url": input_data.get("url"),
        "bucketName": input_data.get("bucketName"),
        "folderPath": input_data.get("folderPath"),
        "maxDepth": input_data.get("maxDepth", 1),
        "maxUrls": input_data.get("maxUrls", 100),
        "fileSpaceId": input_data.get("fileSpaceId"),
        "description": input_data.get("description"),
        "includeImages": input_data.get("includeImages", True),
        "organizationId": organization_id,
        "operationMetadata": body.get("operationMetadata") or {},
    }
    input_artifact_uri = _put_input_artifact(
        organization_id=organization_id or "default",
        request_id=request_id,
        payload=artifact_payload,
    )

    _patch_request_doc(
        request_path,
        {
            "input.inputArtifactUri": input_artifact_uri,
            "status": "processing",
        },
    )

    parent = (
        f"projects/{PROJECT_ID}/locations/{WORKFLOW_LOCATION}/"
        f"workflows/{WORKFLOW_NAME}"
    )
    arguments = {
        "requestPath": request_path,
        "requestId": request_id,
        "inputArtifactUri": input_artifact_uri,
        "organizationId": organization_id,
    }
    execution = Execution(argument=json.dumps(arguments))
    created = _get_executions_client().create_execution(
        parent=parent, execution=execution
    )

    execution_name = created.name or ""
    execution_id = execution_name.split("/")[-1] if execution_name else ""
    console_url = _console_url_for_execution(execution_name)

    _patch_request_doc(
        request_path,
        {
            "workflow": {
                "executionName": execution_name,
                "executionId": execution_id,
                "consoleUrl": console_url,
                "state": "ACTIVE",
                "startedAt": firestore.SERVER_TIMESTAMP,
                "endedAt": None,
            },
            "progress": {
                "currentStep": "loadInput",
                "totalPages": 0,
                "processedPages": 0,
                "totalImages": 0,
                "processedImages": 0,
            },
        },
    )

    return {
        "accepted": True,
        "executionName": execution_name,
        "executionId": execution_id,
        "consoleUrl": console_url,
        "inputArtifactUri": input_artifact_uri,
    }


@app.post("/kick")
async def kick_endpoint(request: Request):
    try:
        body = await request.json()
    except Exception as exc:
        return _error_response(400, f"Invalid JSON body: {exc}")

    try:
        output = _kick(body)
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=202,
            content={
                "requestId": body.get("requestId"),
                "status": "accepted",
                "output": output,
            },
        )
    except ValueError as exc:
        request_path = body.get("requestPath")
        if request_path:
            try:
                _patch_request_doc(
                    request_path,
                    {
                        "status": "error",
                        "errorMessage": f"kicker validation error: {exc}",
                    },
                )
            except Exception:
                pass
        return _error_response(400, str(exc))
    except Exception as exc:
        traceback.print_exc()
        request_path = body.get("requestPath")
        if request_path:
            try:
                _patch_request_doc(
                    request_path,
                    {
                        "status": "error",
                        "errorMessage": f"kicker internal error: {exc}",
                    },
                )
            except Exception:
                pass
        return _error_response(500, f"Internal error: {exc}")


def _error_response(status_code: int, message: str):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=status_code,
        content={"status": "error", "error": {"message": message}},
    )


def _cancel(body: dict[str, Any]) -> dict[str, Any]:
    request_path = body.get("requestPath")
    request_id = body.get("requestId")
    execution_name = (body.get("executionName") or "").strip()
    if not request_path:
        raise ValueError("requestPath is required")

    doc_ref = _get_db().document(request_path)
    snap = doc_ref.get()
    if not snap.exists:
        raise ValueError(f"Request document not found: {request_path}")

    doc = snap.to_dict() or {}
    workflow = dict(doc.get("workflow") or {})
    if not execution_name:
        execution_name = str(workflow.get("executionName") or "").strip()

    workflow_cancel_note: str | None = None
    if execution_name:
        try:
            _get_executions_client().cancel_execution(name=execution_name)
        except Exception as exc:
            workflow_cancel_note = str(exc)

    workflow["state"] = "CANCELLED"
    workflow["endedAt"] = firestore.SERVER_TIMESTAMP
    if execution_name:
        workflow["executionName"] = execution_name

    error_message = "ユーザーが取り込みをキャンセルしました"
    if workflow_cancel_note:
        error_message = (
            f"{error_message} (Workflow: {workflow_cancel_note})"
        )

    doc_ref.update(
        {
            "status": "error",
            "errorMessage": error_message,
            "workflow": workflow,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )

    return {
        "cancelled": True,
        "requestId": request_id,
        "executionName": execution_name or None,
        "workflowCancelNote": workflow_cancel_note,
    }


@app.post("/cancel")
async def cancel_endpoint(request: Request):
    try:
        body = await request.json()
    except Exception as exc:
        return _error_response(400, f"Invalid JSON body: {exc}")

    try:
        output = _cancel(body)
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=200,
            content={
                "requestId": body.get("requestId"),
                "status": "cancelled",
                "output": output,
            },
        )
    except ValueError as exc:
        return _error_response(400, str(exc))
    except Exception as exc:
        traceback.print_exc()
        return _error_response(500, f"Internal error: {exc}")


@app.get("/inspect-input")
async def inspect_input_endpoint(request: Request):
    """Return the Workflows input artifact JSON for debugging from the UI."""
    gs_uri = request.query_params.get("gsUri") or request.query_params.get("uri")
    request_id = request.query_params.get("requestId") or ""
    organization_id = request.query_params.get("organizationId") or ""

    if not gs_uri and not (request_id and organization_id):
        return _error_response(
            400,
            "Either gsUri or (requestId + organizationId) is required",
        )

    from workflow_input_inspect import fetch_workflow_input_artifact

    try:

        def resolve_conventional() -> tuple[str, str]:
            object_name, _ = _input_artifact_path(organization_id, request_id)
            return INPUTS_BUCKET, object_name

        payload = fetch_workflow_input_artifact(
            storage_client=_get_storage(),
            gs_uri=gs_uri or None,
            allowed_buckets=frozenset({INPUTS_BUCKET}),
            resolve_conventional_path=resolve_conventional
            if not gs_uri
            else None,
        )
    except ValueError as exc:
        return _error_response(400, str(exc))
    except Exception as exc:
        traceback.print_exc()
        return _error_response(500, f"Failed to read input artifact: {exc}")

    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=200, content=payload)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "web-crawl-workflow-kicker",
        "project": PROJECT_ID,
        "workflowName": WORKFLOW_NAME,
    }
