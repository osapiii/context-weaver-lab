from __future__ import annotations

from vibe_related_context.smoke_related_context import (
    SmokeTarget,
    build_mode_state,
    build_request_doc,
)


def _target() -> SmokeTarget:
    return SmokeTarget(
        organization_id="org-1",
        space_id="space-1",
        user_id="user-1",
        user_email="user@example.com",
        application={
            "id": "app-1",
            "applicationKey": "haiff",
            "name": "HAIFF",
            "repoFullName": "enostech/haiff",
            "defaultBranch": "main",
        },
        operation_video={
            "id": "video-1",
            "title": "AIにファイルを取り込ませ、知識を活用する",
            "quickScan": {"summary": "Google Drive同期をスキップしてファイルを取り込む"},
            "transcriptSummary": "AIに教える機能へアクセスし、ファイルを取り込む。",
            "analysisResult": {"operationIntent": "知識化のためのファイル取込"},
        },
    )


def test_build_mode_state_matches_related_context_bucket_shape():
    state = build_mode_state(_target(), "session-1")

    assert state["active_mode"] == "vibe_related_context"
    bucket = state["vibe_related_context"]
    assert bucket["setup"]["provider"] == "github"
    assert bucket["setup"]["repo_full_name"] == "enostech/haiff"
    assert bucket["setup"]["operation_video_id"] == "video-1"
    assert bucket["payload"]["operation_video"]["title"].startswith("AIにファイル")
    assert bucket["payload"]["expected_outputs"] == [
        "github_pull_requests",
        "related_reasons",
    ]


def test_build_request_doc_uses_adk_invoke_request_shape():
    doc = build_request_doc(_target(), "request-1")

    assert doc["status"] == "pending"
    assert doc["operationMetadata"]["loggingCollectionId"] == (
        "requests/adkInvokeRequests/logs"
    )
    assert doc["operationMetadata"]["loggingDocumentId"] == "request-1"
    assert doc["input"]["mode"] == "vibe_related_context"
    assert doc["input"]["organizationId"] == "org-1"
    assert doc["input"]["spaceId"] == "space-1"
    assert doc["input"]["modeState"]["vibe_related_context"]["setup"][
        "operation_video_id"
    ] == "video-1"
