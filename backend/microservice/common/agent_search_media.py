"""Agent Search (Discovery Engine) が unstructured import で受け付ける画像 MIME."""

from __future__ import annotations

# layout parser 有効な datastore 向け (公式サポート MIME)
AGENT_SEARCH_IMPORTABLE_IMAGE_MIMES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/bmp",
        "image/tiff",
    }
)


def is_agent_search_importable_image_mime(mime: str | None) -> bool:
    if not mime:
        return False
    return mime.lower().strip() in AGENT_SEARCH_IMPORTABLE_IMAGE_MIMES
