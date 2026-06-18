"""
Workflow step runner for web-crawl GCP Workflow.

Each HTTP call runs a single pipeline step (crawl / uploadToGcs / registerToFileSpace).
The Workflow orchestrates retries and Firestore step writeback; this service owns
the business logic in existing step modules.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from common import ExecutionContext, ResponseFormatter, FatalStepError, initialize
from endpoints.crawl.request_schema import CrawlInput, CrawlRequest
from endpoints.crawl.steps import (
    step1_crawl_page,
    step2_upload_to_gcs,
    step3_register_to_filespace,
)
from endpoints.crawl.workflow_step_state import persist_context_keys

WorkflowStepName = Literal["crawl", "uploadToGcs", "registerToFileSpace"]


class WorkflowStepBody(BaseModel):
    request_path: str = Field(..., alias="requestPath")
    request_id: str = Field(..., alias="requestId")
    step: WorkflowStepName
    input: CrawlInput
    operation_metadata: dict[str, Any] = Field(..., alias="operationMetadata")

    model_config = {"populate_by_name": True}


def _build_context(body: WorkflowStepBody) -> ExecutionContext:
    crawl_request = CrawlRequest(
        request_id=body.request_id,
        input=body.input,
        operation_metadata=body.operation_metadata,
    )
    return initialize(crawl_request)


def _page_previews_from_crawl(context: ExecutionContext) -> list[dict[str, Any]]:
    previews: list[dict[str, Any]] = []
    for page in context.get("crawled_pages") or []:
        meta = page.get("metadata") or {}
        url = page.get("url")
        previews.append(
            {
                "url": url,
                "title": meta.get("title") or page.get("ogTitle"),
                "ogTitle": page.get("ogTitle"),
                "ogDescription": page.get("ogDescription"),
                "ogImage": page.get("ogImage"),
            }
        )
    return previews


def _page_previews_from_markdown_paths(
    markdown_paths: list[dict[str, Any]],
    bucket_name: str | None = None,
) -> list[dict[str, Any]]:
    previews: list[dict[str, Any]] = []
    for entry in markdown_paths:
        thumb_path = entry.get("thumbnailGcsPath")
        previews.append(
            {
                "url": entry.get("url"),
                "title": entry.get("title") or entry.get("ogTitle"),
                "ogTitle": entry.get("ogTitle"),
                "ogDescription": entry.get("ogDescription"),
                "ogImage": entry.get("ogImage"),
                "thumbnailGcsPath": thumb_path,
                "thumbnailBucket": bucket_name if thumb_path else None,
            }
        )
    return previews


def _build_step_output(context: ExecutionContext, step: WorkflowStepName) -> dict:
    markdown_count = context.get("gcs_markdown_count")
    if step == "crawl":
        pages = context.get("crawled_pages") or []
        job_info = context.get("job_info") or {}
        markdown_count = len(pages) or job_info.get("total_pages") or 0

    output: dict[str, Any] = {
        "gcsBucketName": context.get("gcs_bucket_name"),
        "gcsPrefix": context.get("gcs_prefix"),
        "markdownCount": markdown_count,
        "imageCount": context.get("gcs_image_count"),
        "skippedImageCount": context.get("gcs_skipped_image_count"),
        "images": context.get("gcs_image_meta") or [],
        "filespaceRegisteredCount": context.get("filespace_registered_count"),
        "filespaceRegisterFailed": context.get("filespace_register_failed"),
        "filespaceImageDocCount": context.get("filespace_image_doc_count"),
        "totalPages": markdown_count,
    }

    markdown_paths = context.get("gcs_markdown_paths") or []
    bucket_name = context.get("gcs_bucket_name")
    if markdown_paths:
        output["pages"] = _page_previews_from_markdown_paths(
            markdown_paths, bucket_name
        )
    else:
        crawl_pages = _page_previews_from_crawl(context)
        if crawl_pages:
            output["pages"] = crawl_pages

    job_info = context.get("job_info") or {}
    saved_files = job_info.get("saved_files")
    if saved_files:
        output["savedFiles"] = saved_files

    return output


async def handle_workflow_step(body: WorkflowStepBody) -> dict:
    context = _build_context(body)
    step = body.step
    try:
        if step == "crawl":
            step1_crawl_page.execute(context)
        elif step == "uploadToGcs":
            step2_upload_to_gcs.execute(context)
        elif step == "registerToFileSpace":
            step3_register_to_filespace.execute(context)
        else:
            return ResponseFormatter.error(
                request_id=body.request_id,
                error_type="ValidationError",
                message=f"Unknown step: {step}",
                status_code=400,
            )

        output = _build_step_output(context, step)
        if step == "registerToFileSpace":
            persist_context_keys(
                context,
                [
                    "filespace_registered_count",
                    "filespace_register_failed",
                    "filespace_image_doc_count",
                ],
            )
        return ResponseFormatter.success(
            request_id=body.request_id, output=output
        )
    except FatalStepError as e:
        return ResponseFormatter.error(
            request_id=body.request_id,
            error_type="StepExecutionError",
            message=str(e),
            status_code=500,
        )
    except Exception as e:
        return ResponseFormatter.error(
            request_id=body.request_id,
            error_type="InternalError",
            message=f"Unexpected server error: {e}",
            status_code=500,
        )
