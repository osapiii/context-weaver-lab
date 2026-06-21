"""Tools for scanning an application into sitemap and screenshot artifacts."""
from __future__ import annotations

import json
import re
from collections import deque
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urldefrag, urljoin, urlparse

from common.adk_artifact_io import (  # type: ignore
    build_custom_metadata,
    safe_artifact_filename,
    save_bytes_artifact,
    save_text_artifact,
)
from common.tool_state import get_writable_state, read_tool_state  # type: ignore


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _as_str(value: Any, default: str = "") -> str:
    return value.strip() if isinstance(value, str) and value.strip() else default


def _as_bool(value: Any, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return default


def _as_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _as_str_list(value: Any, *, limit: int = 20) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value[:limit]:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def _application_scan_bucket(tool_context: Any) -> dict[str, Any]:
    state = read_tool_state(tool_context)
    return _as_dict(state.get("application_scan"))


def _setup_from_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    return _as_dict(bucket.get("setup"))


def _patch_scan_state(tool_context: Any, patch: dict[str, Any]) -> None:
    writable = get_writable_state(tool_context)
    if writable is None or not hasattr(writable, "__setitem__"):
        return
    current = _application_scan_bucket(tool_context)
    merged = {**current, **patch}
    writable["application_scan"] = merged


def _normalize_url(raw_url: str, *, base_url: str | None = None) -> str | None:
    candidate = urljoin(base_url or "", raw_url.strip())
    candidate, _fragment = urldefrag(candidate)
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    path = parsed.path or "/"
    normalized = parsed._replace(path=path, query="", fragment="").geturl()
    return normalized.rstrip("/") if path != "/" else normalized


def _same_origin(url: str, origin: str) -> bool:
    parsed = urlparse(url)
    base = urlparse(origin)
    return parsed.scheme == base.scheme and parsed.netloc == base.netloc


def _matches_any(url: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        try:
            if re.search(pattern, url):
                return True
        except re.error:
            if pattern in url:
                return True
    return False


def _allowed_url(
    url: str,
    *,
    origin: str,
    include_patterns: list[str],
    exclude_patterns: list[str],
) -> bool:
    if not _same_origin(url, origin):
        return False
    if include_patterns and not _matches_any(url, include_patterns):
        return False
    if exclude_patterns and _matches_any(url, exclude_patterns):
        return False
    return True


def _metadata(
    *,
    kind: str,
    title: str,
    phase: str,
    file_space_id: str,
    agent_search_import: bool,
    **extra: Any,
) -> dict[str, Any]:
    meta = build_custom_metadata(kind=kind, title=title, phase=phase, **extra)
    if file_space_id:
        meta["fileSpaceId"] = file_space_id
        meta["agentSearchImport"] = "true" if agent_search_import else "false"
    return meta


def read_application_scan_setup(tool_context: Any = None) -> dict[str, Any]:
    """Read the system-provided application scan setup from session state."""
    bucket = _application_scan_bucket(tool_context)
    setup = _setup_from_bucket(bucket)
    start_url = _as_str(setup.get("start_url"))
    missing = [] if start_url else ["start_url"]
    return {
        "ok": len(missing) == 0,
        "missing": missing,
        "phase": bucket.get("phase") or "setup",
        "start_url": start_url,
        "login_url": _as_str(setup.get("login_url")) or None,
        "has_username": bool(_as_str(setup.get("username"))),
        "has_password": bool(_as_str(setup.get("password"))),
        "max_pages": _as_int(setup.get("max_pages"), 12, 1, 50),
        "capture_screenshots": _as_bool(setup.get("capture_screenshots"), True),
        "include_patterns": _as_str_list(setup.get("include_patterns")),
        "exclude_patterns": _as_str_list(setup.get("exclude_patterns")),
        "file_space_id": _as_str(setup.get("file_space_id")) or None,
    }


async def _maybe_login(page: Any, setup: dict[str, Any], start_url: str) -> dict[str, Any]:
    login_url = _as_str(setup.get("login_url")) or start_url
    username = _as_str(setup.get("username"))
    password = _as_str(setup.get("password"))
    if not username or not password:
        return {"attempted": False, "ok": None}

    await page.goto(login_url, wait_until="domcontentloaded", timeout=45000)
    user_selector = _as_str(setup.get("username_selector"))
    pass_selector = _as_str(setup.get("password_selector"))
    submit_selector = _as_str(setup.get("submit_selector"))
    user_candidates = [
        user_selector,
        'input[type="email"]',
        'input[name*="email" i]',
        'input[name*="user" i]',
        'input[autocomplete="username"]',
    ]
    pass_candidates = [
        pass_selector,
        'input[type="password"]',
        'input[autocomplete="current-password"]',
    ]
    submit_candidates = [
        submit_selector,
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("ログイン")',
        'button:has-text("Sign in")',
        'button:has-text("Login")',
    ]

    filled_user = False
    for selector in [s for s in user_candidates if s]:
        locator = page.locator(selector).first
        if await locator.count():
            await locator.fill(username)
            filled_user = True
            break
    filled_pass = False
    for selector in [s for s in pass_candidates if s]:
        locator = page.locator(selector).first
        if await locator.count():
            await locator.fill(password)
            filled_pass = True
            break
    if not (filled_user and filled_pass):
        return {"attempted": True, "ok": False, "reason": "login_fields_not_found"}

    clicked = False
    for selector in [s for s in submit_candidates if s]:
        locator = page.locator(selector).first
        if await locator.count():
            await locator.click()
            clicked = True
            break
    if not clicked:
        await page.keyboard.press("Enter")
    try:
        await page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:
        await page.wait_for_load_state("domcontentloaded", timeout=10000)
    return {"attempted": True, "ok": True}


async def _extract_page(page: Any, url: str) -> dict[str, Any]:
    title = await page.title()
    links = await page.eval_on_selector_all(
        "a[href]",
        "els => els.map(a => a.href).filter(Boolean)",
    )
    text = await page.locator("body").inner_text(timeout=5000)
    return {
        "url": url,
        "title": title.strip() if isinstance(title, str) else "",
        "links": links if isinstance(links, list) else [],
        "text": text[:4000] if isinstance(text, str) else "",
    }


async def run_application_scan(
    max_pages: int | None = None,
    capture_screenshots: bool | None = None,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Scan target app, saving screenshots, sitemap JSON, and summary artifacts."""
    bucket = _application_scan_bucket(tool_context)
    setup = _setup_from_bucket(bucket)
    start_url = _normalize_url(_as_str(setup.get("start_url")))
    if not start_url:
        return {"ok": False, "error": "application_scan.setup.start_url is required"}

    page_limit = _as_int(max_pages, _as_int(setup.get("max_pages"), 12, 1, 50), 1, 50)
    should_capture = (
        bool(capture_screenshots)
        if capture_screenshots is not None
        else _as_bool(setup.get("capture_screenshots"), True)
    )
    include_patterns = _as_str_list(setup.get("include_patterns"))
    exclude_patterns = _as_str_list(setup.get("exclude_patterns"))
    file_space_id = _as_str(setup.get("file_space_id"))
    scan_id = f"application-scan-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    _patch_scan_state(
        tool_context,
        {
            "phase": "running",
            "progress": {
                "scan_id": scan_id,
                "processed_pages": 0,
                "total_pages": page_limit,
                "current_url": start_url,
                "started_at": _now_iso(),
            },
        },
    )

    try:
        from playwright.async_api import async_playwright
    except Exception as exc:
        return {
            "ok": False,
            "error": "Playwright is required for application_scan screenshots",
            "detail": str(exc)[:300],
        }

    pages: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    screenshot_refs: list[dict[str, Any]] = []
    visited: set[str] = set()
    queue: deque[str] = deque([start_url])

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 1100},
            ignore_https_errors=True,
        )
        page = await context.new_page()
        login_result = await _maybe_login(page, setup, start_url)

        while queue and len(pages) < page_limit:
            url = queue.popleft()
            if url in visited:
                continue
            visited.add(url)
            _patch_scan_state(
                tool_context,
                {
                    "phase": "running",
                    "progress": {
                        "scan_id": scan_id,
                        "processed_pages": len(pages),
                        "total_pages": page_limit,
                        "current_url": url,
                        "updated_at": _now_iso(),
                    },
                },
            )
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=10000)
                except Exception:
                    pass
                extracted = await _extract_page(page, url)
                page_index = len(pages) + 1
                screenshot_ref = None
                if should_capture:
                    png = await page.screenshot(full_page=True, type="png")
                    filename = safe_artifact_filename(
                        f"application_scan_{page_index:03d}_screenshot", ".png"
                    )
                    screenshot_ref = await save_bytes_artifact(
                        tool_context,
                        filename=filename,
                        data=png,
                        mime_type="image/png",
                        kind="image",
                        title=f"Screenshot {page_index:03d}: {extracted['title'] or url}",
                        custom_metadata=_metadata(
                            kind="image",
                            title=f"Application screenshot {page_index:03d}",
                            phase="screenshot",
                            file_space_id=file_space_id,
                            agent_search_import=True,
                            url=url,
                            scanId=scan_id,
                        ),
                    )
                    if screenshot_ref:
                        screenshot_refs.append({**screenshot_ref, "url": url})
                pages.append(
                    {
                        "url": url,
                        "title": extracted["title"],
                        "textPreview": extracted["text"][:1200],
                        "outboundLinkCount": len(extracted["links"]),
                        "screenshot": screenshot_ref,
                    }
                )
                for raw_link in extracted["links"]:
                    if not isinstance(raw_link, str):
                        continue
                    normalized = _normalize_url(raw_link, base_url=url)
                    if not normalized or normalized in visited or normalized in queue:
                        continue
                    if _allowed_url(
                        normalized,
                        origin=start_url,
                        include_patterns=include_patterns,
                        exclude_patterns=exclude_patterns,
                    ):
                        queue.append(normalized)
            except Exception as exc:
                failures.append({"url": url, "error": str(exc)[:300]})

        await context.close()
        await browser.close()

    sitemap = {
        "schemaVersion": "application-scan-v1",
        "scanId": scan_id,
        "generatedAt": _now_iso(),
        "target": {
            "startUrl": start_url,
            "loginAttempted": bool(login_result.get("attempted")),
            "loginOk": login_result.get("ok"),
            "includePatterns": include_patterns,
            "excludePatterns": exclude_patterns,
        },
        "summary": {
            "pageCount": len(pages),
            "screenshotCount": len(screenshot_refs),
            "failureCount": len(failures),
        },
        "pages": pages,
        "failures": failures,
    }
    sitemap_body = json.dumps(sitemap, ensure_ascii=False, indent=2)
    sitemap_ref = await save_text_artifact(
        tool_context,
        filename=safe_artifact_filename("application_scan_sitemap", ".json"),
        body=sitemap_body,
        mime_type="application/json; charset=utf-8",
        kind="json_document",
        title="Application Scan Sitemap",
        custom_metadata=_metadata(
            kind="json_document",
            title="Application Scan Sitemap",
            phase="sitemap",
            file_space_id=file_space_id,
            agent_search_import=True,
            scanId=scan_id,
        ),
    )
    summary_lines = [
        "# Application Scan Summary",
        "",
        f"- Scan ID: `{scan_id}`",
        f"- Start URL: {start_url}",
        f"- Pages: {len(pages)}",
        f"- Screenshots: {len(screenshot_refs)}",
        f"- Failures: {len(failures)}",
        "",
        "## Sitemap",
        *[f"- {item['title'] or '(no title)'}: {item['url']}" for item in pages],
    ]
    if failures:
        summary_lines.extend(["", "## Failures"])
        summary_lines.extend([f"- {item['url']}: {item['error']}" for item in failures])
    summary_ref = await save_text_artifact(
        tool_context,
        filename=safe_artifact_filename("application_scan_summary", ".md"),
        body="\n".join(summary_lines),
        mime_type="text/markdown; charset=utf-8",
        kind="markdown_document",
        title="Application Scan Summary",
        custom_metadata=_metadata(
            kind="markdown_document",
            title="Application Scan Summary",
            phase="summary",
            file_space_id=file_space_id,
            agent_search_import=True,
            scanId=scan_id,
        ),
    )

    artifact_refs = [ref for ref in [sitemap_ref, summary_ref, *screenshot_refs] if ref]
    _patch_scan_state(
        tool_context,
        {
            "phase": "done",
            "progress": {
                "scan_id": scan_id,
                "processed_pages": len(pages),
                "total_pages": len(pages),
                "completed_at": _now_iso(),
            },
            "artifact": {
                "scan_id": scan_id,
                "sitemap_filename": sitemap_ref.get("filename") if sitemap_ref else None,
                "summary_filename": summary_ref.get("filename") if summary_ref else None,
                "screenshot_count": len(screenshot_refs),
            },
        },
    )
    return {
        "ok": True,
        "application_scan": {
            "scan_id": scan_id,
            "page_count": len(pages),
            "screenshot_count": len(screenshot_refs),
            "failure_count": len(failures),
            "file_space_id": file_space_id or None,
        },
        "artifact_refs": artifact_refs,
    }
