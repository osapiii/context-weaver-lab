from context_bundle import (
    build_operation_video_context_html,
    build_operation_video_context_markdown,
    build_story_context_html,
    build_story_context_markdown,
)


def _bundle_kwargs():
    return dict(
        application={"id": "app-1", "name": "Demo App", "repoFullName": "org/repo"},
        story={
            "id": "story-1",
            "storyKey": "APP-ST-001",
            "title": "Review MCP context",
            "summary": "Developer reviews context.",
            "userStory": "As a developer, I want context.",
            "acceptanceCriteria": [{"text": "Evidence is cited", "state": "covered", "evidenceIds": ["ev-1"]}],
        },
        capability={"capabilityKey": "APP-CAP-001", "name": "Coding context"},
        evidence=[
            {
                "id": "ev-1",
                "type": "video",
                "title": "Operation video",
                "excerpt": "User opens the story detail.",
                "citation": {"snippet": "story detail"},
            }
        ],
        source_assets=[
            {
                "id": "asset-1",
                "sourceType": "operation_video_journey",
                "title": "Demo video",
                "markdownBody": "# Journey report\n\nUser imports knowledge.",
                "markdownTruncated": False,
            }
        ],
        asset_manifest={
            "schemaVersion": "storyvault-story-assets-v1",
            "generatedAt": "2026-06-29T00:00:00Z",
            "signedUrlExpiresAt": "2026-06-29T01:00:00Z",
            "assetCounts": {
                "sourceAssets": 1,
                "operationVideos": 1,
                "screenshots": 1,
                "githubPullRequests": 1,
                "slackMessages": 1,
                "knowledgeDocuments": 1,
            },
            "sourceAssets": [
                {
                    "id": "asset-1",
                    "sourceType": "operation_video_journey",
                    "title": "Demo video",
                    "gcsPath": "gs://bucket/journey.md",
                    "downloadUrl": "https://storage.example.test/journey.md",
                }
            ],
            "operationVideos": [
                {
                    "id": "video-1",
                    "title": "Demo operation",
                    "downloadUrl": "https://storage.example.test/video.webm",
                    "screenshots": [
                        {"id": "frame-001", "timestampMs": 1000, "downloadUrl": "https://storage.example.test/frame.jpg"}
                    ],
                }
            ],
            "githubPullRequests": [
                {
                    "repoFullName": "org/repo",
                    "number": 12,
                    "title": "Demo PR",
                    "htmlUrl": "https://github.com/org/repo/pull/12",
                }
            ],
            "slackMessages": [
                {
                    "teamName": "Demo Workspace",
                    "channelName": "product",
                    "author": "U123",
                    "text": "請求書一覧のSlack相談です。",
                    "postedAt": "1782640000.000100",
                    "permalink": "https://example.slack.com/archives/C123/p1782640000000100",
                    "relevanceScore": 88,
                    "reason": "Slack相談がストーリー内容と一致しています。",
                }
            ],
            "knowledgeDocuments": [
                {
                    "documentId": "doc-1",
                    "displayName": "architecture.md",
                    "mimeType": "text/markdown",
                    "downloadUrl": "https://storage.example.test/architecture.md",
                    "relevanceScore": 91,
                    "reason": "設計書が操作動画と一致しています。",
                }
            ],
        },
    )


def test_build_story_context_markdown_contains_story_evidence_and_instructions():
    markdown = build_story_context_markdown(**_bundle_kwargs())

    assert "# StoryVault Story Context: APP-ST-001" in markdown
    assert "Operation video" in markdown
    assert "# Journey report" in markdown
    assert "Media And Implementation References" in markdown
    assert "https://storage.example.test/video.webm" in markdown
    assert "https://github.com/org/repo/pull/12" in markdown
    assert "https://example.slack.com/archives/C123/p1782640000000100" in markdown
    assert "https://storage.example.test/architecture.md" in markdown
    assert "submit_agent_plan" not in markdown


def test_build_story_context_html_contains_visual_report_refs():
    html = build_story_context_html(**_bundle_kwargs())

    assert html.startswith("<!doctype html>")
    assert "StoryVault Story Context Report" in html
    assert "APP-ST-001" in html
    assert "ev-1" in html
    assert "https://storage.example.test/video.webm" in html
    assert "https://storage.example.test/frame.jpg" in html
    assert "architecture.md" in html
    assert "https://github.com/org/repo/pull/12" in html
    assert "請求書一覧のSlack相談です。" in html
    assert "Journey report" in html
    assert "submit_agent_plan" not in html


def _operation_video_manifest():
    return {
        "schemaVersion": "storyvault-operation-video-context-v1",
        "applicationId": "app-1",
        "application": {"id": "app-1", "name": "Demo App"},
        "operationVideoId": "video-1",
        "generatedAt": "2026-07-01T00:00:00Z",
        "signedUrlExpiresAt": "2026-07-01T01:00:00Z",
        "videoGroup": {"id": "group-1", "name": "Operation videos"},
        "operationVideo": {
            "id": "video-1",
            "title": "Invoice scan demo",
            "description": "Invoice workflow is recorded.",
            "downloadUrl": "https://storage.example.test/video.webm",
            "videoGroup": {"id": "group-1", "name": "Operation videos"},
            "transcriptProvider": "gemini-stt:gemini-2.5-flash",
            "transcriptTimingStatus": "timestamped",
            "transcriptSegmentCount": 2,
            "transcriptSegments": [
                {
                    "id": "cue-0001",
                    "startMs": 8000,
                    "endMs": 19000,
                    "text": "請求書一覧画面では合計金額を確認できます。",
                },
                {
                    "id": "cue-0002",
                    "startMs": 19000,
                    "endMs": 31000,
                    "text": "詳細画面で明細を確認します。",
                },
            ],
            "screenshots": [
                {
                    "id": "frame-001",
                    "timestampMs": 10000,
                    "downloadUrl": "https://storage.example.test/frame-001.jpg",
                }
            ],
            "storyCandidates": [
                {
                    "id": "candidate-001",
                    "storyKey": "US-01",
                    "title": "請求書一覧の概要確認",
                    "who": "請求書処理担当者",
                    "what": "一覧で合計金額を確認したい",
                    "why": "確認作業を早く終えられる",
                    "acceptanceCriteria": ["合計金額が一覧で確認できること"],
                    "confidenceScore": 95,
                    "transcriptCueIds": ["cue-0001"],
                    "evidenceCount": 1,
                    "screenshotCount": 1,
                    "evidence": [
                        {
                            "title": "請求書一覧画面での概要確認",
                            "tRange": [8, 19],
                            "transcriptCueIds": ["cue-0001"],
                            "transcriptQuote": "請求書一覧画面では合計金額を確認できます。",
                            "screenshots": [
                                {
                                    "id": "frame-001",
                                    "timestampMs": 10000,
                                    "downloadUrl": "https://storage.example.test/frame-001.jpg",
                                }
                            ],
                        }
                    ],
                }
            ],
            "clips": [],
        },
        "linkedStories": [],
        "evidence": [],
        "sourceAssets": [],
        "githubPullRequests": [],
        "slackMessages": [
            {
                "teamName": "Demo Workspace",
                "channelName": "product",
                "author": "U123",
                "text": "請求書一覧の合計金額について相談しています。",
                "postedAt": "1782640000.000100",
                "permalink": "https://example.slack.com/archives/C123/p1782640000000100",
                "relevanceScore": 92,
                "reason": "動画内の合計金額確認と同じ話題です。",
                "matchedSignals": ["合計金額", "請求書一覧"],
            }
        ],
        "knowledgeDocuments": [],
        "counts": {"screenshots": 1, "slackMessages": 1},
    }


def test_build_operation_video_context_markdown_includes_timestamped_story_candidates():
    markdown = build_operation_video_context_markdown(context_manifest=_operation_video_manifest())

    assert "Extracted Story Candidates" in markdown
    assert "Who: 請求書処理担当者" in markdown
    assert "cue-0001" in markdown
    assert "8.0s - 19.0s" in markdown
    assert "https://storage.example.test/frame-001.jpg" in markdown
    assert "Slack Messages" in markdown
    assert "https://example.slack.com/archives/C123/p1782640000000100" in markdown


def test_build_operation_video_context_html_includes_timestamped_story_candidates():
    html = build_operation_video_context_html(context_manifest=_operation_video_manifest())

    assert html.startswith("<!doctype html>")
    assert "Extracted Story Candidates" in html
    assert "Who / 誰が" in html
    assert "請求書一覧画面では合計金額を確認できます。" in html
    assert "https://storage.example.test/frame-001.jpg" in html
    assert "gemini-stt:gemini-2.5-flash" in html
    assert "Slack Messages" in html
    assert "請求書一覧の合計金額について相談しています。" in html
