"""Merge Gemini / ADK grounding_metadata payloads."""
from __future__ import annotations

from typing import Any


def _chunk_key(chunk: dict[str, Any]) -> str:
    rc = chunk.get("retrieved_context") or chunk.get("retrievedContext")
    if isinstance(rc, dict):
        for field in ("document_name", "documentName", "uri", "title"):
            value = rc.get(field)
            if isinstance(value, str) and value.strip():
                return f"rc:{value.strip()}"
    web = chunk.get("web")
    if isinstance(web, dict):
        uri = web.get("uri")
        if isinstance(uri, str) and uri.strip():
            return f"web:{uri.strip()}"
    return str(chunk)


def _merge_unique_strings(existing: list[Any], incoming: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for source in (existing, incoming):
        if not isinstance(source, list):
            continue
        for item in source:
            if not isinstance(item, str):
                continue
            trimmed = item.strip()
            if not trimmed or trimmed in seen:
                continue
            seen.add(trimmed)
            out.append(trimmed)
    return out


def merge_grounding_metadata(
    base: dict[str, Any] | None,
    incoming: dict[str, Any] | None,
) -> dict[str, Any]:
    """Accumulate grounding events from a single assistant turn."""
    if not base and not incoming:
        return {}
    if not base:
        return dict(incoming or {})
    if not incoming:
        return dict(base)

    merged: dict[str, Any] = dict(base)
    for key, value in incoming.items():
        if key in {
            "grounding_chunks",
            "groundingChunks",
            "grounding_supports",
            "groundingSupports",
            "retrieval_queries",
            "retrievalQueries",
            "web_search_queries",
            "webSearchQueries",
            "image_search_queries",
            "imageSearchQueries",
        }:
            continue
        merged[key] = value

    base_chunks = base.get("grounding_chunks") or base.get("groundingChunks") or []
    incoming_chunks = (
        incoming.get("grounding_chunks") or incoming.get("groundingChunks") or []
    )
    chunk_map: dict[str, dict[str, Any]] = {}
    for chunk in [*base_chunks, *incoming_chunks]:
        if isinstance(chunk, dict):
            chunk_map[_chunk_key(chunk)] = chunk
    if chunk_map:
        merged["grounding_chunks"] = list(chunk_map.values())

    base_supports = base.get("grounding_supports") or base.get("groundingSupports") or []
    incoming_supports = (
        incoming.get("grounding_supports") or incoming.get("groundingSupports") or []
    )
    supports: list[Any] = []
    seen_supports: set[str] = set()
    for support in [*base_supports, *incoming_supports]:
        if not isinstance(support, dict):
            continue
        segment = support.get("segment")
        segment_text = ""
        if isinstance(segment, dict) and isinstance(segment.get("text"), str):
            segment_text = segment["text"]
        indices = support.get("grounding_chunk_indices") or support.get(
            "groundingChunkIndices"
        )
        signature = f"{segment_text}|{indices}"
        if signature in seen_supports:
            continue
        seen_supports.add(signature)
        supports.append(support)
    if supports:
        merged["grounding_supports"] = supports

    for snake, camel in (
        ("retrieval_queries", "retrievalQueries"),
        ("web_search_queries", "webSearchQueries"),
        ("image_search_queries", "imageSearchQueries"),
    ):
        merged[snake] = _merge_unique_strings(
            base.get(snake) or base.get(camel) or [],
            incoming.get(snake) or incoming.get(camel) or [],
        )

    return merged
