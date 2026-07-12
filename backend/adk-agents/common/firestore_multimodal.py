"""Firestore session events 向け ADK Event ペイロード整形.

画像スタジオと同様、session events サブコレクションにはバイナリを載せない.
LLM 呼び出しは ``inline_data`` のまま行い、``FirestoreSessionService.append_event``
で ``Event.model_dump`` 後に binary / base64 を除去する.
"""
from __future__ import annotations

from typing import Any


def sanitize_event_dict_for_firestore(payload: dict[str, Any]) -> dict[str, Any]:
    """Event.model_dump 結果から Firestore 非対応の binary を除去する."""

    def _omit_inline_data(raw: Any) -> dict[str, Any] | None:
        if not isinstance(raw, dict):
            return None
        inline = dict(raw)
        data = inline.pop("data", None)
        if data is None:
            return inline
        size = (
            len(data)
            if isinstance(data, (bytes, bytearray))
            else len(str(data))
        )
        inline["data_omitted"] = True
        inline["byte_size"] = size
        return inline

    def _walk(value: Any) -> Any:
        if isinstance(value, dict):
            if "inline_data" in value:
                omitted = _omit_inline_data(value.get("inline_data"))
                if omitted is not None:
                    value = {**value, "inline_data": omitted}
            return {key: _walk(child) for key, child in value.items()}
        if isinstance(value, list):
            return [_walk(item) for item in value]
        if isinstance(value, (bytes, bytearray)):
            return {"data_omitted": True, "byte_size": len(value)}
        return value

    return _walk(payload)
