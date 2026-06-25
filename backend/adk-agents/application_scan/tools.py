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

from .computer_use_explorer import explore_screen_variants
from .screen_atlas import (
    BASE_VARIANT_KIND,
    route_key_for_url,
    screen_id_for,
    screen_observation_markdown,
    source_asset_metadata,
    variant_id_for,
    variant_observation_markdown,
)


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


def _storage_state_from_setup(setup: dict[str, Any]) -> dict[str, Any] | None:
    raw = setup.get("assisted_storage_state")
    if isinstance(raw, str) and raw.strip():
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return None
    if not isinstance(raw, dict):
        return None
    cookies = raw.get("cookies")
    origins = raw.get("origins")
    if not isinstance(cookies, list) and not isinstance(origins, list):
        return None
    return {
        "cookies": cookies if isinstance(cookies, list) else [],
        "origins": origins if isinstance(origins, list) else [],
    }


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


def _looks_like_email_signin_page(url: str, text: str) -> bool:
    lowered = text.lower()
    return (
        "/signin" in urlparse(url).path.lower()
        and any(
            marker in lowered
            for marker in [
                "メールでログイン",
                "ログインリンクを送信",
                "会社メールアドレス",
                "passwordless",
                "email address",
            ]
        )
    )


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


def _screen_observation_markdown(
    *,
    application_name: str,
    application_id: str,
    application_key: str,
    repo_full_name: str,
    scan_id: str,
    page_index: int,
    url: str,
    title: str,
    text_preview: str,
    screenshot_filename: str,
) -> str:
    screen_id = screen_id_for(scan_id, page_index, url, title)
    return screen_observation_markdown(
        application_name=application_name,
        application_id=application_id,
        application_key=application_key,
        repo_full_name=repo_full_name,
        scan_id=scan_id,
        screen_id=screen_id,
        page_index=page_index,
        url=url,
        route_key=route_key_for_url(url),
        title=title,
        text_preview=text_preview,
        screenshot_filename=screenshot_filename,
    )


def read_application_scan_setup(tool_context: Any = None) -> dict[str, Any]:
    """Read the system-provided application scan setup from session state."""
    bucket = _application_scan_bucket(tool_context)
    setup = _setup_from_bucket(bucket)
    start_url = _as_str(setup.get("start_url"))
    auth_mode = _as_str(setup.get("auth_mode")) or "none"
    authenticated_url = _as_str(setup.get("authenticated_url"))
    email_hint = _as_str(setup.get("email_hint")) or _as_str(setup.get("username"))
    missing: list[str] = []
    if auth_mode == "email_link_manual":
        if not authenticated_url:
            missing.append("authenticated_url")
        if not email_hint:
            missing.append("email_hint")
    elif auth_mode == "assisted_session":
        if not start_url:
            missing.append("start_url")
        if not _storage_state_from_setup(setup):
            missing.append("assisted_storage_state")
    elif not start_url:
        missing.append("start_url")
    return {
        "ok": len(missing) == 0,
        "missing": missing,
        "phase": bucket.get("phase") or "setup",
        "auth_mode": auth_mode,
        "start_url": start_url,
        "login_url": _as_str(setup.get("login_url")) or None,
        "has_username": bool(_as_str(setup.get("username"))),
        "has_password": bool(_as_str(setup.get("password"))),
        "has_email_hint": bool(_as_str(setup.get("email_hint"))),
        "has_authenticated_url": bool(_as_str(setup.get("authenticated_url"))),
        "has_assisted_storage_state": bool(_storage_state_from_setup(setup)),
        "max_pages": _as_int(setup.get("max_pages"), 12, 1, 50),
        "capture_screenshots": _as_bool(setup.get("capture_screenshots"), True),
        "explore_variants": _as_bool(setup.get("explore_variants"), False),
        "max_variants_per_screen": _as_int(
            setup.get("max_variants_per_screen"), 5, 0, 10
        ),
        "max_steps_per_screen": _as_int(setup.get("max_steps_per_screen"), 12, 1, 30),
        "allow_chat_send": _as_bool(setup.get("allow_chat_send"), False),
        "variant_only": _as_bool(setup.get("variant_only"), False),
        "target_screen_id": _as_str(setup.get("target_screen_id")) or None,
        "target_screen_url": _as_str(setup.get("target_screen_url")) or None,
        "target_route_key": _as_str(setup.get("target_route_key")) or None,
        "include_patterns": _as_str_list(setup.get("include_patterns")),
        "exclude_patterns": _as_str_list(setup.get("exclude_patterns")),
        "file_space_id": _as_str(setup.get("file_space_id")) or None,
        "application_id": _as_str(setup.get("application_id")) or None,
        "application_key": _as_str(setup.get("application_key")) or None,
        "application_name": _as_str(setup.get("application_name")) or None,
        "repo_full_name": _as_str(setup.get("repo_full_name")) or None,
    }


async def _maybe_complete_email_link_confirmation(
    page: Any,
    *,
    email_hint: str,
) -> dict[str, Any]:
    if not email_hint:
        return {"attempted": False, "ok": None, "reason": "email_hint_not_provided"}

    try:
        text = await page.locator("body").inner_text(timeout=5000)
    except Exception:
        text = ""
    lowered = text.lower() if isinstance(text, str) else ""
    if not any(
        marker in lowered
        for marker in [
            "メールアドレス",
            "会社メール",
            "email address",
            "confirm your email",
            "メールでログイン",
        ]
    ):
        return {"attempted": False, "ok": None, "reason": "email_prompt_not_detected"}

    input_selectors = [
        "input[type='email']",
        "input[name='email']",
        "input[autocomplete='email']",
        "input[type='text']",
        "input:not([type])",
    ]
    filled = False
    for selector in input_selectors:
        locator = page.locator(selector).first
        try:
            if await locator.count() and await locator.is_visible():
                await locator.fill(email_hint)
                filled = True
                break
        except Exception:
            continue
    if not filled:
        return {"attempted": True, "ok": False, "reason": "email_input_not_found"}

    before_url = page.url
    clicked = False
    for name in [
        re.compile("ログインを完了|ログイン|続行|確認|完了"),
        re.compile("complete|continue|confirm|sign in", re.IGNORECASE),
    ]:
        try:
            button = page.get_by_role("button", name=name).first
            if await button.count() and await button.is_visible():
                await button.click()
                clicked = True
                break
        except Exception:
            continue
    if not clicked:
        for selector in ["button[type='submit']", "button", "input[type='submit']"]:
            locator = page.locator(selector).first
            try:
                if await locator.count() and await locator.is_visible():
                    await locator.click()
                    clicked = True
                    break
            except Exception:
                continue
    if not clicked:
        await page.keyboard.press("Enter")

    try:
        await page.wait_for_load_state("networkidle", timeout=30000)
    except Exception:
        await page.wait_for_load_state("domcontentloaded", timeout=10000)
    try:
        await page.wait_for_url(lambda url: url != before_url, timeout=20000)
    except Exception:
        pass
    try:
        final_text = await page.locator("body").inner_text(timeout=5000)
    except Exception:
        final_text = ""
    if _looks_like_email_signin_page(page.url, final_text):
        final_lowered = final_text.lower() if isinstance(final_text, str) else ""
        reason = "email_link_sign_in_not_completed"
        if "invalid-email" in final_lowered or "does not match" in final_lowered:
            reason = "email_hint_does_not_match_link_recipient"
        return {
            "attempted": True,
            "ok": False,
            "method": "email_link_confirmation",
            "reason": reason,
            "detail": final_text[:1000],
        }
    return {"attempted": True, "ok": True, "method": "email_link_confirmation"}


async def _maybe_login(page: Any, setup: dict[str, Any], start_url: str) -> dict[str, Any]:
    auth_mode = _as_str(setup.get("auth_mode")) or "none"
    authenticated_url = _as_str(setup.get("authenticated_url"))
    if auth_mode == "assisted_session":
        return {
            "attempted": True,
            "ok": True,
            "method": "assisted_session",
            "resolved_start_url": start_url,
        }
    if auth_mode == "email_link_manual":
        if not authenticated_url:
            return {
                "attempted": False,
                "ok": None,
                "reason": "authenticated_url_not_provided",
            }
        await page.goto(authenticated_url, wait_until="domcontentloaded", timeout=45000)
        try:
            await page.wait_for_load_state("networkidle", timeout=20000)
        except Exception:
            await page.wait_for_load_state("domcontentloaded", timeout=10000)
        confirmation_result = await _maybe_complete_email_link_confirmation(
            page,
            email_hint=_as_str(setup.get("email_hint"))
            or _as_str(setup.get("username")),
        )
        if confirmation_result.get("attempted") and confirmation_result.get("ok") is False:
            return {
                "attempted": True,
                "ok": False,
                "method": "email_link_manual",
                "confirmation": confirmation_result,
            }
        if not confirmation_result.get("attempted"):
            try:
                current_text = await page.locator("body").inner_text(timeout=5000)
            except Exception:
                current_text = ""
            if _looks_like_email_signin_page(page.url, current_text):
                return {
                    "attempted": True,
                    "ok": False,
                    "method": "email_link_manual",
                    "confirmation": confirmation_result,
                    "reason": "email_confirmation_required",
                }
        resolved_url = _normalize_url(page.url)
        if start_url:
            await page.goto(start_url, wait_until="domcontentloaded", timeout=45000)
            try:
                await page.wait_for_load_state("networkidle", timeout=20000)
            except Exception:
                await page.wait_for_load_state("domcontentloaded", timeout=10000)
            resolved_url = _normalize_url(page.url) or start_url
        return {
            "attempted": True,
            "ok": True,
            "method": "email_link_manual",
            "confirmation": confirmation_result,
            "resolved_start_url": resolved_url,
        }

    if auth_mode != "credentials":
        return {"attempted": False, "ok": None}

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


async def _save_screen_variant(
    *,
    tool_context: Any,
    page: Any,
    application_name: str,
    application_id: str,
    application_key: str,
    repo_full_name: str,
    file_space_id: str,
    scan_id: str,
    screen_id: str,
    screen_source_asset_id: str,
    screen_index: int,
    variant_index: int,
    url: str,
    route_key: str,
    title: str,
    variant: dict[str, Any],
) -> dict[str, Any]:
    label = _as_str(variant.get("label"), f"Variant {variant_index:02d}")
    variant_kind = _as_str(variant.get("variantKind"), "unknown")
    variant_id = variant_id_for(screen_id, variant_index, label)
    variant_source_asset_id = f"source-asset-{scan_id}-{variant_id}"
    interaction_steps = [
        item
        for item in (variant.get("interactionSteps") or [])
        if isinstance(item, dict)
    ]
    png = await page.screenshot(full_page=True, type="png")
    screenshot_ref = await save_bytes_artifact(
        tool_context,
        filename=safe_artifact_filename(
            f"application_screen_{screen_index:03d}_variant_{variant_index:02d}_screenshot",
            ".png",
        ),
        data=png,
        mime_type="image/png",
        kind="image",
        title=f"Screen variant {variant_index:02d}: {label}",
        custom_metadata=source_asset_metadata(
            source="vibe-control-application-screen-variant-screenshot",
            title=(
                "Application screen variant screenshot "
                f"{screen_index:03d}-{variant_index:02d}"
            ),
            phase="screen_variant_screenshot",
            file_space_id=file_space_id,
            agent_search_import=False,
            application_id=application_id,
            application_key=application_key,
            application_name=application_name,
            repo_full_name=repo_full_name,
            source_asset_id=variant_source_asset_id,
            scan_id=scan_id,
            screen_id=screen_id,
            variant_id=variant_id,
            screen_url=url,
            route_key=route_key,
            capture_kind="screen_variant",
            capture_method="gemini_computer_use",
            variant_kind=variant_kind,
            parent_screen_asset_id=screen_source_asset_id,
            interaction_steps=interaction_steps,
        ),
    )
    screenshot_filename = (
        str(screenshot_ref.get("filename") or "") if screenshot_ref else ""
    )
    body = variant_observation_markdown(
        application_name=application_name,
        application_id=application_id,
        application_key=application_key,
        repo_full_name=repo_full_name,
        scan_id=scan_id,
        screen_id=screen_id,
        variant_id=variant_id,
        variant_index=variant_index,
        url=url,
        route_key=route_key,
        title=title,
        label=label,
        variant_kind=variant_kind,
        changed_from_base=_as_str(variant.get("changedFromBase")),
        visible_elements=[
            str(item)
            for item in (variant.get("visibleElements") or [])
            if str(item).strip()
        ],
        user_intent_clues=[
            str(item)
            for item in (variant.get("userIntentClues") or [])
            if str(item).strip()
        ],
        interaction_steps=interaction_steps,
        screenshot_filename=screenshot_filename,
        risk_level=_as_str(variant.get("riskLevel"), "safe_readonly"),
    )
    observation_ref = await save_text_artifact(
        tool_context,
        filename=safe_artifact_filename(
            f"application_screen_{screen_index:03d}_variant_{variant_index:02d}_observation",
            ".md",
        ),
        body=body,
        mime_type="text/markdown; charset=utf-8",
        kind="markdown_document",
        title=f"Screen Variant {variant_index:02d}: {label}",
        custom_metadata=source_asset_metadata(
            source="vibe-control-application-screen-variant-observation",
            title=(
                "Application screen variant observation "
                f"{screen_index:03d}-{variant_index:02d}"
            ),
            phase="screen_variant",
            file_space_id=file_space_id,
            agent_search_import=True,
            application_id=application_id,
            application_key=application_key,
            application_name=application_name,
            repo_full_name=repo_full_name,
            source_asset_id=variant_source_asset_id,
            scan_id=scan_id,
            screen_id=screen_id,
            variant_id=variant_id,
            screen_url=url,
            route_key=route_key,
            capture_kind="screen_variant",
            capture_method="gemini_computer_use",
            variant_kind=variant_kind,
            parent_screen_asset_id=screen_source_asset_id,
            screenshot_filename=screenshot_filename,
            interaction_steps=interaction_steps,
        ),
    )
    record = {
        "variantId": variant_id,
        "sourceAssetId": variant_source_asset_id,
        "label": label,
        "variantKind": variant_kind,
        "captureMethod": "gemini_computer_use",
        "changedFromBase": _as_str(variant.get("changedFromBase")),
        "riskLevel": _as_str(variant.get("riskLevel"), "safe_readonly"),
        "interactionSteps": interaction_steps,
        "screenshot": screenshot_ref,
        "screenObservation": observation_ref,
    }
    return {"screenshot": screenshot_ref, "observation": observation_ref, "record": record}


async def run_application_scan(
    max_pages: int | None = None,
    capture_screenshots: bool | None = None,
    tool_context: Any = None,
) -> dict[str, Any]:
    """Scan target app, saving screenshots, sitemap JSON, and summary artifacts."""
    bucket = _application_scan_bucket(tool_context)
    setup = _setup_from_bucket(bucket)
    start_url = _normalize_url(_as_str(setup.get("start_url")))
    auth_mode = _as_str(setup.get("auth_mode")) or "none"
    authenticated_url_raw = _as_str(setup.get("authenticated_url"))
    authenticated_url_for_display = _normalize_url(authenticated_url_raw)
    assisted_storage_state = _storage_state_from_setup(setup)
    if not start_url and auth_mode != "email_link_manual":
        return {"ok": False, "error": "application_scan.setup.start_url is required"}
    if auth_mode == "email_link_manual" and not authenticated_url_raw:
        return {
            "ok": False,
            "error": "application_scan.setup.authenticated_url is required",
        }
    if auth_mode == "assisted_session" and not assisted_storage_state:
        return {
            "ok": False,
            "error": "application_scan.setup.assisted_storage_state is required",
        }

    page_limit = _as_int(max_pages, _as_int(setup.get("max_pages"), 12, 1, 50), 1, 50)
    should_capture = (
        bool(capture_screenshots)
        if capture_screenshots is not None
        else _as_bool(setup.get("capture_screenshots"), True)
    )
    explore_variants = _as_bool(setup.get("explore_variants"), False)
    max_variants_per_screen = _as_int(
        setup.get("max_variants_per_screen"), 5, 0, 10
    )
    max_steps_per_screen = _as_int(setup.get("max_steps_per_screen"), 12, 1, 30)
    allow_chat_send = _as_bool(setup.get("allow_chat_send"), False)
    variant_only = _as_bool(setup.get("variant_only"), False)
    target_screen_id = _as_str(setup.get("target_screen_id"))
    target_screen_url = _normalize_url(_as_str(setup.get("target_screen_url")))
    target_route_key = _as_str(setup.get("target_route_key"))
    include_patterns = _as_str_list(setup.get("include_patterns"))
    exclude_patterns = _as_str_list(setup.get("exclude_patterns"))
    file_space_id = _as_str(setup.get("file_space_id"))
    application_id = _as_str(setup.get("application_id"))
    application_key = _as_str(setup.get("application_key"))
    application_name = _as_str(setup.get("application_name"))
    repo_full_name = _as_str(setup.get("repo_full_name"))
    initial_url = (
        target_screen_url
        if variant_only and target_screen_url
        else start_url or authenticated_url_for_display
    )
    if variant_only:
        page_limit = 1
        explore_variants = True
    scan_id = f"application-scan-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    _patch_scan_state(
        tool_context,
        {
            "phase": "running",
            "progress": {
                "scan_id": scan_id,
                "processed_pages": 0,
                "total_pages": page_limit,
                "current_url": initial_url,
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
    screen_observation_refs: list[dict[str, Any]] = []
    variant_refs: list[dict[str, Any]] = []
    variant_observation_refs: list[dict[str, Any]] = []
    variant_failures: list[dict[str, Any]] = []
    visited: set[str] = set()
    queue: deque[str] = deque()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context_options: dict[str, Any] = {
            "viewport": {"width": 1440, "height": 1100},
            "ignore_https_errors": True,
        }
        if assisted_storage_state:
            context_options["storage_state"] = assisted_storage_state
        context = await browser.new_context(**context_options)
        page = await context.new_page()
        login_result = await _maybe_login(page, setup, start_url)
        if login_result.get("attempted") and login_result.get("ok") is False:
            await context.close()
            await browser.close()
            return {
                "ok": False,
                "error": "application_scan login failed",
                "login": login_result,
            }
        resolved_start_url = _normalize_url(
            _as_str(login_result.get("resolved_start_url"))
        )
        if resolved_start_url and not (variant_only and target_screen_url):
            start_url = resolved_start_url
            initial_url = resolved_start_url
        if not initial_url:
            initial_url = _normalize_url(page.url)
        if not initial_url:
            await browser.close()
            return {
                "ok": False,
                "error": "application_scan could not resolve a start URL",
            }
        queue.append(initial_url)

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
                route_key = target_route_key if variant_only and target_route_key else route_key_for_url(url)
                screen_id = (
                    target_screen_id
                    if variant_only and target_screen_id
                    else screen_id_for(scan_id, page_index, url, str(extracted["title"] or ""))
                )
                screen_source_asset_id = f"source-asset-{scan_id}-{screen_id}"
                screenshot_ref = None
                screen_observation_ref = None
                if should_capture:
                    png = await page.screenshot(full_page=True, type="png")
                    filename = safe_artifact_filename(
                        f"application_screen_{page_index:03d}_base_screenshot", ".png"
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
                            agent_search_import=False,
                            source="vibe-control-application-screenshot",
                            applicationId=application_id,
                            applicationKey=application_key,
                            applicationName=application_name,
                            repoFullName=repo_full_name,
                            sourceAssetId=screen_source_asset_id,
                            url=url,
                            screenUrl=url,
                            routeKey=route_key,
                            screenId=screen_id,
                            captureKind="base_screen",
                            captureMethod="static_link_scan",
                            variantKind=BASE_VARIANT_KIND,
                            scanId=scan_id,
                        ),
                    )
                    if screenshot_ref:
                        screenshot_refs.append({**screenshot_ref, "url": url})
                        observation_body = screen_observation_markdown(
                            application_name=application_name,
                            application_id=application_id,
                            application_key=application_key,
                            repo_full_name=repo_full_name,
                            scan_id=scan_id,
                            screen_id=screen_id,
                            page_index=page_index,
                            url=url,
                            route_key=route_key,
                            title=extracted["title"],
                            text_preview=extracted["text"][:2400],
                            screenshot_filename=str(
                                screenshot_ref.get("filename") or ""
                            ),
                        )
                        screen_observation_ref = await save_text_artifact(
                            tool_context,
                            filename=safe_artifact_filename(
                                f"application_screen_{page_index:03d}_observation",
                                ".md",
                            ),
                            body=observation_body,
                            mime_type="text/markdown; charset=utf-8",
                            kind="markdown_document",
                            title=(
                                f"Screen Observation {page_index:03d}: "
                                f"{extracted['title'] or url}"
                            ),
                            custom_metadata=source_asset_metadata(
                                title=(
                                    f"Application screen observation {page_index:03d}"
                                ),
                                source="vibe-control-application-screen-observation",
                                phase="screen_observation",
                                file_space_id=file_space_id,
                                agent_search_import=True,
                                application_id=application_id,
                                application_key=application_key,
                                application_name=application_name,
                                repo_full_name=repo_full_name,
                                source_asset_id=screen_source_asset_id,
                                screen_id=screen_id,
                                screen_url=url,
                                route_key=route_key,
                                capture_kind="base_screen",
                                capture_method="static_link_scan",
                                variant_kind=BASE_VARIANT_KIND,
                                screenshot_filename=str(
                                    screenshot_ref.get("filename") or ""
                                ),
                                scan_id=scan_id,
                            ),
                        )
                        if screen_observation_ref:
                            screen_observation_refs.append(
                                {**screen_observation_ref, "url": url}
                            )
                screen_record: dict[str, Any] = {
                    "screenId": screen_id,
                    "sourceAssetId": screen_source_asset_id,
                    "url": url,
                    "routeKey": route_key,
                    "title": extracted["title"],
                    "textPreview": extracted["text"][:1200],
                    "outboundLinkCount": len(extracted["links"]),
                    "screenshot": screenshot_ref,
                    "screenObservation": screen_observation_ref,
                    "variants": [],
                }
                if explore_variants and should_capture and max_variants_per_screen > 0:
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                        try:
                            await page.wait_for_load_state("networkidle", timeout=5000)
                        except Exception:
                            pass
                        variant_result = await explore_screen_variants(
                            page=page,
                            screen=screen_record,
                            origin=start_url,
                            max_variants=max_variants_per_screen,
                            max_steps=max_steps_per_screen,
                            allow_chat_send=allow_chat_send,
                        )
                        for failure in variant_result.get("failures") or []:
                            if isinstance(failure, dict):
                                variant_failures.append(failure)
                                _patch_scan_state(
                                    tool_context,
                                    {
                                        "variantFailures": variant_failures[-20:],
                                    },
                                )
                        for variant_index, variant in enumerate(
                            [
                                item
                                for item in variant_result.get("variants", [])
                                if isinstance(item, dict)
                            ],
                            start=1,
                        ):
                            variant_ref = await _save_screen_variant(
                                tool_context=tool_context,
                                page=page,
                                application_name=application_name,
                                application_id=application_id,
                                application_key=application_key,
                                repo_full_name=repo_full_name,
                                file_space_id=file_space_id,
                                scan_id=scan_id,
                                screen_id=screen_id,
                                screen_source_asset_id=screen_source_asset_id,
                                screen_index=page_index,
                                variant_index=variant_index,
                                url=url,
                                route_key=route_key,
                                title=str(extracted["title"] or ""),
                                variant=variant,
                            )
                            if variant_ref["screenshot"]:
                                variant_refs.append({**variant_ref["screenshot"], "url": url})
                            if variant_ref["observation"]:
                                variant_observation_refs.append(
                                    {**variant_ref["observation"], "url": url}
                                )
                            screen_record["variants"].append(variant_ref["record"])
                    except Exception as exc:
                        variant_failures.append(
                            {
                                "screenId": screen_id,
                                "url": url,
                                "phase": "variant_exploration",
                                "error": str(exc)[:300],
                            }
                        )
                pages.append(
                    screen_record
                )
                for raw_link in extracted["links"]:
                    if variant_only:
                        break
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
        "schemaVersion": "screen-atlas-v1",
        "scanId": scan_id,
        "generatedAt": _now_iso(),
        "target": {
            "startUrl": start_url,
            "loginAttempted": bool(login_result.get("attempted")),
            "loginOk": login_result.get("ok"),
            "includePatterns": include_patterns,
            "excludePatterns": exclude_patterns,
        },
        "explorationPolicy": {
            "exploreVariants": explore_variants,
            "maxVariantsPerScreen": max_variants_per_screen,
            "maxStepsPerScreen": max_steps_per_screen,
            "allowChatSend": allow_chat_send,
            "variantOnly": variant_only,
            "targetScreenId": target_screen_id or None,
            "targetScreenUrl": target_screen_url or None,
            "targetRouteKey": target_route_key or None,
            "sameOriginOnly": True,
            "destructiveActionPolicy": "block",
        },
        "summary": {
            "pageCount": len(pages),
            "screenshotCount": len(screenshot_refs),
            "variantCount": len(variant_refs),
            "variantObservationCount": len(variant_observation_refs),
            "failureCount": len(failures),
            "variantFailureCount": len(variant_failures),
        },
        "pages": pages,
        "screens": pages,
        "failures": failures,
        "variantFailures": variant_failures,
    }
    sitemap_body = json.dumps(sitemap, ensure_ascii=False, indent=2)
    sitemap_ref = await save_text_artifact(
        tool_context,
        filename=safe_artifact_filename("application_screen_atlas", ".json"),
        body=sitemap_body,
        mime_type="application/json; charset=utf-8",
        kind="json_document",
        title="Application Screen Atlas",
        custom_metadata=source_asset_metadata(
            source="vibe-control-application-screen-atlas",
            title="Application Screen Atlas",
            phase="screen_atlas",
            file_space_id=file_space_id,
            agent_search_import=True,
            application_id=application_id,
            application_key=application_key,
            application_name=application_name,
            repo_full_name=repo_full_name,
            source_asset_id=f"source-asset-{scan_id}-atlas",
            scan_id=scan_id,
            capture_kind="screen_atlas",
            capture_method="static_link_scan",
        ),
    )
    summary_lines = [
        "# Screen Atlas Summary",
        "",
        f"- Scan ID: `{scan_id}`",
        f"- Start URL: {start_url}",
        f"- Screens: {len(pages)}",
        f"- Base Screenshots: {len(screenshot_refs)}",
        f"- Variants: {len(variant_refs)}",
        f"- Failures: {len(failures)}",
        f"- Variant Failures: {len(variant_failures)}",
        "",
        "## Screens",
        *[
            (
                f"- {item['title'] or '(no title)'}: {item['url']}"
                f" ({len(item.get('variants') or [])} variants)"
            )
            for item in pages
        ],
    ]
    if failures:
        summary_lines.extend(["", "## Failures"])
        summary_lines.extend([f"- {item['url']}: {item['error']}" for item in failures])
    if variant_failures:
        summary_lines.extend(["", "## Variant Failures"])
        summary_lines.extend(
            [
                f"- {item.get('url') or item.get('screenId')}: {item.get('error')}"
                for item in variant_failures
                if isinstance(item, dict)
            ]
        )
    summary_ref = await save_text_artifact(
        tool_context,
        filename=safe_artifact_filename("application_screen_atlas_summary", ".md"),
        body="\n".join(summary_lines),
        mime_type="text/markdown; charset=utf-8",
        kind="markdown_document",
        title="Screen Atlas Summary",
        custom_metadata=source_asset_metadata(
            source="vibe-control-application-screen-atlas-summary",
            title="Screen Atlas Summary",
            phase="summary",
            file_space_id=file_space_id,
            agent_search_import=True,
            application_id=application_id,
            application_key=application_key,
            application_name=application_name,
            repo_full_name=repo_full_name,
            source_asset_id=f"source-asset-{scan_id}-summary",
            scan_id=scan_id,
            capture_kind="screen_atlas_summary",
            capture_method="static_link_scan",
        ),
    )

    artifact_refs = [
        ref
        for ref in [
            sitemap_ref,
            summary_ref,
            *screenshot_refs,
            *screen_observation_refs,
            *variant_refs,
            *variant_observation_refs,
        ]
        if ref
    ]
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
                "screen_observation_count": len(screen_observation_refs),
                "variant_count": len(variant_refs),
                "variant_observation_count": len(variant_observation_refs),
            },
        },
    )
    return {
        "ok": True,
        "application_scan": {
            "scan_id": scan_id,
            "page_count": len(pages),
            "screen_count": len(pages),
            "screenshot_count": len(screenshot_refs),
            "screen_observation_count": len(screen_observation_refs),
            "variant_count": len(variant_refs),
            "variant_observation_count": len(variant_observation_refs),
            "failure_count": len(failures),
            "variant_failure_count": len(variant_failures),
            "file_space_id": file_space_id or None,
        },
        "artifact_refs": artifact_refs,
    }
