"""Agent Search (Vertex AI Search / Discovery Engine) client — ADC + REST."""

from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Any

import requests
from google.auth import default as google_auth_default
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.cloud import storage

from common import FatalStepError

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "en-aistudio-development")
LOCATION = os.environ.get("VERTEX_SEARCH_LOCATION", "global")
COLLECTION = os.environ.get("AGENT_SEARCH_COLLECTION", "default_collection")
BRANCH = os.environ.get("AGENT_SEARCH_BRANCH", "default_branch")


def _api_root(location: str) -> str:
    if location in ("", "global"):
        return "https://discoveryengine.googleapis.com"
    return f"https://{location}-discoveryengine.googleapis.com"


def _collection_path() -> str:
    return f"projects/{PROJECT_ID}/locations/{LOCATION}/collections/{COLLECTION}"


def _datastore_path(data_store_id: str) -> str:
    return f"{_collection_path()}/dataStores/{data_store_id}"


def _branch_path(data_store_id: str) -> str:
    return f"{_datastore_path(data_store_id)}/branches/{BRANCH}"


class DiscoveryEngineClient:
    """Discovery Engine REST wrapper for context store CRUD + GCS import."""

    def __init__(self) -> None:
        creds, _ = google_auth_default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        self._creds = creds
        self._refresh_token()
        self._session = requests.Session()
        self._storage = storage.Client(project=PROJECT_ID)

    def _refresh_token(self) -> None:
        if not self._creds.valid:
            self._creds.refresh(GoogleAuthRequest())
        if not self._creds.token:
            raise FatalStepError(
                step_name="discovery_engine_client_init",
                message="Failed to obtain ADC access token",
                error_code="ADC_ERROR",
            )

    def _headers(self) -> dict[str, str]:
        self._refresh_token()
        return {
            "Authorization": f"Bearer {self._creds.token}",
            "Content-Type": "application/json",
            "x-goog-user-project": PROJECT_ID,
        }

    def _wait_import_operation(self, operation: dict[str, Any]) -> dict[str, Any]:
        """Poll documents:import LRO and fail on errorSamples."""
        if operation.get("done"):
            final = operation
        else:
            op_name = operation.get("name")
            if not op_name:
                raise FatalStepError(
                    step_name="import_from_gcs",
                    message="Import operation missing name",
                    error_code="IMPORT_OPERATION_INVALID",
                )
            url = f"{_api_root(LOCATION)}/v1alpha/{op_name}"
            final = operation
            for _ in range(60):
                final = self._request("GET", url, timeout=120)
                if final.get("done"):
                    break
                time.sleep(2)
            if not final.get("done"):
                raise FatalStepError(
                    step_name="import_from_gcs",
                    message="Import operation timed out",
                    error_code="IMPORT_TIMEOUT",
                )
        response = final.get("response") or {}
        errors = response.get("errorSamples") or []
        meta = final.get("metadata") or {}
        failure_count = int(meta.get("failureCount") or 0)
        if errors or failure_count > 0:
            msg = errors[0].get("message") if errors else f"failureCount={failure_count}"
            raise FatalStepError(
                step_name="import_from_gcs",
                message=f"Import failed: {msg}",
                error_code="IMPORT_FAILED",
            )
        return final

    def _request(
        self,
        method: str,
        url: str,
        *,
        json_data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        timeout: int = 120,
    ) -> dict[str, Any]:
        try:
            resp = self._session.request(
                method,
                url,
                headers=self._headers(),
                json=json_data,
                params=params,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise FatalStepError(
                step_name="discovery_engine_request",
                message=str(exc),
                error_code="HTTP_ERROR",
            ) from exc
        if resp.status_code == 401:
            self._creds.refresh(GoogleAuthRequest())
            resp = self._session.request(
                method,
                url,
                headers=self._headers(),
                json=json_data,
                params=params,
                timeout=timeout,
            )
        if resp.status_code >= 400:
            raise FatalStepError(
                step_name="discovery_engine_request",
                message=f"HTTP {resp.status_code}: {resp.text[:500]}",
                error_code="API_ERROR",
            )
        if not resp.text.strip():
            return {}
        return resp.json()

    def create_data_store(
        self, *, display_name: str | None = None, data_store_id: str | None = None
    ) -> dict[str, Any]:
        store_id = data_store_id or uuid.uuid4().hex[:24]
        url = (
            f"{_api_root(LOCATION)}/v1alpha/{_collection_path()}/dataStores"
            f"?dataStoreId={store_id}"
        )
        body = {
            "displayName": display_name or f"EN AIstudio Context Store {store_id[:8]}",
            "industryVertical": "GENERIC",
            "solutionTypes": ["SOLUTION_TYPE_SEARCH"],
            "contentConfig": "CONTENT_REQUIRED",
        }
        result = self._request("POST", url, json_data=body)
        name = result.get("name") or _datastore_path(store_id)
        return {
            "status_code": 200,
            "response": {
                "name": name,
                "displayName": result.get("displayName") or body["displayName"],
                "createTime": result.get("createTime"),
                "updateTime": result.get("updateTime"),
                "agentSearchDatastorePath": name,
                "indexBackend": "agent_search",
            },
        }

    def get_data_store(self, data_store_id: str) -> dict[str, Any]:
        url = f"{_api_root(LOCATION)}/v1alpha/{_datastore_path(data_store_id)}"
        result = self._request("GET", url)
        return {"status_code": 200, "response": result}

    def list_data_stores(self) -> dict[str, Any]:
        url = f"{_api_root(LOCATION)}/v1alpha/{_collection_path()}/dataStores"
        result = self._request("GET", url)
        stores = result.get("dataStores") or []
        return {
            "status_code": 200,
            "response": {
                "stores": [
                    {
                        "name": s.get("name"),
                        "displayName": s.get("displayName"),
                        "createTime": s.get("createTime"),
                        "updateTime": s.get("updateTime"),
                    }
                    for s in stores
                ]
            },
        }

    def delete_data_store(self, data_store_id: str) -> dict[str, Any]:
        url = f"{_api_root(LOCATION)}/v1alpha/{_datastore_path(data_store_id)}"
        self._request("DELETE", url)
        return {"status_code": 200, "response": {}}

    def _guess_mime(self, blob: storage.Blob, file_path: str) -> str:
        """Map GCS objects to Discovery Engine supported mime types."""
        lower = file_path.lower()
        if lower.endswith(".pdf"):
            return "application/pdf"
        if lower.endswith(".html") or lower.endswith(".htm"):
            return "text/html"
        if lower.endswith(".xml"):
            return "application/xml"
        if lower.endswith(".json"):
            return "application/json"
        if lower.endswith((".jpg", ".jpeg")):
            return "image/jpeg"
        if lower.endswith(".png"):
            return "image/png"
        if lower.endswith(".gif"):
            return "image/gif"
        if lower.endswith(".bmp"):
            return "image/bmp"
        if lower.endswith(".tif") or lower.endswith(".tiff"):
            return "image/tiff"
        if lower.endswith(".webp"):
            return "image/webp"
        if lower.endswith(".avif"):
            return "image/avif"
        if lower.endswith(".svg"):
            return "image/svg+xml"
        if lower.endswith((".docx", ".pptx", ".xlsx", ".xlsm")):
            ext_map = {
                ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xlsm": "application/vnd.ms-excel.sheet.macroenabled.12",
            }
            for ext, mime in ext_map.items():
                if lower.endswith(ext):
                    return mime
        # .md / .csv / .txt — Agent Search は text/markdown, text/csv 非対応
        if blob.content_type and blob.content_type not in (
            "application/octet-stream",
            "text/markdown",
            "text/csv",
        ):
            return blob.content_type
        return "text/plain"

    def import_from_gcs(
        self,
        *,
        data_store_id: str,
        bucket_name: str,
        file_path: str,
        document_id: str | None = None,
        struct_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        blob = self._storage.bucket(bucket_name).blob(file_path)
        if not blob.exists():
            raise FatalStepError(
                step_name="import_from_gcs",
                message=f"GCS object not found: gs://{bucket_name}/{file_path}",
                error_code="GCS_NOT_FOUND",
            )
        doc_id = document_id or uuid.uuid4().hex
        mime = self._guess_mime(blob, file_path)
        uri = f"gs://{bucket_name}/{file_path}"
        url = (
            f"{_api_root(LOCATION)}/v1alpha/{_branch_path(data_store_id)}"
            "/documents:import"
        )
        inline_doc: dict[str, Any] = {
            "id": doc_id,
            "content": {"mimeType": mime, "uri": uri},
            "structData": struct_data
            or {
                "title": os.path.basename(file_path),
                "uri": uri,
                "gcsUri": uri,
            },
        }
        body = {"inlineSource": {"documents": [inline_doc]}}
        result = self._wait_import_operation(
            self._request("POST", url, json_data=body, timeout=300)
        )
        full_name = f"{_branch_path(data_store_id)}/documents/{doc_id}"
        return {
            "status_code": 200,
            "response": {
                "name": full_name,
                "id": doc_id,
                "agentSearchDocumentId": doc_id,
                "operation": result,
            },
        }

    def list_documents(
        self, data_store_id: str, *, page_size: int = 100
    ) -> dict[str, Any]:
        url = f"{_api_root(LOCATION)}/v1alpha/{_branch_path(data_store_id)}/documents"
        collected: list[dict[str, Any]] = []
        page_token: str | None = None
        while True:
            params: dict[str, Any] = {"pageSize": page_size}
            if page_token:
                params["pageToken"] = page_token
            result = self._request("GET", url, params=params)
            batch = result.get("documents") or []
            collected.extend(batch)
            page_token = result.get("nextPageToken")
            if not page_token:
                break
        return {
            "status_code": 200,
            "response": {
                "documents": [
                    {
                        "name": d.get("name"),
                        "id": d.get("id"),
                        "structData": d.get("structData"),
                    }
                    for d in collected
                ]
            },
        }

    def get_document(self, data_store_id: str, document_id: str) -> dict[str, Any]:
        url = (
            f"{_api_root(LOCATION)}/v1alpha/"
            f"{_branch_path(data_store_id)}/documents/{document_id}"
        )
        result = self._request("GET", url)
        return {"status_code": 200, "response": result}

    def delete_document(self, data_store_id: str, document_id: str) -> dict[str, Any]:
        url = (
            f"{_api_root(LOCATION)}/v1alpha/"
            f"{_branch_path(data_store_id)}/documents/{document_id}"
        )
        self._request("DELETE", url)
        return {"status_code": 200, "response": {}}


_client: DiscoveryEngineClient | None = None


def get_discovery_engine_client() -> DiscoveryEngineClient:
    global _client
    if _client is None:
        _client = DiscoveryEngineClient()
    return _client
