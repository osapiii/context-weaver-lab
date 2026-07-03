from __future__ import annotations

from google.adk.sessions.state import State

from storyvault_zapping_analysis.tools import read_zapping_analysis_context


class _ToolContext:
    def __init__(self, state):
        self.state = state


def test_read_zapping_analysis_context_merges_multiple_clips():
    state = State(
        value={
            "storyvault_zapping_analysis": {
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
                                "transcriptSegments": [
                                    {
                                        "id": "cue-0001",
                                        "index": 1,
                                        "startMs": 0,
                                        "endMs": 14_000,
                                        "text": "ファイルをアップロードする",
                                    }
                                ],
                                "transcriptSrt": "1\n00:00:00,000 --> 00:00:14,000\nファイルをアップロードする",
                                "transcriptTimingStatus": "timestamped",
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
                                "transcriptSegments": [
                                    {
                                        "id": "cue-0001",
                                        "index": 1,
                                        "startMs": 40_000,
                                        "endMs": 55_000,
                                        "text": "知識一覧を見る",
                                    }
                                ],
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
    assert evidence["transcriptSegments"][0]["id"] == "clip-001:cue-0001"
    assert evidence["transcriptSegments"][1]["id"] == "clip-002:cue-0001"
    assert evidence["transcriptTimingStatus"] == "timestamped"
    assert evidence["clips"][0]["hasTimestampedTranscript"] is True
    assert evidence["clips"][1]["frameCount"] == 1


def test_read_zapping_analysis_context_parses_srt_only_clip():
    state = State(
        value={
            "storyvault_zapping_analysis": {
                "setup": {
                    "application_id": "app-1",
                    "application_name": "KnockAI",
                    "analysis_session_id": "session-1",
                },
                "payload": {
                    "operation_video": {
                        "id": "video-1",
                        "title": "請求書を確認する",
                        "clips": [
                            {
                                "id": "clip-001",
                                "fileName": "part-1.webm",
                                "storagePath": "videos/part-1.webm",
                                "transcriptText": "明細情報を確認します",
                                "transcriptSrt": (
                                    "1\n"
                                    "00:00:20,000 --> 00:00:38,000\n"
                                    "明細情報を確認します\n"
                                ),
                                "transcriptTimingStatus": "timestamped",
                                "frameCaptures": [
                                    {"id": "frame-001", "timestampMs": 25_000}
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
    assert evidence["transcriptTimingStatus"] == "timestamped"
    assert evidence["transcriptSegments"] == [
        {
            "id": "clip-001:cue-0001",
            "clipId": "clip-001",
            "index": 1,
            "startMs": 20_000,
            "endMs": 38_000,
            "text": "明細情報を確認します",
        }
    ]
    assert evidence["clips"][0]["hasTimestampedTranscript"] is True
