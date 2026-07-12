from unittest.mock import MagicMock, patch

from common.knowledge_context import (
    prepare_agent_search_turn_instruction,
    prepare_image_agent_search_turn_instruction,
    prepare_knowledge_context_parts,
    prepare_research_agent_search_turn_instruction,
    prepare_writing_agent_search_turn_instruction,
)


def test_prepare_agent_search_turn_instruction_when_datastore_set():
    part = prepare_agent_search_turn_instruction(
        datastore_path="projects/p/locations/global/collections/default_collection/dataStores/ds"
    )
    assert part is not None
    assert "Agent Search" in part.text
    assert "SSOT" in part.text or "データ環境" in part.text


def test_prepare_agent_search_turn_instruction_empty_datastore():
    assert prepare_agent_search_turn_instruction(datastore_path=None) is None
    assert prepare_agent_search_turn_instruction(datastore_path="  ") is None


def test_prepare_writing_agent_search_turn_instruction_when_datastore_set():
    part = prepare_writing_agent_search_turn_instruction(
        datastore_path="projects/p/locations/global/collections/default_collection/dataStores/ds"
    )
    assert part is not None
    assert "Agent Search" in part.text
    assert "add_json_document" in part.text
    assert "read_writing_form_status" in part.text


def test_prepare_writing_agent_search_turn_instruction_empty_datastore():
    assert prepare_writing_agent_search_turn_instruction(datastore_path=None) is None


def test_prepare_research_agent_search_turn_instruction_when_datastore_set():
    part = prepare_research_agent_search_turn_instruction(
        datastore_path="projects/p/locations/global/collections/default_collection/dataStores/ds"
    )
    assert part is not None
    assert "Agent Search" in part.text
    assert "deep_research" in part.text


def test_prepare_research_agent_search_turn_instruction_empty_datastore():
    assert prepare_research_agent_search_turn_instruction(datastore_path=None) is None


def test_prepare_image_agent_search_turn_instruction_when_datastore_set():
    part = prepare_image_agent_search_turn_instruction(
        datastore_path="projects/p/locations/global/collections/default_collection/dataStores/ds"
    )
    assert part is not None
    assert "Agent Search" in part.text
    assert "generate_image" in part.text
    assert "retouch_image" in part.text
    assert "add_citation" in part.text


def test_prepare_image_agent_search_turn_instruction_empty_datastore():
    assert prepare_image_agent_search_turn_instruction(datastore_path=None) is None


@patch("common.knowledge_context._fetch_gcs_bytes")
def test_prepare_knowledge_context_parts_text(mock_fetch):
    mock_fetch.return_value = b"hello knowledge"
    parts = prepare_knowledge_context_parts(
        [
            {
                "id": "doc-1",
                "name": "memo.txt",
                "gcs_path": "gs://bucket/path/memo.txt",
                "mime_type": "text/plain",
            }
        ]
    )
    assert len(parts) >= 3
    assert "ユーザー指定の参照知識" in parts[0].text
    assert "hello knowledge" in parts[-1].text


@patch("common.knowledge_context._fetch_gcs_bytes")
def test_prepare_knowledge_context_parts_skips_invalid_gcs(mock_fetch):
    parts = prepare_knowledge_context_parts(
        [
            {
                "id": "doc-1",
                "name": "broken",
                "gcs_path": "",
                "mime_type": "text/plain",
            }
        ]
    )
    mock_fetch.assert_not_called()
    assert len(parts) == 1


@patch("common.knowledge_context._fetch_gcs_bytes")
def test_merge_knowledge_refs_dedupes_turn(mock_fetch):
    from common.knowledge_context import merge_knowledge_refs

    pinned = [{"id": "1", "name": "a", "gcs_path": "gs://b/a.pdf", "mime_type": "application/pdf"}]
    turn = [
        {"id": "1", "name": "a", "gcs_path": "gs://b/a.pdf", "mime_type": "application/pdf"},
        {"id": "2", "name": "b", "gcs_path": "gs://b/b.pdf", "mime_type": "application/pdf"},
    ]
    p, turn_only = merge_knowledge_refs(pinned, turn)
    assert len(p) == 1
    assert len(turn_only) == 1
    assert turn_only[0]["id"] == "2"
    mock_fetch.assert_not_called()
    from common.knowledge_context import _fetch_gcs_bytes

    blob = MagicMock()
    blob.size = 10
    blob.download_as_bytes.return_value = b"abc"
    bucket = MagicMock()
    bucket.blob.return_value = blob
    client = MagicMock()
    client.bucket.return_value = bucket
    mock_client_cls.return_value = client

    data = _fetch_gcs_bytes("gs://my-bucket/folder/file.txt")
    assert data == b"abc"
    bucket.blob.assert_called_once_with("folder/file.txt")
