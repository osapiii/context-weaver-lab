"""Story context bundle rendering for coding agents."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape


_TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"


def _text(value: Any, fallback: str = "") -> str:
    return value.strip() if isinstance(value, str) and value.strip() else fallback


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _line(label: str, value: Any) -> str:
    text = _text(value)
    return f"- {label}: {text}" if text else f"- {label}: n/a"


def _format_ms(value: Any) -> str:
    try:
        milliseconds = int(value)
    except Exception:
        return "n/a"
    seconds = milliseconds / 1000
    if seconds >= 60:
        minutes = int(seconds // 60)
        remainder = seconds % 60
        return f"{minutes}:{remainder:04.1f}"
    return f"{seconds:.1f}s"


def _html_environment() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(enabled_extensions=("html", "j2"), default_for_string=True),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["text"] = _text
    env.filters["format_ms"] = _format_ms
    return env


def _text_environment() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["text"] = _text
    env.filters["format_ms"] = _format_ms
    return env


def build_story_context_html(
    *,
    application: dict[str, Any],
    story: dict[str, Any],
    capability: dict[str, Any] | None,
    evidence: list[dict[str, Any]],
    source_assets: list[dict[str, Any]],
    asset_manifest: dict[str, Any] | None = None,
) -> str:
    """Render a self-contained HTML report for quick human review."""
    manifest = _dict(asset_manifest)
    source_asset_refs = _list(manifest.get("sourceAssets"))
    operation_videos = _list(manifest.get("operationVideos"))
    pull_requests = _list(manifest.get("githubPullRequests"))
    knowledge_documents = _list(manifest.get("knowledgeDocuments"))
    screenshot_count = sum(len(_list(video.get("screenshots"))) for video in operation_videos if isinstance(video, dict))
    evidence_ids = [
        str(item.get("id"))
        for item in evidence
        if isinstance(item, dict) and _text(item.get("id"))
    ]
    criteria = [
        item
        for item in _list(story.get("acceptanceCriteria"))
        if isinstance(item, dict)
    ]
    template = _html_environment().get_template("story_context_report.html.j2")
    return template.render(
        application=application,
        story=story,
        capability=capability,
        evidence=evidence,
        source_assets=source_assets,
        manifest=manifest,
        source_asset_refs=source_asset_refs,
        operation_videos=operation_videos,
        pull_requests=pull_requests,
        knowledge_documents=knowledge_documents,
        criteria=criteria,
        labels=_list(story.get("labels")),
        counts=_dict(manifest.get("assetCounts")),
        screenshot_count=screenshot_count,
        evidence_ids=evidence_ids,
        story_key=_text(story.get("storyKey"), story.get("id") or "story"),
    ).strip() + "\n"


def build_story_context_markdown(
    *,
    application: dict[str, Any],
    story: dict[str, Any],
    capability: dict[str, Any] | None,
    evidence: list[dict[str, Any]],
    source_assets: list[dict[str, Any]],
    asset_manifest: dict[str, Any] | None = None,
) -> str:
    story_key = _text(story.get("storyKey"), story.get("id") or "story")
    manifest = asset_manifest if isinstance(asset_manifest, dict) else {}
    template = _text_environment().get_template("story_context_report.md.j2")
    return template.render(
        application=application,
        story=story,
        capability=capability,
        evidence=evidence,
        source_assets=source_assets,
        manifest=manifest,
        source_asset_refs=_list(manifest.get("sourceAssets")),
        operation_videos=_list(manifest.get("operationVideos")),
        pull_requests=_list(manifest.get("githubPullRequests")),
        knowledge_documents=_list(manifest.get("knowledgeDocuments")),
        criteria=[item for item in _list(story.get("acceptanceCriteria")) if isinstance(item, dict)],
        labels=_list(story.get("labels")),
        counts=_dict(manifest.get("assetCounts")),
        story_key=story_key,
    ).strip() + "\n"


def _operation_video_template_context(context_manifest: dict[str, Any]) -> dict[str, Any]:
    manifest = _dict(context_manifest)
    return {
        "manifest": manifest,
        "application": _dict(manifest.get("application")),
        "operation_video_id": _text(manifest.get("operationVideoId"), "operation-video"),
        "video": _dict(manifest.get("operationVideo")),
        "linked_stories": _list(manifest.get("linkedStories")),
        "evidence": _list(manifest.get("evidence")),
        "source_assets": _list(manifest.get("sourceAssets")),
        "pull_requests": _list(manifest.get("githubPullRequests")),
        "knowledge_documents": _list(manifest.get("knowledgeDocuments")),
        "counts": _dict(manifest.get("counts")),
    }


def build_operation_video_context_html(*, context_manifest: dict[str, Any]) -> str:
    template = _html_environment().get_template("operation_video_context_report.html.j2")
    return template.render(**_operation_video_template_context(context_manifest)).strip() + "\n"


def build_operation_video_context_markdown(*, context_manifest: dict[str, Any]) -> str:
    template = _text_environment().get_template("operation_video_context_report.md.j2")
    return template.render(**_operation_video_template_context(context_manifest)).strip() + "\n"
