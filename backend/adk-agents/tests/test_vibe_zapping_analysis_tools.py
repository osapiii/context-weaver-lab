from __future__ import annotations

from google.adk.sessions.state import State

from vibe_zapping_analysis.tools import read_zapping_analysis_context


class _ToolContext:
    def __init__(self, state):
        self.state = state


def test_read_zapping_analysis_context_merges_multiple_clips():
    state = State(
        value={
            "vibe_zapping_analysis": {
                "setup": {
                    "application_id": "app-1",
                    "application_name": "HAIFF",
                    "analysis_session_id": "session-1",
                },
                "payload": {
                    "operation_video": {
                        "id": "video-1",
                        "title": "AIにファイルを取り込む",
                        "clips": [
                            {
                                "id": "clip-001",
                                "fileName": "part-1.webm",
                                "storagePath": "videos/part-1.webm",
                                "transcriptText": "ファイルをアップロードする",
                                "transcriptSummary": "アップロード導線を確認",
                                "frameCaptures": [
                                    {"id": "frame-001", "timestampMs": 1000}
                                ],
                            },
                            {
                                "id": "clip-002",
                                "fileName": "part-2.webm",
                                "storagePath": "videos/part-2.webm",
                                "transcriptText": "知識一覧を見る",
                                "transcriptSummary": "知識一覧を確認",
                                "frameCaptures": [
                                    {"id": "frame-001", "timestampMs": 2000}
                                ],
                            },
                        ],
                    },
                    "source_assets": [],
                },
            }
        },
        delta={},
    )

    result = read_zapping_analysis_context(_ToolContext(state))

    evidence = result["analysis_evidence"]
    assert evidence["has_video_file"] is True
    assert "ファイルをアップロード" in evidence["transcriptText"]
    assert "知識一覧を見る" in evidence["transcriptText"]
    assert evidence["frameCaptures"][0]["id"] == "clip-001:frame-001"
    assert evidence["frameCaptures"][1]["id"] == "clip-002:frame-001"
    assert evidence["clips"][1]["frameCount"] == 1
