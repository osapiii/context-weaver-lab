"""
Web Crawler Microservice - FastAPI Application

GCP Workflow `web-crawl` から `/workflow/run-step` で呼ばれる。
firescrawl / Crawl4AI を使い Markdown を GCS に保存し FileSpace に登録する。
"""

from fastapi import FastAPI, Request
from pydantic import ValidationError as PydanticValidationError
from common import (
    ResponseFormatter,
)
from endpoints.crawl.workflow_execute import WorkflowStepBody, handle_workflow_step

app = FastAPI()


@app.post("/workflow/run-step")
async def workflow_run_step_endpoint(request: Request):
    """
    GCP Workflow `web-crawl` から 1 ステップずつ呼ばれる。
    """
    request_data_dict = {}
    try:
        request_data_dict = await request.json()
        validated = WorkflowStepBody(**request_data_dict)
        return await handle_workflow_step(validated)
    except PydanticValidationError as e:
        return ResponseFormatter.validation_error(
            request_id=request_data_dict.get("requestId", "unknown"),
            endpoint="/workflow/run-step",
            validation_errors=e.errors(),
        )
    except Exception:
        return ResponseFormatter.error(
            request_id=request_data_dict.get("requestId", "unknown"),
            error_type="InternalError",
            message="Unexpected server error",
            status_code=500,
        )


@app.get("/health")
async def health_check():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy"}
