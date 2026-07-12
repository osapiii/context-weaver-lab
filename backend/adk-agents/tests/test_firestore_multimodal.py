"""Firestore multimodal helpers."""
from __future__ import annotations

from common.firestore_multimodal import sanitize_event_dict_for_firestore


def test_sanitize_event_dict_strips_inline_bytes():
    raw = {
        "content": {
            "parts": [
                {
                    "inline_data": {
                        "mime_type": "application/pdf",
                        "data": b"pdf-bytes",
                    }
                }
            ]
        }
    }
    out = sanitize_event_dict_for_firestore(raw)
    inline = out["content"]["parts"][0]["inline_data"]
    assert inline.get("data_omitted") is True
    assert inline.get("byte_size") == len(b"pdf-bytes")
    assert "data" not in inline


def test_sanitize_event_dict_strips_base64_string():
    raw = {
        "content": {
            "parts": [
                {
                    "inline_data": {
                        "mime_type": "image/png",
                        "data": "aGVsbG8=",
                    }
                }
            ]
        }
    }
    out = sanitize_event_dict_for_firestore(raw)
    inline = out["content"]["parts"][0]["inline_data"]
    assert inline.get("data_omitted") is True
    assert "data" not in inline
