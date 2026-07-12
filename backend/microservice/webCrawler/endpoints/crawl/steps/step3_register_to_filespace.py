"""
Step 3: Register GCS Markdown to Gemini File Search Store + Firestore Documents
(Phase R-1c)

step2 で GCS に置いた markdown / 画像 / manifest を、

  - markdown / 対応画像 → Agent Search (context-store) に import → Document 作成
  - Agent Search 非対応の画像 (webp/svg 等) → Firestore のみ (カタログ用)

として直接登録する。旧 Phase R-1b の「driveSync RequestDoc を発行 → 別 trigger →
別 microservice」の経路を廃止し、webCrawler の中で一気通貫で済ませる。

## Phase R-1c 改善 (2026-05-12)
- 16 markdown を `ThreadPoolExecutor(max_workers=8)` で並列 upload
- 各 upload の HTTP timeout を 30s (旧 180s) に短縮
- 503 / 429 / 500 は exponential backoff (1s, 3s) で最大 2 回リトライ
- step3 全体に 90s の wall-clock 上限。超過分はベストエフォートで諦めて failed カウント
"""

from __future__ import annotations

import hashlib
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import requests
from google.cloud import firestore

from common import ExecutionContext, FatalStepError
from common.agent_search_media import is_agent_search_importable_image_mime
from common.parent_path_creator import ParentPathCreator
from endpoints.crawl.workflow_step_state import restore_context_keys

CONTEXT_STORE_SERVICE_URL = os.getenv(
    "CONTEXT_STORE_SERVICE_URL",
    "https://context-store-mdgjayj74q-uc.a.run.app",
).rstrip("/")

# === 並列度 / タイムアウト / リトライ ============================================
# - Cloud Functions trigger の timeout は 540s。 ここはそれより十分小さく設定する
# - Gemini File Search が一時的に遅い (15-30s/req) ケースが日常的にあるので、
#   タイムアウトに引っかからないよう余裕を持たせる
UPLOAD_CONCURRENCY = 8
PER_UPLOAD_TIMEOUT_SEC = 60  # 個別 HTTP timeout (30 → 60)
RETRYABLE_STATUSES = {429, 500, 502, 503, 504}
MAX_RETRIES = 3  # 2 → 3 (Gemini は時々連続で 503 を返してくる)
BACKOFF_SCHEDULE = [1.0, 3.0, 7.0]  # 503 等のときの待ち時間 (秒)
STEP3_TOTAL_DEADLINE_SEC = 360  # 全体の wall-clock cap (90 → 360 = 6 min)


def _meta_get(meta, key: str, snake_alt: Optional[str] = None):
    if meta is None:
        return None
    if hasattr(meta, key):
        return getattr(meta, key)
    if snake_alt and hasattr(meta, snake_alt):
        return getattr(meta, snake_alt)
    if isinstance(meta, dict):
        return meta.get(key) or (meta.get(snake_alt) if snake_alt else None)
    return None


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _stable_doc_suffix(seed: str, modulo: int) -> int:
    """Frontend と同じ SHA-256 ベースの安定 suffix（Python hash はプロセス依存のため不使用）。"""
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8]
    return int(digest, 16) % modulo


def _firestore_doc_id_markdown(md_path: str, md_filename: str) -> str:
    return (
        f"webcrawl_{md_filename.replace('.md', '')}_"
        f"{_stable_doc_suffix(md_path, 100000)}"
    )


def _firestore_doc_id_image(gcs_path: str) -> str:
    return f"webcrawl_img_{_stable_doc_suffix(gcs_path, 1000000)}"


def _custom_metadata_entries(struct_data: Dict[str, Any]) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for key, value in struct_data.items():
        if value is None:
            continue
        text = str(value).strip()
        if not text:
            continue
        entries.append({"key": key, "stringValue": text})
    return entries


def _build_agent_search_struct_data(
    *,
    firestore_doc_id: str,
    gcs_path: str,
    bucket_name: str,
    web_crawl_request_id: str,
    page_filename: Optional[str] = None,
    source_page_url: Optional[str] = None,
    sub_category: Optional[str] = None,
) -> Dict[str, str]:
    data: Dict[str, str] = {
        "firestoreDocId": firestore_doc_id,
        "gcsUri": f"gs://{bucket_name}/{gcs_path}",
        "filePath": gcs_path,
        "webCrawlRequestId": web_crawl_request_id,
    }
    if page_filename:
        data["pageFilename"] = page_filename
    if source_page_url:
        data["sourcePageUrl"] = source_page_url
    if sub_category:
        data["subCategory"] = sub_category
    return data


def _upload_one_gcs_file_to_context_store(
    item: Dict[str, Any],
    file_space_id: str,
    bucket_name: str,
    op_meta_dict: Any,
    request_id: str,
    *,
    upload_key: str,
    firestore_doc_id: Optional[str] = None,
    struct_data: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], Optional[str], Optional[str]]:
    """GCS 上の 1 ファイルを context-store (Agent Search) に import。

    Returns:
        (item, agent_search_document_id, error_msg)
    """
    gcs_path = item.get("gcsPath")
    filename = item.get("filename")
    if not gcs_path or not filename:
        return (item, None, "missing_path_or_filename")

    input_block: Dict[str, Any] = {
        "bucket_name": bucket_name,
        "file_path": gcs_path,
    }
    if firestore_doc_id:
        input_block["document_id"] = firestore_doc_id
    if struct_data:
        input_block["custom_metadata"] = _custom_metadata_entries(struct_data)

    upload_payload = {
        "request_id": f"{request_id}_upload_{upload_key}_{filename}",
        "input": input_block,
        "operation_metadata": op_meta_dict,
    }

    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = requests.post(
                f"{CONTEXT_STORE_SERVICE_URL}/context-store/{file_space_id}/upload",
                json=upload_payload,
                headers={"Content-Type": "application/json"},
                timeout=PER_UPLOAD_TIMEOUT_SEC,
            )
        except requests.exceptions.Timeout:
            last_err = f"timeout after {PER_UPLOAD_TIMEOUT_SEC}s"
            if attempt < MAX_RETRIES:
                time.sleep(BACKOFF_SCHEDULE[attempt])
                continue
            return (item, None, last_err)
        except Exception as e:
            last_err = f"request_error: {e}"
            return (item, None, last_err)

        if resp.status_code in RETRYABLE_STATUSES and attempt < MAX_RETRIES:
            last_err = f"http_{resp.status_code}"
            time.sleep(BACKOFF_SCHEDULE[attempt])
            continue
        if resp.status_code >= 400:
            return (
                item,
                None,
                f"http_{resp.status_code}: {resp.text[:120]}",
            )

        try:
            resp_json = resp.json() or {}
        except Exception as e:
            return (item, None, f"invalid_json: {e}")
        upload_output = resp_json.get("output", {}) or {}
        if isinstance(upload_output, dict):
            inner_status = upload_output.get("statusCode")
            inner_error = upload_output.get("error")
        else:
            inner_status = None
            inner_error = None
        if inner_status and int(inner_status) in RETRYABLE_STATUSES and attempt < MAX_RETRIES:
            last_err = f"inner_{inner_status}"
            time.sleep(BACKOFF_SCHEDULE[attempt])
            continue
        if (inner_status and int(inner_status) >= 400) or inner_error:
            return (
                item,
                None,
                f"inner_error: status={inner_status} error={inner_error}",
            )

        document_id = None
        if isinstance(upload_output.get("response"), dict):
            resp_inner = upload_output["response"]
            document_id = (
                resp_inner.get("agentSearchDocumentId")
                or resp_inner.get("id")
                or resp_inner.get("name")
            )
        if not document_id:
            document_id = upload_output.get("agentSearchDocumentId") or upload_output.get("name")
        if not document_id:
            return (item, None, "no_document_id_in_response")
        return (item, document_id, None)

    return (item, None, last_err or "exhausted_retries")


def _upload_one_markdown_to_gemini(
    md: Dict[str, Any],
    file_space_id: str,
    bucket_name: str,
    op_meta_dict: Any,
    request_id: str,
) -> Tuple[Dict[str, Any], Optional[str], Optional[str]]:
    gcs_path = md.get("gcsPath") or ""
    filename = md.get("filename") or ""
    doc_id = _firestore_doc_id_markdown(gcs_path, filename)
    struct = _build_agent_search_struct_data(
        firestore_doc_id=doc_id,
        gcs_path=gcs_path,
        bucket_name=bucket_name,
        web_crawl_request_id=request_id,
        page_filename=filename,
        source_page_url=md.get("url"),
        sub_category="urlMarkdown",
    )
    return _upload_one_gcs_file_to_context_store(
        md,
        file_space_id,
        bucket_name,
        op_meta_dict,
        request_id,
        upload_key="md",
        firestore_doc_id=doc_id,
        struct_data=struct,
    )


def _guess_image_mime(filename: str) -> str:
    f = filename.lower()
    if f.endswith(".jpg") or f.endswith(".jpeg"):
        return "image/jpeg"
    if f.endswith(".png"):
        return "image/png"
    if f.endswith(".gif"):
        return "image/gif"
    if f.endswith(".webp"):
        return "image/webp"
    if f.endswith(".svg"):
        return "image/svg+xml"
    if f.endswith(".bmp"):
        return "image/bmp"
    if f.endswith(".avif"):
        return "image/avif"
    return "application/octet-stream"


def execute(context: ExecutionContext) -> None:
    """GCS 上の markdown を Gemini に並列登録 + Document を Firestore に書く"""
    try:
        restore_context_keys(
            context,
            [
                "gcs_bucket_name",
                "gcs_prefix",
                "gcs_markdown_paths",
                "gcs_image_meta",
            ],
            step_name="step3_register_to_filespace",
        )
        bucket_name: Optional[str] = context.get("gcs_bucket_name")
        gcs_prefix: Optional[str] = context.get("gcs_prefix")
        markdown_paths: List[Dict[str, Any]] = (
            context.get("gcs_markdown_paths") or []
        )
        image_meta: List[Dict[str, Any]] = context.get("gcs_image_meta") or []

        if not bucket_name or not gcs_prefix:
            raise FatalStepError(
                step_name="step3_register_to_filespace",
                message="GCS bucket/prefix missing in context (step2 did not run?)",
                error_code="GCS_PREFIX_MISSING",
            )

        input_data = context.input_data
        file_space_id = getattr(input_data, "file_space_id", None) or getattr(
            input_data, "fileSpaceId", None
        )
        if not file_space_id:
            raise FatalStepError(
                step_name="step3_register_to_filespace",
                message="fileSpaceId missing in input",
                error_code="FILE_SPACE_ID_MISSING",
            )

        operation_metadata = context.operation_metadata
        org_id = _meta_get(operation_metadata, "organizationId", "organization_id")
        space_id = _meta_get(operation_metadata, "spaceId", "space_id")
        if not org_id or not space_id:
            raise FatalStepError(
                step_name="step3_register_to_filespace",
                message="organizationId/spaceId missing in operation_metadata",
                error_code="META_MISSING",
            )

        documents_path = ParentPathCreator.returnParentOrgSpaceFirestorePath(
            organizationId=org_id,
            spaceId=space_id,
            path=f"fileSpaces/{file_space_id}/documents",
        )
        db = firestore.Client()

        op_meta_dict = (
            operation_metadata.model_dump(by_alias=False)
            if hasattr(operation_metadata, "model_dump")
            else operation_metadata
        )

        # === 1) markdown を並列 upload ============================
        added = 0
        failed = 0
        success_results: List[Tuple[Dict[str, Any], str]] = []
        deadline = time.time() + STEP3_TOTAL_DEADLINE_SEC

        if context.logger and markdown_paths:
            context.logger.info(
                f"📤 Registering {len(markdown_paths)} markdown to Gemini "
                f"(concurrency={UPLOAD_CONCURRENCY}, timeout={PER_UPLOAD_TIMEOUT_SEC}s, "
                f"deadline={STEP3_TOTAL_DEADLINE_SEC}s)",
                emoji="📤",
            )
        with ThreadPoolExecutor(max_workers=UPLOAD_CONCURRENCY) as pool:
            futures = {
                pool.submit(
                    _upload_one_markdown_to_gemini,
                    md,
                    file_space_id,
                    bucket_name,
                    op_meta_dict,
                    context.request_id,
                ): md
                for md in markdown_paths
                if md.get("gcsPath") and md.get("filename")
            }

            try:
                for fut in as_completed(
                    futures, timeout=max(1.0, deadline - time.time())
                ):
                    md, document_name, err = fut.result()
                    if document_name:
                        success_results.append((md, document_name))
                    else:
                        failed += 1
                        if context.logger:
                            context.logger.warn(
                                f"⚠️ Gemini upload failed ({md.get('filename')}): {err}",
                                emoji="⚠️",
                            )
            except TimeoutError:
                pending = sum(1 for f in futures if not f.done())
                failed += pending
                if context.logger:
                    context.logger.warn(
                        f"⏱️ step3 deadline {STEP3_TOTAL_DEADLINE_SEC}s reached: "
                        f"{pending} markdown left un-registered",
                        emoji="⏱️",
                    )

        # === 2) 成功した markdown を Firestore Document に登録 ====
        for md, document_name in success_results:
            md_path = md["gcsPath"]
            md_filename = md["filename"]
            md_url = md.get("url")
            md_title = md.get("title")
            display_name = md_title or md_filename
            doc_id = _firestore_doc_id_markdown(md_path, md_filename)
            # OGP / Thumbnail (Phase R-1e). フロントの page list view で
            # サムネ表示するため doc に保存. og:title は displayName と被ることが
            # 多いので description のリッチ表示用に保持 (上書きはしない).
            doc_data = {
                "agentSearchDocumentId": document_name,
                "name": f"fileSearchStores/{file_space_id}/documents/{document_name}",
                "indexBackend": "agent_search",
                "registration": {
                    "stage": "indexed",
                    "gcsUploaded": True,
                    "geminiRegistered": True,
                },
                "displayName": display_name,
                "description": f"Web 取り込み: {md_url or md_filename}",
                "createTime": _now_iso(),
                "updateTime": _now_iso(),
                "state": "STATE_ACTIVE",
                "subCategory": "urlMarkdown",
                "bucketName": bucket_name,
                "filePath": md_path,
                "mimeType": "text/markdown",
                "status": "connected",
                "storeId": file_space_id,
                "organizationId": org_id,
                "spaceId": space_id,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
                "sourceUrl": md_url,
                "webCrawlRequestId": context.request_id,
                "gcsPrefix": gcs_prefix,
                "ogImage": md.get("ogImage"),
                "ogTitle": md.get("ogTitle"),
                "ogDescription": md.get("ogDescription"),
                "thumbnailGcsPath": md.get("thumbnailGcsPath"),
                "thumbnailBucket": bucket_name if md.get("thumbnailGcsPath") else None,
            }
            try:
                db.collection(documents_path).document(doc_id).set(doc_data)
                added += 1
            except Exception as e:
                if context.logger:
                    context.logger.warn(
                        f"⚠️ Firestore Document write failed ({md_filename}): {e}",
                        emoji="⚠️",
                    )
                failed += 1

        # === 3) 画像 → Agent Search (対応 MIME のみ) ==================
        importable_images: List[Dict[str, Any]] = []
        catalog_only_images: List[Dict[str, Any]] = []
        image_skipped_unknown_mime = 0
        for img in image_meta:
            filename = img.get("filename")
            gcs_path = img.get("gcsPath")
            if not filename or not gcs_path:
                continue
            img_mime = _guess_image_mime(filename)
            if img_mime == "application/octet-stream":
                image_skipped_unknown_mime += 1
                if context.logger:
                    context.logger.warn(
                        f"⏭️ Skip image (unknown mime): {filename}",
                        emoji="⏭️",
                    )
                continue
            if is_agent_search_importable_image_mime(img_mime):
                importable_images.append({**img, "mimeType": img_mime})
            else:
                catalog_only_images.append({**img, "mimeType": img_mime})

        image_indexed = 0
        image_index_failed = 0
        image_success_results: List[Tuple[Dict[str, Any], str]] = []

        if context.logger and importable_images:
            context.logger.info(
                f"📤 Registering {len(importable_images)} images to Agent Search "
                f"(catalog-only: {len(catalog_only_images)})",
                emoji="📤",
            )

        def _upload_one_image_to_agent_search(
            img: Dict[str, Any],
        ) -> Tuple[Dict[str, Any], Optional[str], Optional[str]]:
            gcs_path = img.get("gcsPath") or ""
            doc_id = _firestore_doc_id_image(gcs_path)
            struct = _build_agent_search_struct_data(
                firestore_doc_id=doc_id,
                gcs_path=gcs_path,
                bucket_name=bucket_name,
                web_crawl_request_id=context.request_id,
                page_filename=img.get("filename"),
                source_page_url=img.get("pageUrl") or img.get("sourceUrl"),
                sub_category="fileUpload",
            )
            return _upload_one_gcs_file_to_context_store(
                img,
                file_space_id,
                bucket_name,
                op_meta_dict,
                context.request_id,
                upload_key="img",
                firestore_doc_id=doc_id,
                struct_data=struct,
            )

        with ThreadPoolExecutor(max_workers=UPLOAD_CONCURRENCY) as pool:
            img_futures = {
                pool.submit(_upload_one_image_to_agent_search, img): img
                for img in importable_images
            }
            try:
                for fut in as_completed(
                    img_futures, timeout=max(1.0, deadline - time.time())
                ):
                    img, agent_doc_id, err = fut.result()
                    if agent_doc_id:
                        image_success_results.append((img, agent_doc_id))
                    else:
                        image_index_failed += 1
                        if context.logger:
                            context.logger.warn(
                                f"⚠️ image import failed ({img.get('filename')}): {err}",
                                emoji="⚠️",
                            )
            except TimeoutError:
                pending = sum(1 for f in img_futures if not f.done())
                image_index_failed += pending
                if context.logger:
                    context.logger.warn(
                        f"⏱️ step3 image deadline: {pending} imports left unfinished",
                        emoji="⏱️",
                    )

        def _write_image_document(
            img: Dict[str, Any],
            *,
            agent_doc_id: Optional[str],
            indexed: bool,
            last_error: Optional[str] = None,
        ) -> None:
            filename = img.get("filename")
            gcs_path = img.get("gcsPath")
            if not filename or not gcs_path:
                return
            img_mime = img.get("mimeType") or _guess_image_mime(filename)
            firestore_doc_id = _firestore_doc_id_image(gcs_path)
            page_url = img.get("pageUrl")
            page_title = img.get("pageTitle")
            description_parts = [f"Web 取り込み画像 (p.{img.get('page', '?')})"]
            if page_title:
                description_parts.append(f"元ページ: {page_title}")
            elif page_url:
                description_parts.append(f"元ページ: {page_url}")

            doc_data: Dict[str, Any] = {
                "displayName": filename,
                "description": " — ".join(description_parts),
                "createTime": _now_iso(),
                "updateTime": _now_iso(),
                "state": "STATE_ACTIVE",
                "subCategory": "fileUpload",
                "bucketName": bucket_name,
                "filePath": gcs_path,
                "mimeType": img_mime,
                "status": "connected",
                "storeId": file_space_id,
                "organizationId": org_id,
                "spaceId": space_id,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
                "sourceUrl": img.get("sourceUrl"),
                "sourcePageUrl": page_url,
                "sourcePageTitle": page_title,
                "contentHash": img.get("contentHash"),
                "webCrawlRequestId": context.request_id,
                "gcsPrefix": gcs_prefix,
            }
            if indexed and agent_doc_id:
                doc_data["name"] = (
                    f"fileSearchStores/{file_space_id}/documents/{agent_doc_id}"
                )
                doc_data["agentSearchDocumentId"] = agent_doc_id
                doc_data["indexBackend"] = "agent_search"
                doc_data["registration"] = {
                    "stage": "indexed",
                    "gcsUploaded": True,
                    "geminiRegistered": True,
                }
            else:
                doc_data["name"] = (
                    f"fileSearchStores/{file_space_id}/documents/{firestore_doc_id}"
                )
                doc_data["registration"] = {
                    "stage": "failed" if last_error else "placeholder",
                    "gcsUploaded": True,
                    "geminiRegistered": False,
                    "lastError": last_error,
                }

            db.collection(documents_path).document(firestore_doc_id).set(doc_data)

        for img, agent_doc_id in image_success_results:
            try:
                _write_image_document(img, agent_doc_id=agent_doc_id, indexed=True)
                image_indexed += 1
            except Exception as img_err:
                image_index_failed += 1
                if context.logger:
                    context.logger.warn(
                        f"⚠️ image Firestore write failed ({img.get('filename')}): {img_err}",
                        emoji="⚠️",
                    )

        for img in catalog_only_images:
            try:
                _write_image_document(
                    img,
                    agent_doc_id=None,
                    indexed=False,
                    last_error="unsupported_image_mime_for_agent_search",
                )
            except Exception as img_err:
                if context.logger:
                    context.logger.warn(
                        f"⚠️ catalog-only image doc failed ({img.get('filename')}): {img_err}",
                        emoji="⚠️",
                    )

        context.set("filespace_registered_count", added)
        context.set("filespace_register_failed", failed)
        context.set("filespace_image_doc_count", image_indexed)
        context.set("filespace_image_index_failed", image_index_failed)

        markdown_source_count = len(markdown_paths)
        if context.logger:
            context.logger.info(
                f"✅ FileSpace registration complete: "
                f"{added}/{markdown_source_count} markdown Firestore docs, "
                f"{failed} markdown import failures, "
                f"{image_indexed} images indexed, {image_index_failed} image import failed, "
                f"{len(catalog_only_images)} catalog-only images, "
                f"{image_skipped_unknown_mime} unknown mime skipped",
                emoji="✅",
            )
            if markdown_source_count > 0 and added == 0:
                context.logger.warn(
                    "⚠️ step3: markdown files were crawled but none were written to "
                    "Firestore — check Agent Search import errors / deadline. "
                    "UI will show all manifest pages as unregistered until markdown docs exist.",
                    emoji="⚠️",
                )

    except FatalStepError:
        raise
    except Exception as e:
        error_msg = f"Unexpected error in step3_register_to_filespace: {e}"
        if context.logger:
            context.logger.error(f"❌ {error_msg}", emoji="❌", exc_info=True)
        raise FatalStepError(
            step_name="step3_register_to_filespace",
            message=error_msg,
            error_code="FILESPACE_REGISTER_ERROR",
        )
