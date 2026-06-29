from context_bundle import build_story_context_html, build_story_context_markdown


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
            "schemaVersion": "vibe-control-story-assets-v1",
            "generatedAt": "2026-06-29T00:00:00Z",
            "signedUrlExpiresAt": "2026-06-29T01:00:00Z",
            "assetCounts": {
                "sourceAssets": 1,
                "operationVideos": 1,
                "screenshots": 1,
                "githubPullRequests": 1,
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
    assert "Journey report" in html
    assert "submit_agent_plan" not in html
