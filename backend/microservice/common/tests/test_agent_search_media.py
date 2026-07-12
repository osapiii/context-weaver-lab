from common.agent_search_media import (
    AGENT_SEARCH_IMPORTABLE_IMAGE_MIMES,
    is_agent_search_importable_image_mime,
)


def test_importable_image_mimes():
    assert "image/jpeg" in AGENT_SEARCH_IMPORTABLE_IMAGE_MIMES
    assert is_agent_search_importable_image_mime("image/png")
    assert not is_agent_search_importable_image_mime("image/webp")
    assert not is_agent_search_importable_image_mime("image/svg+xml")
