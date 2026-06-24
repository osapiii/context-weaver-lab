"""Screen Atlas helpers for application scans."""
from __future__ import annotations

import hashlib
import json
from typing import Any
from urllib.parse import urlparse


BASE_VARIANT_KIND = "base"


def route_key_for_url(url: str) -> str:
    """Build a stable route key from a normalized URL."""
    try:
        parsed = urlparse(url)
    except Exception:
        return "/"
    path = parsed.path or "/"
    return path.rstrip("/") or "/"


def screen_id_for(scan_id: str, page_index: int, url: str, title: str) -> str:
    seed = f"{scan_id}:{page_index}:{url}:{title}".encode("utf-8")
    digest = hashlib.sha1(seed).hexdigest()[:10]
    return f"screen-{page_index:03d}-{digest}"


def variant_id_for(screen_id: str, variant_index: int, label: str) -> str:
    seed = f"{screen_id}:{variant_index}:{label}".encode("utf-8")
    digest = hashlib.sha1(seed).hexdigest()[:10]
    return f"{screen_id}-variant-{variant_index:02d}-{digest}"


def redact_sensitive_text(value: str) -> str:
    """Remove obvious secret-bearing lines from generated evidence text."""
    blocked = ("password", "cookie", "authorization", "session", "token", "secret")
    lines = []
    for line in value.splitlines():
        lowered = line.lower()
        if any(word in lowered for word in blocked):
            continue
        lines.append(line)
    return "\n".join(lines)


def screen_observation_markdown(
    *,
    application_name: str,
    application_id: str,
    application_key: str,
    repo_full_name: str,
    scan_id: str,
    screen_id: str,
    page_index: int,
    url: str,
    route_key: str,
    title: str,
    text_preview: str,
    screenshot_filename: str,
) -> str:
    text_preview = redact_sensitive_text(text_preview)
    lines = [
        f"# Screen {page_index:03d}: {title or route_key or url}",
        "",
        "This document is searchable evidence generated for the Screen Atlas.",
        "",
        "## Application",
        f"- Name: {application_name or '(unknown)'}",
        f"- Application ID: {application_id or '(unknown)'}",
        f"- Application Key: {application_key or '(unknown)'}",
        f"- Repository: {repo_full_name or '(unknown)'}",
        "",
        "## Screen",
        f"- Scan ID: {scan_id}",
        f"- Screen ID: {screen_id}",
        f"- Page Index: {page_index}",
        f"- URL: {url}",
        f"- Route Key: {route_key}",
        f"- Title: {title or '(no title)'}",
        f"- Screenshot Artifact: {screenshot_filename or '(not captured)'}",
        "",
        "## Visible UI Text",
        text_preview.strip() or "(no visible text extracted)",
        "",
        "## Asset Usage",
        "- Screen inventory and route discovery",
        "- Capability boundary discovery",
        "- Story and acceptance criteria grounding",
        "- UI implementation comparison with GitHub sources",
    ]
    return "\n".join(lines)


def variant_observation_markdown(
    *,
    application_name: str,
    application_id: str,
    application_key: str,
    repo_full_name: str,
    scan_id: str,
    screen_id: str,
    variant_id: str,
    variant_index: int,
    url: str,
    route_key: str,
    title: str,
    label: str,
    variant_kind: str,
    changed_from_base: str,
    visible_elements: list[str],
    user_intent_clues: list[str],
    interaction_steps: list[dict[str, Any]],
    screenshot_filename: str,
    risk_level: str,
) -> str:
    changed_from_base = redact_sensitive_text(changed_from_base)
    steps_body = json.dumps(interaction_steps, ensure_ascii=False, indent=2)
    lines = [
        f"# Screen Variant {variant_index:02d}: {label or variant_kind}",
        "",
        "This document is searchable evidence generated for a Screen Atlas variant.",
        "",
        "## Application",
        f"- Name: {application_name or '(unknown)'}",
        f"- Application ID: {application_id or '(unknown)'}",
        f"- Application Key: {application_key or '(unknown)'}",
        f"- Repository: {repo_full_name or '(unknown)'}",
        "",
        "## Screen Variant",
        f"- Scan ID: {scan_id}",
        f"- Screen ID: {screen_id}",
        f"- Variant ID: {variant_id}",
        f"- URL: {url}",
        f"- Route Key: {route_key}",
        f"- Title: {title or '(no title)'}",
        f"- Variant Kind: {variant_kind or 'unknown'}",
        f"- Risk Level: {risk_level or 'safe_readonly'}",
        f"- Screenshot Artifact: {screenshot_filename or '(not captured)'}",
        "",
        "## Changed From Base Screen",
        changed_from_base.strip() or "(no change summary generated)",
        "",
        "## Visible Elements",
        *[f"- {item}" for item in visible_elements[:20]],
        "",
        "## User Intent Clues",
        *[f"- {item}" for item in user_intent_clues[:20]],
        "",
        "## Interaction Steps",
        "```json",
        steps_body,
        "```",
    ]
    return "\n".join(lines)


def source_asset_metadata(
    *,
    source: str,
    title: str,
    phase: str,
    file_space_id: str,
    agent_search_import: bool,
    application_id: str,
    application_key: str,
    application_name: str,
    repo_full_name: str,
    source_asset_id: str,
    scan_id: str,
    screen_id: str = "",
    variant_id: str = "",
    screen_url: str = "",
    route_key: str = "",
    capture_kind: str = "",
    capture_method: str = "",
    variant_kind: str = "",
    parent_screen_asset_id: str = "",
    screenshot_filename: str = "",
    interaction_steps: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "source": source,
        "title": title,
        "phase": phase,
        "applicationId": application_id,
        "applicationKey": application_key,
        "applicationName": application_name,
        "repoFullName": repo_full_name,
        "sourceAssetId": source_asset_id,
        "scanId": scan_id,
    }
    if file_space_id:
        metadata["fileSpaceId"] = file_space_id
        metadata["agentSearchImport"] = "true" if agent_search_import else "false"
    if screen_id:
        metadata["screenId"] = screen_id
    if variant_id:
        metadata["variantId"] = variant_id
    if screen_url:
        metadata["screenUrl"] = screen_url
        metadata["url"] = screen_url
    if route_key:
        metadata["routeKey"] = route_key
    if capture_kind:
        metadata["captureKind"] = capture_kind
    if capture_method:
        metadata["captureMethod"] = capture_method
    if variant_kind:
        metadata["variantKind"] = variant_kind
    if parent_screen_asset_id:
        metadata["parentScreenAssetId"] = parent_screen_asset_id
    if screenshot_filename:
        metadata["screenshotFilename"] = screenshot_filename
    if interaction_steps is not None:
        metadata["interactionSteps"] = json.dumps(
            interaction_steps,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    return metadata
