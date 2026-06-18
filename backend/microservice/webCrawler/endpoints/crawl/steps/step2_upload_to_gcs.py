"""
Step 2: Upload Crawl Result to Google Cloud Storage (Phase R-1c)

step1 で取得した markdown + 画像 URL 一覧を、GCS (Firebase default bucket) の
prefix 配下に整理して書き出す。GCS が SSOT、Drive ではない (Phase R-1c)。

GCS prefix (SSOT, aligned with driveSync / manual_upload):
    {bucket}/organizations/{orgId}/spaces/{spaceId}/fileSpaces/{fileSpaceId}/knowledges/webCrawl/{YYYY-MM-DD}_{hostname}_{shortHash}/
        manifest.json
        page-001.md, page-002.md, ...
        images/page-001-001.jpg, page-002-005.png, ...

画像取得は best-effort: HEAD 失敗・5MB 超・タイムアウトは skip。skipped 件数は
manifest.json + RequestDoc.output に記録。

Drive クォータ問題から解放され、GCS は実質無制限。
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import httpx

from common import ExecutionContext, FatalStepError
from knowledge_storage_paths import web_crawl_session_prefix
from common.gcs_storage import upload_bytes_to_gcs, upload_string_to_gcs
from endpoints.crawl.workflow_step_state import persist_context_keys, restore_context_keys

# --- 定数 -------------------------------------------------------------------
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB
IMAGE_FETCH_TIMEOUT = 15.0  # seconds
IMAGE_CONCURRENCY = 8
# 安全な GCS prefix 名にするための regex (Drive 用と同等、念のため流用)
_INVALID_NAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
# WordPress 等の CMS が生成するサムネ variant suffix を検出する regex.
# 例: `foo-768x668.png` の `-768x668`, `foo-150x150.jpg?v=1` の `-150x150`
_THUMBNAIL_SUFFIX_RE = re.compile(r"-(\d+)x(\d+)(?=\.[A-Za-z0-9]{2,5}(?:\?|$))")


def _canonical_image_url(url: str) -> str:
    """サムネ variant をグルーピングするための正規化キー.

    WP は 1 枚の画像から 7-8 個の解像度別 variant (`-WxH` suffix) を生成する.
    URL も bytes も別物なので sha256 dedup では拾えない. ここで suffix と
    query string を除去した base URL を「同一画像のキー」として使い、
    グループあたり 1 回しか fetch しないようにする.
    """
    if not url:
        return url
    base = _THUMBNAIL_SUFFIX_RE.sub("", url)
    return base.split("?", 1)[0]


def _variant_pixel_area(url: str) -> int:
    """variant URL から `WxH` を読み取りピクセル数を返す.
    suffix なし (= 原寸) は最大値とみなして必ず優先される.
    """
    m = _THUMBNAIL_SUFFIX_RE.search(url)
    if m:
        return int(m.group(1)) * int(m.group(2))
    return 10**12


def _safe_path_segment(name: str, max_len: int = 80) -> str:
    """GCS prefix の 1 セグメントとして安全な文字列に整形"""
    cleaned = _INVALID_NAME_CHARS.sub("_", name).strip()
    cleaned = re.sub(r"\s+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned)
    if not cleaned:
        cleaned = "untitled"
    return cleaned[:max_len]


def _guess_extension(content_type: Optional[str], url: str) -> str:
    """Content-Type or URL から拡張子を推定 (default: .bin)"""
    ct = (content_type or "").split(";")[0].strip().lower()
    by_ct = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "image/bmp": ".bmp",
        "image/avif": ".avif",
    }
    if ct in by_ct:
        return by_ct[ct]
    parsed = urlparse(url)
    base = os.path.basename(parsed.path)
    if "." in base:
        ext = "." + base.rsplit(".", 1)[1].lower().split("?")[0]
        if len(ext) <= 6:
            return ext
    return ".bin"


async def _fetch_image(
    client: httpx.AsyncClient, page_url: str, src: str
) -> Optional[Dict[str, Any]]:
    """1 枚の画像を取得。失敗時は None (skip 扱い)"""
    abs_url = (
        urljoin(page_url, src)
        if not src.startswith(("http://", "https://", "data:"))
        else src
    )
    if abs_url.startswith("data:"):
        return None
    try:
        resp = await client.get(abs_url)
        if resp.status_code >= 400:
            return None
        if int(resp.headers.get("content-length", 0) or 0) > MAX_IMAGE_BYTES:
            return None
        content = resp.content
        if len(content) > MAX_IMAGE_BYTES:
            return None
        return {
            "url": abs_url,
            "bytes": content,
            "content_type": resp.headers.get("content-type", ""),
        }
    except (httpx.HTTPError, httpx.TimeoutException):
        return None
    except Exception:
        return None


async def _fetch_all_images(
    pages: List[Dict[str, Any]], context: ExecutionContext
) -> Dict[int, List[Dict[str, Any]]]:
    """ページごとの画像群を並列ダウンロード。{page_idx: [{url, bytes, content_type}, ...]}

    canonical URL でグローバル dedup してから fetch する.
    同一画像のサムネ variant 7-8 枚を 1 回だけ fetch し、取得 bytes を全 occurrence
    に配布する. variant URL は各 entry に残るため markdown 書き換えは全 variant 分動く
    (= upload phase の sha256 dedup が同一 bytes を 1 ファイルにまとめる).
    """
    sem = asyncio.Semaphore(IMAGE_CONCURRENCY)
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; EN-AIStudio-Crawler/1.0; +https://en-aistudio.dev)",
    }
    timeout = httpx.Timeout(IMAGE_FETCH_TIMEOUT, connect=5.0)

    result: Dict[int, List[Dict[str, Any]]] = {idx: [] for idx in range(len(pages))}

    # canonical URL -> [(page_idx, absolute variant URL, alt), ...]
    canonical_groups: Dict[str, List[tuple]] = {}
    total_variant_count = 0
    for idx, page in enumerate(pages):
        page_url = page.get("url", "")
        for img in page.get("images", []) or []:
            src = img.get("src", "")
            if not src or src.startswith("data:"):
                continue
            abs_url = (
                urljoin(page_url, src)
                if not src.startswith(("http://", "https://"))
                else src
            )
            canonical = _canonical_image_url(abs_url)
            canonical_groups.setdefault(canonical, []).append(
                (idx, abs_url, img.get("alt", ""))
            )
            total_variant_count += 1

    collapsed = total_variant_count - len(canonical_groups)
    if context.logger and total_variant_count:
        context.logger.info(
            f"🖼️ Image fetch plan: {total_variant_count} variants → "
            f"{len(canonical_groups)} unique (collapsed {collapsed})",
            emoji="🖼️",
        )

    async with httpx.AsyncClient(
        timeout=timeout, headers=headers, follow_redirects=True
    ) as client:

        async def _fetch_group(canonical_url: str, occurrences: List[tuple]):
            """グループ内で最大解像度の variant を 1 回 fetch して全 occurrence に配布"""
            async with sem:
                # 最大解像度 (suffix なし=原寸が最優先) から順に試す
                ordered = sorted(
                    occurrences, key=lambda o: _variant_pixel_area(o[1]), reverse=True
                )
                fetched = None
                tried: set = set()
                for _idx, variant_url, _alt in ordered:
                    if variant_url in tried:
                        continue
                    tried.add(variant_url)
                    fetched = await _fetch_image(client, "", variant_url)
                    if fetched:
                        break
                if not fetched:
                    return
                shared_bytes = fetched["bytes"]
                shared_ct = fetched["content_type"]
                # 全 occurrence に同一 bytes を配布. url は variant URL を残し、
                # markdown 内の各 variant 参照が後段で local file に書き換わるようにする.
                for page_idx, variant_url, alt in occurrences:
                    result[page_idx].append(
                        {
                            "url": variant_url,
                            "bytes": shared_bytes,
                            "content_type": shared_ct,
                            "alt": alt,
                        }
                    )

        tasks = [
            _fetch_group(canonical, occ)
            for canonical, occ in canonical_groups.items()
        ]

        if context.logger and tasks:
            context.logger.info(
                f"🖼️ Fetching {len(tasks)} unique images across {len(pages)} pages...",
                emoji="🖼️",
            )

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    return result


def _build_subfolder_name(entry_url: str) -> str:
    """`{YYYY-MM-DD}_{hostname}_{shortHash}` 形式の GCS prefix セグメント"""
    hostname = urlparse(entry_url).hostname or "unknown"
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    short_hash = hashlib.md5(
        f"{entry_url}_{int(time.time())}".encode("utf-8")
    ).hexdigest()[:6]
    return _safe_path_segment(f"{date}_{hostname}_{short_hash}")


def _build_manifest(
    entry_url: str,
    pages: List[Dict[str, Any]],
    image_meta: List[Dict[str, Any]],
    skipped_count: int,
    gcs_prefix: str,
) -> str:
    manifest = {
        "entryUrl": entry_url,
        "crawledAt": datetime.now(timezone.utc).isoformat(),
        "gcsPrefix": gcs_prefix,
        "pageCount": len(pages),
        "imageCount": len(image_meta),
        "skippedImageCount": skipped_count,
        "pages": [
            {
                "index": i,
                "url": p.get("url"),
                "title": (p.get("metadata") or {}).get("title"),
                "markdownFilename": f"page-{i+1:03d}.md",
            }
            for i, p in enumerate(pages)
        ],
        "images": image_meta,
    }
    return json.dumps(manifest, ensure_ascii=False, indent=2)


def _resolve_bucket_name() -> str:
    """Firebase default bucket と同じ命名規則。env の override も許容"""
    explicit = os.getenv("EN_AISTUDIO_GCS_BUCKET")
    if explicit:
        return explicit
    project = os.getenv("GOOGLE_CLOUD_PROJECT", "en-aistudio-development")
    return f"{project}.firebasestorage.app"


def _maybe_set_thumbnail(
    page_thumbnails: Dict[int, str],
    page_idx: int,
    src_url: Optional[str],
    gcs_path: str,
    page: Dict[str, Any],
) -> None:
    """ページのサムネ画像を 1 件選ぶ.

    og:image (step1 で page dict に保存済) と src_url が一致したら強制上書き.
    一致しない場合は「ページで初めて処理に成功した画像」を fallback として採用.
    既に og:image が確定済ならそれを優先 (fallback で上書きしない).
    """
    og_url = page.get("ogImage")
    if og_url and src_url == og_url:
        page_thumbnails[page_idx] = gcs_path
    elif page_idx not in page_thumbnails:
        page_thumbnails[page_idx] = gcs_path


def _meta_get(meta: Any, key: str, snake_alt: Optional[str] = None) -> Optional[str]:
    if meta is None:
        return None
    if hasattr(meta, key):
        v = getattr(meta, key)
        if v:
            return str(v)
    if snake_alt and hasattr(meta, snake_alt):
        v = getattr(meta, snake_alt)
        if v:
            return str(v)
    if isinstance(meta, dict):
        return meta.get(key) or (meta.get(snake_alt) if snake_alt else None)
    return None


def _resolve_org_id(context: ExecutionContext) -> Optional[str]:
    """operation_metadata から organizationId を取り出す (camelCase / snake_case 両対応)"""
    return _meta_get(context.operation_metadata, "organizationId", "organization_id")


def _resolve_space_id(context: ExecutionContext) -> Optional[str]:
    return _meta_get(context.operation_metadata, "spaceId", "space_id")


def _resolve_file_space_id(context: ExecutionContext) -> Optional[str]:
    input_data = context.input_data
    if input_data is None:
        return None
    for attr in ("file_space_id", "fileSpaceId"):
        if hasattr(input_data, attr):
            v = getattr(input_data, attr)
            if v:
                return str(v)
    if isinstance(input_data, dict):
        v = input_data.get("file_space_id") or input_data.get("fileSpaceId")
        return str(v) if v else None
    return None


def execute(context: ExecutionContext) -> None:
    """GCS に prefix を作って markdown + 画像 + manifest を upload"""
    try:
        restore_context_keys(
            context,
            ["crawled_pages", "entry_url"],
            step_name="step2_upload_to_gcs",
        )
        pages: List[Dict[str, Any]] = context.get("crawled_pages") or []
        entry_url: str = context.get("entry_url") or ""
        input_data = context.input_data

        if not pages:
            raise FatalStepError(
                step_name="step2_upload_to_gcs",
                message="no crawled pages available in context",
                error_code="NO_CRAWLED_PAGES",
            )

        org_id = _resolve_org_id(context)
        space_id = _resolve_space_id(context)
        file_space_id = _resolve_file_space_id(context)
        if not org_id:
            raise FatalStepError(
                step_name="step2_upload_to_gcs",
                message="organizationId not found in operation_metadata",
                error_code="ORG_ID_MISSING",
            )
        if not space_id:
            raise FatalStepError(
                step_name="step2_upload_to_gcs",
                message="spaceId not found in operation_metadata",
                error_code="SPACE_ID_MISSING",
            )
        if not file_space_id:
            raise FatalStepError(
                step_name="step2_upload_to_gcs",
                message="fileSpaceId missing in input",
                error_code="FILE_SPACE_ID_MISSING",
            )

        include_images = getattr(input_data, "include_images", True)
        if include_images is None:
            include_images = True

        bucket_name = _resolve_bucket_name()
        sub_name = _build_subfolder_name(entry_url)
        gcs_prefix = web_crawl_session_prefix(
            organization_id=org_id,
            space_id=space_id,
            file_space_id=file_space_id,
            session_folder=sub_name,
        )

        if context.logger:
            context.logger.info(
                f"📁 GCS target prefix: gs://{bucket_name}/{gcs_prefix}/",
                emoji="📁",
            )

        # ① 画像取得 (best-effort, parallel)
        images_by_page: Dict[int, List[Dict[str, Any]]] = {}
        skipped_count = 0
        if include_images:
            total_planned = sum(len(p.get("images") or []) for p in pages)
            try:
                images_by_page = asyncio.run(_fetch_all_images(pages, context))
            except RuntimeError:
                # 既に loop が動いている場合は nest_asyncio に fallback
                import nest_asyncio  # type: ignore

                nest_asyncio.apply()
                loop = asyncio.get_event_loop()
                images_by_page = loop.run_until_complete(
                    _fetch_all_images(pages, context)
                )
            fetched_count = sum(len(v) for v in images_by_page.values())
            skipped_count = max(0, total_planned - fetched_count)
            if context.logger:
                context.logger.info(
                    f"🖼️ Images fetched: {fetched_count} / planned {total_planned} (skipped {skipped_count})",
                    emoji="🖼️",
                )

        # ② 画像 upload + 各ページ markdown の image 相対参照書き換え
        #
        # dedup は 2 層構造で本当にユニークな画像だけを GCS に置く:
        #
        #   (a) sourceUrl 完全一致 → 同 URL を再度 fetch しても無意味なので skip
        #   (b) content sha256 一致 → CDN の query 文字列違い / サムネと原寸など
        #       「URL は違うが中身は同一バイト列」のケースも 1 枚にまとめる
        #
        # 代表メタには「初出ページの情報」(page / pageUrl / pageTitle) を残し、
        # 後から「この画像はどのページに載っていたか」を辿れるようにする.
        image_meta: List[Dict[str, Any]] = []
        rewritten_markdowns: List[str] = []
        # sourceUrl → 既に upload 済みの (filename, gcs_path) を覚えておくキャッシュ
        uploaded_by_url: Dict[str, Dict[str, str]] = {}
        # content hash (sha256) → 同じ画像実体に紐づく (filename, gcs_path)
        uploaded_by_hash: Dict[str, Dict[str, str]] = {}
        dedup_by_url = 0
        dedup_by_hash = 0
        # ページごとのサムネ用 gcsPath (og:image 優先, fallback は最初の画像).
        # markdown_paths に埋め込んで step3 が Firestore Document に保存する.
        page_thumbnails: Dict[int, str] = {}

        for page_idx, page in enumerate(pages):
            page_imgs = images_by_page.get(page_idx, [])
            page_url = page.get("url")
            page_title = (page.get("metadata") or {}).get("title")
            markdown_body: str = page.get("markdown") or ""

            for img_idx, img in enumerate(page_imgs):
                src_url = img.get("url")

                # ── (a) URL 完全一致 dedup ───────────────────────────
                if src_url and src_url in uploaded_by_url:
                    existing = uploaded_by_url[src_url]
                    if src_url in markdown_body:
                        markdown_body = markdown_body.replace(
                            src_url, f"images/{existing['filename']}"
                        )
                    _maybe_set_thumbnail(
                        page_thumbnails, page_idx, src_url, existing["gcsPath"], page
                    )
                    dedup_by_url += 1
                    continue

                # ── (b) content sha256 dedup ────────────────────────
                # URL は違っても bytes が同じなら upload しない. 既存 file に
                # markdown 内の参照だけを向け直す + 別 sourceUrl からも引けるよう
                # uploaded_by_url にエイリアスとして登録する.
                content_bytes = img.get("bytes") or b""
                content_hash = hashlib.sha256(content_bytes).hexdigest() if content_bytes else None
                if content_hash and content_hash in uploaded_by_hash:
                    existing = uploaded_by_hash[content_hash]
                    if src_url and src_url in markdown_body:
                        markdown_body = markdown_body.replace(
                            src_url, f"images/{existing['filename']}"
                        )
                    if src_url:
                        uploaded_by_url[src_url] = existing
                    _maybe_set_thumbnail(
                        page_thumbnails, page_idx, src_url, existing["gcsPath"], page
                    )
                    dedup_by_hash += 1
                    continue
                # ─────────────────────────────────────────────────────

                ext = _guess_extension(img.get("content_type"), src_url or "")
                filename = f"page-{page_idx+1:03d}-{img_idx+1:03d}{ext}"
                gcs_path = f"{gcs_prefix}/images/{filename}"
                try:
                    upload_bytes_to_gcs(
                        data=content_bytes,
                        bucket_name=bucket_name,
                        gcs_path=gcs_path,
                        content_type=img.get(
                            "content_type", "application/octet-stream"
                        ),
                    )
                    image_meta.append(
                        {
                            "filename": filename,
                            "sourceUrl": src_url,
                            "alt": img.get("alt", ""),
                            "page": page_idx + 1,
                            "gcsPath": gcs_path,
                            "contentHash": content_hash,
                            # 初出ページの情報を「この画像はどこから来たか」として保存。
                            # マスタ自動生成で「この商品画像はどの商品ページにあったか」
                            # を辿れるようにする (Phase R-1d / 2026-05-20).
                            "pageUrl": page_url,
                            "pageTitle": page_title,
                        }
                    )
                    record = {"filename": filename, "gcsPath": gcs_path}
                    if src_url:
                        uploaded_by_url[src_url] = record
                    if content_hash:
                        uploaded_by_hash[content_hash] = record
                    _maybe_set_thumbnail(
                        page_thumbnails, page_idx, src_url, gcs_path, page
                    )
                    # markdown の img 参照を相対パスに書き換え
                    if src_url and src_url in markdown_body:
                        markdown_body = markdown_body.replace(
                            src_url, f"images/{filename}"
                        )
                except Exception as img_err:
                    if context.logger:
                        context.logger.warn(
                            f"⚠️ Image upload failed ({filename}): {img_err}",
                            emoji="⚠️",
                        )
                    skipped_count += 1

            rewritten_markdowns.append(markdown_body)

        # OGP 抽出効果のサマリ (Phase R-1e)
        ogp_image_count = sum(1 for p in pages if p.get("ogImage"))
        thumbnail_pages = len(page_thumbnails)
        if context.logger and pages:
            context.logger.info(
                f"📷 Thumbnails: {thumbnail_pages}/{len(pages)} pages have a thumbnail "
                f"(ogImage detected: {ogp_image_count})",
                emoji="📷",
            )

        dedup_total = dedup_by_url + dedup_by_hash
        if dedup_total > 0:
            if context.logger:
                context.logger.info(
                    f"🧹 Deduped {dedup_total} duplicate images "
                    f"(url={dedup_by_url}, hash={dedup_by_hash}, unique={len(image_meta)})",
                    emoji="🧹",
                )

        # ③ markdown を 1 つずつ upload
        markdown_paths: List[Dict[str, Any]] = []
        for page_idx, body in enumerate(rewritten_markdowns):
            md_filename = f"page-{page_idx+1:03d}.md"
            md_path = f"{gcs_prefix}/{md_filename}"
            upload_string_to_gcs(
                content=body,
                bucket_name=bucket_name,
                gcs_path=md_path,
                content_type="text/markdown",
            )
            page_meta = pages[page_idx]
            markdown_paths.append(
                {
                    "filename": md_filename,
                    "gcsPath": md_path,
                    "url": page_meta.get("url"),
                    "title": (page_meta.get("metadata") or {}).get("title"),
                    # OGP / Twitter Card メタ (step1 抽出済). Firestore Document に
                    # 保存して UI 側でサムネ表示・本文要約に使う.
                    "ogImage": page_meta.get("ogImage"),
                    "ogTitle": page_meta.get("ogTitle"),
                    "ogDescription": page_meta.get("ogDescription"),
                    # ページのサムネ画像の GCS パス. og:image があればそれ、
                    # 無ければページで最初に upload された画像 (or dedup 結果).
                    # フロントの page list view で thumbnail として使う.
                    "thumbnailGcsPath": page_thumbnails.get(page_idx),
                }
            )

        # ④ manifest.json
        manifest = _build_manifest(
            entry_url, pages, image_meta, skipped_count, gcs_prefix
        )
        manifest_path = f"{gcs_prefix}/manifest.json"
        upload_string_to_gcs(
            content=manifest,
            bucket_name=bucket_name,
            gcs_path=manifest_path,
            content_type="application/json",
        )

        # ⑤ context に保存 (step3 / response で使う)
        context.set("gcs_bucket_name", bucket_name)
        context.set("gcs_prefix", gcs_prefix)
        context.set("gcs_markdown_paths", markdown_paths)
        context.set("gcs_image_count", len(image_meta))
        context.set("gcs_skipped_image_count", skipped_count)
        context.set("gcs_markdown_count", len(rewritten_markdowns))
        context.set("gcs_image_meta", image_meta)
        context.set("gcs_manifest_path", manifest_path)

        persist_context_keys(
            context,
            [
                "gcs_bucket_name",
                "gcs_prefix",
                "gcs_markdown_paths",
                "gcs_image_count",
                "gcs_skipped_image_count",
                "gcs_markdown_count",
                "gcs_image_meta",
                "gcs_manifest_path",
            ],
        )

        if context.logger:
            context.logger.info(
                f"✅ GCS upload complete: {len(rewritten_markdowns)} md + "
                f"{len(image_meta)} img → gs://{bucket_name}/{gcs_prefix}/",
                emoji="✅",
            )

    except FatalStepError:
        raise
    except Exception as e:
        error_msg = f"Unexpected error in step2_upload_to_gcs: {e}"
        if context.logger:
            context.logger.error(f"❌ {error_msg}", emoji="❌", exc_info=True)
        raise FatalStepError(
            step_name="step2_upload_to_gcs",
            message=error_msg,
            error_code="GCS_UPLOAD_ERROR",
        )
