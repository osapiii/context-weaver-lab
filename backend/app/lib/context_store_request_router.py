"""Routing helpers for contextStore RequestDocs."""

from __future__ import annotations

import hashlib
from typing import Any


class UnsupportedOperationError(ValueError):
    """Raised when a RequestDoc operation cannot be routed."""


def _require_input(input_data: dict[str, Any], key: str) -> Any:
    value = input_data.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise UnsupportedOperationError(f"{key} is required")
    return value


def _request_body(
    request_id: str,
    input_data: dict[str, Any],
    operation_metadata: dict[str, Any],
) -> dict[str, Any]:
    return {
        "request_id": request_id,
        "input": input_data,
        "operation_metadata": operation_metadata,
    }


def _data_store_id_for_request(request_id: str) -> str:
    digest = hashlib.sha1(request_id.encode("utf-8")).hexdigest()[:24]
    return f"fs-{digest}"


def build_context_store_service_call(
    *,
    request_id: str,
    fields: dict[str, Any],
) -> tuple[str, str, dict[str, Any]]:
    input_data = fields.get("input") or {}
    operation_metadata = fields.get("operationMetadata") or {}
    operation_type = input_data.get("operationType")

    if not operation_type:
        raise UnsupportedOperationError("operationType is required")

    if operation_type == "fileSpaceCreate":
        body_input = {
            "displayName": input_data.get("displayName"),
            "dataStoreId": input_data.get("dataStoreId")
            or _data_store_id_for_request(request_id),
        }
        return (
            "POST",
            "/context-store/create",
            _request_body(request_id, body_input, operation_metadata),
        )

    if operation_type == "fileSpaceList":
        return (
            "POST",
            "/context-store",
            _request_body(request_id, {}, operation_metadata),
        )

    if operation_type == "fileSpaceGet":
        store_id = _require_input(input_data, "storeId")
        return (
            "POST",
            f"/context-store/{store_id}",
            _request_body(request_id, {}, operation_metadata),
        )

    if operation_type == "fileSpaceUpload":
        store_id = _require_input(input_data, "storeId")
        body_input: dict[str, Any] = {
            "bucketName": _require_input(input_data, "bucketName"),
            "filePath": _require_input(input_data, "filePath"),
        }
        for optional_key in ("customMetadata", "documentId"):
            value = input_data.get(optional_key)
            if value is not None:
                body_input[optional_key] = value
        return (
            "POST",
            f"/context-store/{store_id}/upload",
            _request_body(request_id, body_input, operation_metadata),
        )

    if operation_type == "fileSpaceDocumentList":
        store_id = _require_input(input_data, "storeId")
        return (
            "POST",
            f"/context-store/{store_id}/documents",
            _request_body(request_id, {}, operation_metadata),
        )

    if operation_type == "fileSpaceDelete":
        store_id = _require_input(input_data, "storeId")
        return (
            "POST",
            f"/context-store/{store_id}/delete",
            _request_body(
                request_id,
                {"force": input_data.get("force", True)},
                operation_metadata,
            ),
        )

    if operation_type == "documentDelete":
        store_id = _require_input(input_data, "storeId")
        document_id = _require_input(input_data, "documentId")
        return (
            "POST",
            f"/context-store/{store_id}/documents/{document_id}/delete",
            _request_body(
                request_id,
                {"force": input_data.get("force", True)},
                operation_metadata,
            ),
        )

    raise UnsupportedOperationError(f"Unsupported operationType: {operation_type}")


def normalize_context_store_output(operation_type: str, output: Any) -> dict[str, Any]:
    if not isinstance(output, dict):
        return {}

    if operation_type == "fileSpaceCreate":
        response = output.get("response")
        if isinstance(response, dict) and response.get("name"):
            return response
        return output

    if operation_type == "fileSpaceList":
        response = output.get("response")
        if isinstance(response, dict) and isinstance(response.get("stores"), list):
            return {"stores": response.get("stores")}
        if isinstance(output.get("stores"), list):
            return {"stores": output.get("stores")}
        return output

    if operation_type == "fileSpaceDocumentList":
        response = output.get("response")
        if isinstance(response, dict) and isinstance(response.get("documents"), list):
            return {"documents": response.get("documents")}
        if isinstance(output.get("documents"), list):
            return {"documents": output.get("documents")}
        return output

    return output
