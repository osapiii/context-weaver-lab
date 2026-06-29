from datetime import datetime, timedelta, timezone

from report_links import PublishedReport, ReportLinkBundle, StoryContextReportPublisher, build_report_link_response


class FakeBlob:
    def __init__(self, bucket_name, name, objects):
        self.bucket_name = bucket_name
        self.name = name
        self.objects = objects
        self.content_type = None
        self.metadata = {}

    def upload_from_string(self, data, content_type=None, timeout=None):
        self.objects[(self.bucket_name, self.name)] = bytes(data)
        self.content_type = content_type
        self.timeout = timeout

    def download_as_text(self, encoding="utf-8", timeout=None):
        return self.objects[(self.bucket_name, self.name)].decode(encoding)

    def generate_signed_url(self, expiration, method="GET", version="v4", **kwargs):
        assert method == "GET"
        assert version == "v4"
        expires = int(expiration.timestamp())
        return f"https://storage.example.test/{self.bucket_name}/{self.name}?expires={expires}"


class FakeBucket:
    def __init__(self, name, objects):
        self.name = name
        self.objects = objects

    def blob(self, name):
        return FakeBlob(self.name, name, self.objects)


class FakeStorageClient:
    def __init__(self):
        self.objects = {}

    def bucket(self, name):
        return FakeBucket(name, self.objects)

    def download_text(self, bucket_name, storage_path):
        return self.bucket(bucket_name).blob(storage_path).download_as_text()


def _application():
    return {"id": "app-haiff", "name": "haiff"}


def _story():
    return {
        "id": "story-haiff-ai-knowledge-ingest-mcp-smoke",
        "applicationId": "app-haiff",
        "storyKey": "HAIFFF-ST-AI-KNOWLEDGE-INGEST",
        "title": "AIにファイルを取り込み、知識を確認してテスト会話で活用する",
    }


def _asset_manifest():
    return {
        "signedUrlExpiresAt": "2026-06-29T01:00:00+00:00",
        "assetCounts": {
            "sourceAssets": 2,
            "operationVideos": 1,
            "screenshots": 1,
            "githubPullRequests": 0,
        },
        "operationVideos": [
            {
                "id": "video-1",
                "title": "知識取り込み操作",
                "downloadUrl": "https://storage.example.test/video.webm",
                "downloadUrlExpiresAt": "2026-06-29T01:00:00+00:00",
                "screenshots": [
                    {
                        "id": "frame-001",
                        "timestampMs": 1200,
                        "downloadUrl": "https://storage.example.test/frame.jpg",
                        "downloadUrlExpiresAt": "2026-06-29T01:00:00+00:00",
                    }
                ],
            }
        ],
    }


def test_build_report_link_response_shape_is_compact_and_agent_oriented():
    generated_at = datetime(2026, 6, 29, 0, 0, tzinfo=timezone.utc)
    expires_at = generated_at + timedelta(hours=24)
    bundle = ReportLinkBundle(
        html=PublishedReport(
            url="https://storage.example.test/report.html",
            gcs_path="gs://bucket/story-context.html",
            storage_path="story-context.html",
            content_type="text/html; charset=utf-8",
            bytes=80000,
        ),
        markdown=PublishedReport(
            url="https://storage.example.test/report.md",
            gcs_path="gs://bucket/story-context.md",
            storage_path="story-context.md",
            content_type="text/markdown; charset=utf-8",
            bytes=40000,
        ),
        generated_at=generated_at,
        expires_at=expires_at,
    )

    payload = build_report_link_response(
        application=_application(),
        story=_story(),
        asset_manifest=_asset_manifest(),
        bundle=bundle,
    )

    assert payload["schemaVersion"] == "storyvault-story-context-report-links-v1"
    assert payload["recommendedForAgent"] == "markdown"
    assert payload["implementationContext"]["readThisFirst"] == "reports.markdown.url"
    assert payload["reports"]["html"]["url"] == "https://storage.example.test/report.html"
    assert payload["reports"]["markdown"]["bytes"] == 40000
    assert payload["assets"]["counts"]["operationVideos"] == 1
    assert payload["assets"]["videos"][0]["downloadUrl"] == "https://storage.example.test/video.webm"
    assert payload["assets"]["videos"][0]["screenshotCount"] == 1
    assert "screenshots" not in payload["assets"]["videos"][0]
    assert "content" not in payload


def test_publish_uploads_html_and_markdown_and_returns_downloadable_links():
    storage_client = FakeStorageClient()
    publisher = StoryContextReportPublisher(
        storage_client=storage_client,
        bucket_name="storyvault-report-bucket",
        public_base_url="https://storyvault-mcp.example.test",
    )
    html = "<!doctype html><html><body>StoryVault HTML</body></html>"
    markdown = "# StoryVault Story Context\n\nEvidence: evidence-1"

    payload = publisher.publish(
        application=_application(),
        story=_story(),
        html=html,
        markdown=markdown,
        asset_manifest=_asset_manifest(),
        ttl_seconds=3600,
    )

    html_report = payload["reports"]["html"]
    markdown_report = payload["reports"]["markdown"]
    assert html_report["contentType"] == "text/html; charset=utf-8"
    assert markdown_report["contentType"] == "text/markdown; charset=utf-8"
    assert html_report["bytes"] == len(html.encode("utf-8"))
    assert markdown_report["bytes"] == len(markdown.encode("utf-8"))
    assert html_report["url"].startswith("https://storyvault-mcp.example.test/r/")
    assert markdown_report["url"].startswith("https://storyvault-mcp.example.test/r/")
    assert html_report["url"].endswith("/story-context.html")
    assert markdown_report["url"].endswith("/story-context.md")
    assert html_report["storagePath"].endswith("/story-context.html")
    assert markdown_report["storagePath"].endswith("/story-context.md")
    assert len(markdown_report["url"]) < 100

    assert storage_client.download_text("storyvault-report-bucket", html_report["storagePath"]) == html
    assert storage_client.download_text("storyvault-report-bucket", markdown_report["storagePath"]) == markdown
