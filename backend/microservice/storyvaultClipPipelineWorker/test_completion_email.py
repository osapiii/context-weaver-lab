from datetime import datetime, timezone

from completion_email import build_completion_email, completion_email_request_id


def parent(title="操作デモ"):
    started = datetime(2026, 7, 11, 1, 0, tzinfo=timezone.utc)
    return {
        "title": title,
        "applicationName": "StoryVault",
        "createdAt": started,
        "steps": {
            step: {"status": "completed"}
            for step in (
                "trimSilence", "transcribe", "section", "quickScan",
                "zappingAnalysis", "capabilityStructuring", "storyGeneration",
                "verifyUiAssets",
            )
        },
    }


def state(failed=None):
    return {
        "clipIds": ["clip-1", "clip-2"],
        "failedClipIds": failed or [],
        "capabilityIds": ["cap-1"],
        "storyIds": ["story-1"],
        "storyTitles": ["管理者として解析状況を確認できる"],
        "clips": [{"clipId": "clip-1", "title": "録画を開始する"}],
    }


def test_completed_report_is_rich_and_has_plain_text():
    report = build_completion_email(
        pipeline_id="pipeline-1", parent=parent(), state=state(),
        app_url="https://storyvault-dev.web.app",
        now=datetime(2026, 7, 11, 1, 2, 3, tzinfo=timezone.utc),
    )
    assert "解析が完了しました" in report["html"]
    assert "生成クリップ" in report["html"]
    assert "正式User Story" in report["html"]
    assert "解析結果をStoryVaultで開く" in report["html"]
    assert 'src="https://storyvault-dev.web.app/apple-touch-icon.png"' in report["html"]
    assert 'alt="StoryVault"' in report["html"]
    assert "2分3秒" in report["text"]
    assert "pipeline-1" in report["text"]


def test_partial_report_warns_but_keeps_successful_results():
    report = build_completion_email(
        pipeline_id="pipeline-2", parent=parent(), state=state(["clip-2"]),
        app_url="https://storyvault-dev.web.app",
    )
    assert "一部完了しました" in report["html"]
    assert "成功した成果は保存済み" in report["html"]
    assert "解析成功: 1" in report["text"]
    assert "解析失敗: 1" in report["text"]


def test_user_content_is_html_escaped_including_cta_attribute():
    report = build_completion_email(
        pipeline_id='pipe\"<script>',
        parent=parent('<img src=x onerror=alert(1)>'),
        state={**state(), "clips": [{"clipId": "x", "title": "<b>unsafe</b>"}]},
        app_url="https://storyvault-dev.web.app",
    )
    assert "<script>" not in report["html"]
    assert "<img src=x" not in report["html"]
    assert "<b>unsafe</b>" not in report["html"]
    assert "&lt;img src=x onerror=alert(1)&gt;" in report["html"]
    assert "%22%3Cscript%3E" in report["html"]


def test_email_request_id_is_stable_across_workflow_retries():
    assert completion_email_request_id("pipeline-1") == completion_email_request_id("pipeline-1")
    assert completion_email_request_id("pipeline-1") == "txnEmail_storyvault_clip_pipeline_pipeline-1"
