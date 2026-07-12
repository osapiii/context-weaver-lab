from lib.context_store_request_router import (
    build_context_store_service_call,
    normalize_context_store_output,
)


def _fields(operation_type: str, **input_overrides):
    return {
        "input": {"operationType": operation_type, **input_overrides},
        "operationMetadata": {
            "organizationId": "org",
            "spaceId": "space",
            "requestedBy": {"email": "user@example.com", "role": 1},
        },
    }


def test_build_create_call():
    method, endpoint, body = build_context_store_service_call(
        request_id="req-1",
        fields=_fields("fileSpaceCreate", displayName="App Space"),
    )

    assert method == "POST"
    assert endpoint == "/context-store/create"
    assert body["request_id"] == "req-1"
    assert body["input"]["displayName"] == "App Space"
    assert body["input"]["dataStoreId"].startswith("fs-")


def test_build_upload_call():
    method, endpoint, body = build_context_store_service_call(
        request_id="req-2",
        fields=_fields(
            "fileSpaceUpload",
            storeId="store-1",
            bucketName="bucket",
            filePath="path/file.pdf",
            documentId="doc-1",
        ),
    )

    assert method == "POST"
    assert endpoint == "/context-store/store-1/upload"
    assert body["input"] == {
        "bucketName": "bucket",
        "filePath": "path/file.pdf",
        "documentId": "doc-1",
    }


def test_normalize_document_list_output():
    output = normalize_context_store_output(
        "fileSpaceDocumentList",
        {"statusCode": 200, "response": {"documents": [{"name": "doc"}]}},
    )

    assert output == {"documents": [{"name": "doc"}]}


def test_normalize_list_output():
    output = normalize_context_store_output(
        "fileSpaceList",
        {"statusCode": 200, "response": {"stores": [{"name": "store"}]}},
    )

    assert output == {"stores": [{"name": "store"}]}
