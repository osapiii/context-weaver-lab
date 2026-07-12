"""
Context Store Microservice - Agent Search (Discovery Engine)
"""

import uuid
from fastapi import FastAPI, Request
from pydantic import ValidationError as PydanticValidationError
from common import (
    initialize,
    ResponseFormatter,
    MicroserviceValidationError
)
from endpoints.create_store.request_schema import CreateStoreRequest
from endpoints.create_store import execute as create_store_execute
from endpoints.upload_file.request_schema import UploadFileRequest
from endpoints.upload_file import execute as upload_file_execute
from endpoints.upload_files_batch.request_schema import UploadFilesBatchRequest
from endpoints.upload_files_batch import execute as upload_files_batch_execute
from endpoints.get_store.request_schema import GetStoreRequest
from endpoints.get_store import execute as get_store_execute
from endpoints.list_stores.request_schema import ListStoresRequest
from endpoints.list_stores import execute as list_stores_execute
from endpoints.delete_store.request_schema import DeleteStoreRequest
from endpoints.delete_store import execute as delete_store_execute
from endpoints.list_documents.request_schema import ListDocumentsRequest
from endpoints.list_documents import execute as list_documents_execute
from endpoints.get_document.request_schema import GetDocumentRequest
from endpoints.get_document import execute as get_document_execute
from endpoints.delete_document.request_schema import DeleteDocumentRequest
from endpoints.delete_document import execute as delete_document_execute

app = FastAPI()


@app.post("/context-store/create")
async def create_store_endpoint(request: Request):
    """
    FileSearchStore作成エンドポイント
    
    POST /context-store/create
    """
    request_data_dict = {}
    try:
        request_data_dict = await request.json()
        validated_request = CreateStoreRequest(**request_data_dict)
        
        context = initialize(validated_request)
        return await create_store_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint="/context-store/create",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.post("/context-store/{store_id}/upload")
async def upload_file_endpoint(store_id: str, request: Request):
    """
    ファイルアップロードエンドポイント
    
    POST /context-store/{store_id}/upload
    """
    request_data_dict = {}
    try:
        request_data_dict = await request.json()
        validated_request = UploadFileRequest(**request_data_dict)
        
        context = initialize(validated_request)
        # パスパラメータをcontextに保存
        context.set('store_id', store_id)
        
        return await upload_file_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint=f"/context-store/{store_id}/upload",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.post("/context-store/{store_id}/upload-files-batch")
async def upload_files_batch_endpoint(store_id: str, request: Request):
    """
    バッチファイルアップロードエンドポイント
    
    POST /context-store/{store_id}/upload-files-batch
    最大50ファイルまで一括登録可能
    """
    request_data_dict = {}
    try:
        request_data_dict = await request.json()
        validated_request = UploadFilesBatchRequest(**request_data_dict)
        
        context = initialize(validated_request)
        # パスパラメータをcontextに保存
        context.set('store_id', store_id)
        
        return await upload_files_batch_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint=f"/context-store/{store_id}/upload-files-batch",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.post("/context-store/{store_id}")
async def get_store_endpoint(store_id: str, request: Request):
    """
    FileSearchStore情報取得エンドポイント
    
    POST /context-store/{store_id}
    
    RequestDoc標準構造準拠のリクエストボディからrequest_idとoperation_metadataを取得
    """
    request_data_dict = {}
    try:
        # リクエストボディから取得
        request_data_dict = await request.json()
        
        # request_idがなければ自動生成
        if 'request_id' not in request_data_dict:
            request_data_dict['request_id'] = str(uuid.uuid4())
        
        # inputがなければ空のGetStoreInputを作成
        if 'input' not in request_data_dict:
            request_data_dict['input'] = {}
        
        validated_request = GetStoreRequest(**request_data_dict)
        
        context = initialize(validated_request)
        # パスパラメータをcontextに保存
        context.set('store_id', store_id)
        
        return await get_store_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint=f"/context-store/{store_id}",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.post("/context-store")
async def list_stores_endpoint(request: Request):
    """
    FileSearchStore一覧取得エンドポイント
    
    POST /context-store
    
    Note: RequestDoc構造を採用（統一性のため）
    リクエストボディからrequest_idとoperation_metadataを取得
    """
    request_data_dict = {}
    try:
        # POSTリクエストのため、リクエストボディから取得
        request_data_dict = await request.json()
        
        # request_idがなければ自動生成
        if 'request_id' not in request_data_dict:
            request_data_dict['request_id'] = str(uuid.uuid4())
        
        # operation_metadataがなければデフォルト値で補完
        if 'operation_metadata' not in request_data_dict:
            from common import RequestedBy
            requested_by = RequestedBy(
                email='system@example.com',
                role=1
            )
            request_data_dict['operation_metadata'] = {
                'organization_id': 'default',
                'space_id': 'default',
                'requested_by': requested_by.model_dump(by_alias=False)
            }
        
        # inputがなければ空のListStoresInputを作成
        if 'input' not in request_data_dict:
            request_data_dict['input'] = {}
        
        validated_request = ListStoresRequest(**request_data_dict)
        
        context = initialize(validated_request)
        return await list_stores_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint="/context-store",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.delete("/context-store/{store_id}")
async def delete_store_endpoint(store_id: str, request: Request):
    """
    FileSearchStore削除エンドポイント
    
    DELETE /context-store/{store_id}
    """
    request_data_dict = {}
    try:
        request_data_dict = await request.json()
        validated_request = DeleteStoreRequest(**request_data_dict)
        
        context = initialize(validated_request)
        # パスパラメータをcontextに保存
        context.set('store_id', store_id)
        
        return await delete_store_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint=f"/context-store/{store_id}",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.post("/context-store/{store_id}/documents")
async def list_documents_endpoint(store_id: str, request: Request):
    """
    Document一覧取得エンドポイント
    
    POST /context-store/{store_id}/documents
    
    RequestDoc標準構造準拠のリクエストボディからrequest_idとoperation_metadataを取得
    """
    request_data_dict = {}
    try:
        # リクエストボディから取得
        request_data_dict = await request.json()
        
        # request_idがなければ自動生成
        if 'request_id' not in request_data_dict:
            request_data_dict['request_id'] = str(uuid.uuid4())
        
        # inputがなければ空のListDocumentsInputを作成
        if 'input' not in request_data_dict:
            request_data_dict['input'] = {}
        
        validated_request = ListDocumentsRequest(**request_data_dict)
        
        context = initialize(validated_request)
        # パスパラメータをcontextに保存
        context.set('store_id', store_id)
        
        return await list_documents_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint=f"/context-store/{store_id}/documents",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.post("/context-store/{store_id}/documents/{document_id}")
async def get_document_endpoint(store_id: str, document_id: str, request: Request):
    """
    Document情報取得エンドポイント
    
    POST /context-store/{store_id}/documents/{document_id}
    
    RequestDoc標準構造準拠のリクエストボディからrequest_idとoperation_metadataを取得
    """
    request_data_dict = {}
    try:
        # リクエストボディから取得
        request_data_dict = await request.json()
        
        # request_idがなければ自動生成
        if 'request_id' not in request_data_dict:
            request_data_dict['request_id'] = str(uuid.uuid4())
        
        # inputがなければ空のGetDocumentInputを作成
        if 'input' not in request_data_dict:
            request_data_dict['input'] = {}
        
        validated_request = GetDocumentRequest(**request_data_dict)
        
        context = initialize(validated_request)
        # パスパラメータをcontextに保存
        context.set('store_id', store_id)
        context.set('document_id', document_id)
        
        return await get_document_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint=f"/context-store/{store_id}/documents/{document_id}",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.delete("/context-store/{store_id}/documents/{document_id}")
async def delete_document_endpoint(store_id: str, document_id: str, request: Request):
    """
    Document削除エンドポイント
    
    DELETE /context-store/{store_id}/documents/{document_id}
    """
    request_data_dict = {}
    try:
        request_data_dict = await request.json()
        validated_request = DeleteDocumentRequest(**request_data_dict)
        
        context = initialize(validated_request)
        # パスパラメータをcontextに保存
        context.set('store_id', store_id)
        context.set('document_id', document_id)
        
        return await delete_document_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint=f"/context-store/{store_id}/documents/{document_id}",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.post("/context-store/{store_id}/documents/{document_id}/delete")
async def delete_document_post_endpoint(store_id: str, document_id: str, request: Request):
    """
    Document削除エンドポイント（POST版）
    
    POST /context-store/{store_id}/documents/{document_id}/delete
    """
    request_data_dict = {}
    try:
        request_data_dict = await request.json()
        validated_request = DeleteDocumentRequest(**request_data_dict)
        
        context = initialize(validated_request)
        # パスパラメータをcontextに保存
        context.set('store_id', store_id)
        context.set('document_id', document_id)
        
        return await delete_document_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint=f"/context-store/{store_id}/documents/{document_id}/delete",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.post("/context-store/{store_id}/delete")
async def delete_store_post_endpoint(store_id: str, request: Request):
    """
    FileSearchStore削除エンドポイント（POST版）
    
    POST /context-store/{store_id}/delete
    """
    request_data_dict = {}
    try:
        request_data_dict = await request.json()
        validated_request = DeleteStoreRequest(**request_data_dict)
        
        context = initialize(validated_request)
        # パスパラメータをcontextに保存
        context.set('store_id', store_id)
        
        return await delete_store_execute.handle(context)
        
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("request_id", "unknown"),
            endpoint=f"/context-store/{store_id}/delete",
            validation_errors=e.errors()
        )
    except MicroserviceValidationError as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="ValidationError",
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("request_id", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500
        )


@app.get("/health")
async def health_check():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy"}

