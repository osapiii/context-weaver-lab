"""tool_state — ADK State オブジェクトの読み取り (§16b)."""
from __future__ import annotations

from common.tool_state import read_tool_state, state_to_plain_dict


def test_read_tool_state_from_adk_state_object():
    from google.adk.sessions.state import State

    class _Ctx:
        def __init__(self, state: State) -> None:
            self.state = state

    adk_state = State(
        value={"image": {"phase": "retouch", "primary": {"adk_filename": "x.png"}}},
        delta={},
    )
    assert not isinstance(adk_state, dict)
    plain = read_tool_state(_Ctx(adk_state))
    assert plain["image"]["phase"] == "retouch"
    assert state_to_plain_dict(adk_state)["image"]["primary"]["adk_filename"] == "x.png"


def test_read_tool_state_none_context():
    assert read_tool_state(None) == {}
