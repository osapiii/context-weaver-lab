from __future__ import annotations

from datetime import datetime, timezone

from store import StoryVaultStore


def _store() -> StoryVaultStore:
    store = StoryVaultStore.__new__(StoryVaultStore)
    store._signed_url = lambda bucket, path, *, expires_at: f"https://signed.example.test/{bucket}/{path}"
    return store


def test_video_studio_generated_assets_include_subtitle_and_silence_cut_outputs():
    store = _store()
    expires_at = datetime(2026, 7, 8, 0, 0, tzinfo=timezone.utc)

    assets = store._video_studio_generated_assets(
        {
            "id": "storyvault_narration_video-1",
            "name": "Demo edit",
            "mergedVideoOutput": {
                "mergedVideoPath": {
                    "resultBucketName": "bucket",
                    "resultFilePath": "exports/final.mp4",
                },
                "requestId": "merge-1",
            },
            "silenceCutSettings": {"thresholdDb": -38},
            "silenceCutOutput": {
                "trimmedVideo": {
                    "resultBucketName": "bucket",
                    "resultFilePath": "exports/silence-cut.mp4",
                },
                "manifest": {
                    "resultBucketName": "bucket",
                    "resultFilePath": "exports/silence-cut.json",
                },
                "requestId": "silence-1",
            },
            "subtitleSettings": {"preset": "clear_standard"},
            "subtitleOutput": {
                "subtitledVideo": {
                    "resultBucketName": "bucket",
                    "resultFilePath": "exports/subtitled.mp4",
                },
                "srt": {
                    "resultBucketName": "bucket",
                    "resultFilePath": "exports/captions.srt",
                },
                "ass": {
                    "resultBucketName": "bucket",
                    "resultFilePath": "exports/captions.ass",
                },
                "requestId": "subtitle-1",
            },
        },
        video_id="storyvault_video-1",
        include_signed_urls=True,
        expires_at=expires_at,
    )

    by_kind = {asset["kind"]: asset for asset in assets}
    assert set(by_kind) == {
        "final_video",
        "silence_cut_video",
        "silence_cut_manifest",
        "subtitled_video",
        "subtitle_srt",
        "subtitle_ass",
    }
    assert by_kind["subtitled_video"]["downloadUrl"] == "https://signed.example.test/bucket/exports/subtitled.mp4"
    assert by_kind["subtitle_srt"]["contentType"] == "application/x-subrip"
    assert by_kind["subtitle_ass"]["role"] == "subtitle"
    assert by_kind["silence_cut_manifest"]["contentType"] == "application/json"
    assert by_kind["silence_cut_manifest"]["role"] == "json_manifest"
    assert by_kind["silence_cut_video"]["settings"] == {"thresholdDb": -38}


def test_operation_video_ref_exposes_flat_generated_assets(monkeypatch):
    store = _store()
    expires_at = datetime(2026, 7, 8, 0, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(
        store,
        "_video_studio_project_refs",
        lambda **_: [
            {
                "id": "project-1",
                "generatedAssets": [
                    {
                        "kind": "subtitled_video",
                        "downloadUrl": "https://signed.example.test/bucket/subtitled.mp4",
                    }
                ],
            }
        ],
    )

    ref = store._operation_video_ref(
        {
            "id": "video-1",
            "title": "Demo operation",
            "bucketName": "bucket",
            "storagePath": "source.webm",
            "clips": [],
        },
        include_signed_urls=True,
        expires_at=expires_at,
        include_video_studio_assets=True,
    )

    assert ref["videoStudio"]["videoId"] == "storyvault_video-1"
    assert ref["videoStudio"]["projectCount"] == 1
    assert ref["generatedAssetCount"] == 1
    assert ref["generatedAssets"][0]["kind"] == "subtitled_video"


def test_video_studio_generated_assets_include_section_and_audio_outputs():
    store = _store()
    expires_at = datetime(2026, 7, 8, 0, 0, tzinfo=timezone.utc)

    assets = store._video_studio_generated_assets(
        {
            "id": "storyvault_narration_video-1",
            "name": "Demo edit",
            "sections": [
                {
                    "id": "section-1",
                    "title": "Intro",
                    "mergedVideoOutput": {
                        "resultBucketName": "bucket",
                        "resultFilePath": "sections/intro.mp4",
                    },
                    "recording": {
                        "audioBucketName": "bucket",
                        "audioFilePath": "recordings/intro.webm",
                    },
                    "finalyNarrations": [
                        {
                            "isTtsGenerated": True,
                            "requestOutput": {
                                "outputPath": "gs://bucket/audio/intro.mp3",
                                "durationSeconds": 12.5,
                            },
                        }
                    ],
                }
            ],
        },
        video_id="storyvault_video-1",
        include_signed_urls=True,
        expires_at=expires_at,
    )

    by_kind = {asset["kind"]: asset for asset in assets}
    assert by_kind["section_video"]["downloadUrl"] == "https://signed.example.test/bucket/sections/intro.mp4"
    assert by_kind["recording_audio"]["contentType"] == "audio/webm"
    assert by_kind["ai_audio"]["contentType"] == "audio/mpeg"
    assert by_kind["ai_audio"]["statistics"] == {"durationSeconds": 12.5}
