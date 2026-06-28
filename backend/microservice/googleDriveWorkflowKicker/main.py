"""
Google Drive Workflow Kicker (Cloud Run)

Drive 取り込み RequestDoc (Firestore) を 1 件受け取り、Workflow `gdrive-sync`
を起動するだけの薄い microservice。

責務:
  1. importIds / removeIds を JSON manifest として Firebase Storage に PUT
     organizations/{orgId}/spaces/{spaceId}/knowledges/driveSync/workflowInputs/{requestId}.yml
  2. RequestDoc.input.inputArtifactUri / importCount / removeCount を patch
     (FE が import 件数を即時表示できるように一時保持していた _kickerPayload を消す)
  3. GCP Workflows `gdrive-sync` を `executions.create` で起動
  4. RequestDoc.workflow.{executionName, executionId, consoleUrl, state, startedAt} を patch
  5. 202 を返す。実際の進捗は Workflow が RequestDoc に書き戻す。

呼び出し元: backend/app/triggers/google_drive_sync.py
"""

from __future__ import annotations

import json
import os
import traceback
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore, storage, workflows_v1
from google.cloud.workflows.executions_v1 import (
    Execution,
    ExecutionsClient,
)

from knowledge_storage_paths import (
    drive_sync_workflow_input_gs_uri,
    drive_sync_workflow_input_object_path,
    resolve_knowledge_storage_bucket,
    workflow_input_custom_time,
)

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "en-aistudio-development")
WORKFLOW_LOCATION = os.getenv("WORKFLOW_LOCATION", "us-central1")
WORKFLOW_NAME = os.getenv("WORKFLOW_NAME", "gdrive-sync")
STORAGE_BUCKET = resolve_knowledge_storage_bucket(PROJECT_ID)


def _resolve_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if not raw:
        return [
            "http://localhost:3000",
            "https://vibe-control-dev.web.app",
            "https://vibe-control-dev.firebaseapp.com",
        ]
    if raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="google-drive-workflow-kicker")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)


# Module-level singletons (cached for warm requests)
_db_client: firestore.Client | None = None
_storage_client: storage.Client | None = None
_executions_client: ExecutionsClient | None = None
_workflows_client: workflows_v1.WorkflowsClient | None = None


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


def _get_workflows_client() -> workflows_v1.WorkflowsClient:
    global _workflows_client
    if _workflows_client is None:
        _workflows_client = workflows_v1.WorkflowsClient()
    return _workflows_client


def _yaml_dump(data: dict[str, Any]) -> str:
    """
    YAML 風 (実体は JSON, YAML はその superset なので Workflows http.get で問題なし)
    依存ライブラリを増やさないため JSON で書き出す。
    """
    return json.dumps(data, ensure_ascii=False, indent=2)


def _input_artifact_path(
    *,
    organization_id: str,
    space_id: str,
    request_id: str,
) -> tuple[str, str]:
    """Returns (gcs_object_name, gs_uri)"""
    object_name = drive_sync_workflow_input_object_path(
        organization_id=organization_id,
        space_id=space_id,
        request_id=request_id,
    )
    gs_uri = drive_sync_workflow_input_gs_uri(
        bucket=STORAGE_BUCKET,
        organization_id=organization_id,
        space_id=space_id,
        request_id=request_id,
    )
    return object_name, gs_uri


def _put_input_artifact(
    *,
    organization_id: str,
    space_id: str,
    request_id: str,
    payload: dict[str, Any],
) -> str:
    object_name, gs_uri = _input_artifact_path(
        organization_id=organization_id,
        space_id=space_id,
        request_id=request_id,
    )
    blob = _get_storage().bucket(STORAGE_BUCKET).blob(object_name)
    blob.custom_time = workflow_input_custom_time()
    blob.upload_from_string(
        _yaml_dump(payload),
        content_type="application/x-yaml",
    )
    return gs_uri


def _console_url_for_execution(execution_name: str) -> str:
    # execution_name: projects/{p}/locations/{loc}/workflows/{wf}/executions/{id}
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
    """RequestDoc を patch する (updatedAt 自動付与)"""
    if not request_path:
        return
    payload = {**updates, "updatedAt": firestore.SERVER_TIMESTAMP}
    _get_db().document(request_path).update(payload)


def _kick(body: dict[str, Any]) -> dict[str, Any]:
    request_path = body.get("requestPath")
    request_id = body.get("requestId")
    operation_type = body.get("operationType")
    input_data = body.get("input") or {}
    organization_id = body.get("organizationId") or ""
    operation_metadata = body.get("operationMetadata") or {}
    space_id = (
        operation_metadata.get("spaceId")
        or input_data.get("spaceId")
        or ""
    )
    if not request_path or not request_id:
        raise ValueError("requestPath and requestId are required")
    if not organization_id or not space_id:
        raise ValueError("organizationId and operationMetadata.spaceId are required")
    if operation_type not in ("syncFolder", "syncSingleFolder"):
        raise ValueError(
            f"operationType must be syncFolder or syncSingleFolder, got {operation_type}"
        )

    import_ids = list(input_data.get("importIds") or [])
    remove_ids = list(input_data.get("removeIds") or [])

    # Step 1: input artifact PUT
    connection_id = (input_data.get("connectionId") or "default").strip() or "default"
    artifact_payload = {
        "operationType": operation_type,
        "connectionId": connection_id,
        "rootFolderId": input_data.get("rootFolderId"),
        "rootFolderResourceKey": input_data.get("rootFolderResourceKey"),
        "targetFolderId": input_data.get("targetFolderId"),
        "fileSpaceId": input_data.get("fileSpaceId"),
        "description": input_data.get("description"),
        "importIds": import_ids,
        "removeIds": remove_ids,
        "organizationId": organization_id,
        "operationMetadata": operation_metadata,
    }
    input_artifact_uri = _put_input_artifact(
        organization_id=organization_id,
        space_id=space_id,
        request_id=request_id,
        payload=artifact_payload,
    )

    # Step 2: RequestDoc に inputArtifactUri / importCount / removeCount を patch
    #         + _kickerPayload は破棄 (Firestore 1MB を圧迫しないため)
    _patch_request_doc(
        request_path,
        {
            "input.inputArtifactUri": input_artifact_uri,
            "input.importCount": len(import_ids),
            "input.removeCount": len(remove_ids),
            "status": "processing",
            "_kickerPayload": firestore.DELETE_FIELD,
        },
    )

    # Step 3: Workflow execution を作成
    parent = (
        f"projects/{PROJECT_ID}/locations/{WORKFLOW_LOCATION}/"
        f"workflows/{WORKFLOW_NAME}"
    )
    arguments = {
        "requestPath": request_path,
        "requestId": request_id,
        "inputArtifactUri": input_artifact_uri,
        "operationType": operation_type,
        "organizationId": organization_id,
    }
    execution = Execution(argument=json.dumps(arguments))
    created = _get_executions_client().create_execution(
        parent=parent, execution=execution
    )

    execution_name = created.name
    execution_id = execution_name.split("/")[-1] if execution_name else ""
    console_url = _console_url_for_execution(execution_name)

    # Step 4: RequestDoc.workflow を patch
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
                "currentStage": None,
                "totalFiles": len(import_ids) + len(remove_ids),
                "processedFiles": 0,
                "totalBatches": 0,
                "completedBatches": 0,
                "failedBatches": 0,
            },
            "steps": {},
            "mirror": None,
            "register": None,
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
        # 202 Accepted: Workflow は非同期で走る
        return _accepted_response(output, body.get("requestId"))
    except ValueError as exc:
        # Patch RequestDoc with error if possible
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


def _accepted_response(output: dict[str, Any], request_id: str | None):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=202,
        content={
            "requestId": request_id,
            "status": "accepted",
            "output": output,
        },
    )


def _error_response(status_code: int, message: str):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=status_code,
        content={"status": "error", "error": {"message": message}},
    )


def _parse_gs_uri(gs_uri: str) -> tuple[str, str]:
    """`gs://{bucket}/{object_path}` → `(bucket, object_path)`"""
    if not gs_uri or not gs_uri.startswith("gs://"):
        raise ValueError(f"Not a gs:// URI: {gs_uri!r}")
    rest = gs_uri[len("gs://") :]
    if "/" not in rest:
        raise ValueError(f"Missing object path in {gs_uri!r}")
    bucket, object_path = rest.split("/", 1)
    if not bucket or not object_path:
        raise ValueError(f"Empty bucket or object path in {gs_uri!r}")
    return bucket, object_path


def _fetch_input_artifact(
    *,
    organization_id: str,
    space_id: str,
    request_id: str,
    gs_uri: str | None,
) -> dict[str, Any]:
    """Fetch and return the input YAML/JSON manifest from GCS."""
    if gs_uri:
        bucket, object_path = _parse_gs_uri(gs_uri)
        if bucket != STORAGE_BUCKET:
            raise ValueError(
                f"inputArtifactUri bucket {bucket!r} is not the configured "
                f"storage bucket {STORAGE_BUCKET!r}; refusing to read"
            )
    else:
        if not organization_id or not space_id or not request_id:
            raise ValueError(
                "organizationId, spaceId, and requestId are required when "
                "inputArtifactUri is not provided"
            )
        object_path, _ = _input_artifact_path(
            organization_id=organization_id,
            space_id=space_id,
            request_id=request_id,
        )
        bucket = STORAGE_BUCKET

    blob = _get_storage().bucket(bucket).blob(object_path)
    if not blob.exists():
        return {
            "found": False,
            "bucket": bucket,
            "objectPath": object_path,
            "gsUri": f"gs://{bucket}/{object_path}",
            "manifest": None,
        }
    raw_bytes = blob.download_as_bytes()
    raw_text = raw_bytes.decode("utf-8", errors="replace")
    try:
        manifest = json.loads(raw_text) if raw_text.strip() else {}
    except json.JSONDecodeError:
        manifest = {"__raw__": raw_text}
    return {
        "found": True,
        "bucket": bucket,
        "objectPath": object_path,
        "gsUri": f"gs://{bucket}/{object_path}",
        "sizeBytes": len(raw_bytes),
        "contentType": blob.content_type,
        "updatedAt": blob.updated.isoformat() if blob.updated else None,
        "manifest": manifest,
    }


@app.get("/inspect-input")
async def inspect_input_endpoint(request: Request):
    """Return the Workflows input artifact JSON for debugging from the UI.

    Query params (one of):
      - `gsUri`           : full `gs://{bucket}/{object}` URI (preferred, comes
                             from RequestDoc.input.inputArtifactUri)
      - `requestId` + `organizationId` + `spaceId` : derive the path from convention

    Response: { found, bucket, objectPath, gsUri, sizeBytes?, contentType?,
                updatedAt?, manifest }
    """
    gs_uri = request.query_params.get("gsUri") or request.query_params.get("uri")
    request_id = request.query_params.get("requestId") or ""
    organization_id = request.query_params.get("organizationId") or ""
    space_id = request.query_params.get("spaceId") or ""

    if not gs_uri and not (request_id and organization_id and space_id):
        return _error_response(
            400,
            "Either gsUri or (requestId + organizationId + spaceId) is required",
        )

    try:
        payload = _fetch_input_artifact(
            organization_id=organization_id,
            space_id=space_id,
            request_id=request_id,
            gs_uri=gs_uri,
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
        "service": "google-drive-workflow-kicker",
        "project": PROJECT_ID,
        "workflowName": WORKFLOW_NAME,
        "workflowLocation": WORKFLOW_LOCATION,
        "inputsBucket": STORAGE_BUCKET,
    }
