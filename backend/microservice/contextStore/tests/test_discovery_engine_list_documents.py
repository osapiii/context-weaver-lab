"""Tests for Discovery Engine list_documents pagination."""

from unittest.mock import MagicMock, patch

from localPackages.core.discovery_engine_client import DiscoveryEngineClient


@patch.object(DiscoveryEngineClient, "_request")
def test_list_documents_follows_next_page_token(mock_request: MagicMock) -> None:
    mock_request.side_effect = [
        {
            "documents": [{"id": "doc-1", "name": "n1", "structData": {}}],
            "nextPageToken": "page-2",
        },
        {
            "documents": [{"id": "doc-2", "name": "n2", "structData": {}}],
        },
    ]
    client = DiscoveryEngineClient.__new__(DiscoveryEngineClient)
    client._session = MagicMock()
    client._token = "token"
    client._storage = MagicMock()

    result = client.list_documents("file-space-1", page_size=1)
    docs = result["response"]["documents"]

    assert len(docs) == 2
    assert docs[0]["id"] == "doc-1"
    assert docs[1]["id"] == "doc-2"
    assert mock_request.call_count == 2
