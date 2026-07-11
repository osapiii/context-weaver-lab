from __future__ import annotations

import pytest
from pydantic import ValidationError

from storyvault_zapping_analysis.schemas import ZappingAnalysisResult


def _valid_result_payload() -> dict:
    return {
        "schemaVersion": "storyvault-zapping-analysis-v2",
        "generatedAt": "2026-07-01T00:00:00Z",
        "storyCandidates": [
            {
                "id": "US-001",
                "title": "明細情報の確認",
                "role": {"value": "経理担当者", "grounding": "inferred"},
                "goal": "スキャンされた請求書の明細を確認したい",
                "benefit": "誤った仕訳登録を防げる",
                "acceptanceCriteria": ["明細行ごとの数量と金額を確認できる"],
                "detailedSpecifications": [
                    "明細テーブルには品番、数量、単価、金額を表示する",
                    "補足発話から分かる確認ポイントをストーリーに紐付ける",
                ],
                "evidence": [
                    {
                        "videoId": "video-1",
                        "title": "明細確認",
                        "summary": "明細テーブルを確認している",
                        "tRange": [20, 38],
                        "representativeScreenshotId": "clip-001:frame-001",
                        "screenshotIds": ["clip-001:frame-001"],
                        "transcriptCueIds": ["clip-001:cue-0001"],
                        "transcriptQuote": "明細情報を確認します",
                    }
                ],
                "confidenceScore": 90,
            }
        ],
    }


def test_zapping_analysis_schema_accepts_timestamped_evidence():
    parsed = ZappingAnalysisResult.model_validate(_valid_result_payload())

    assert parsed.storyCandidates[0].evidence[0].transcriptCueIds == [
        "clip-001:cue-0001"
    ]
    assert parsed.storyCandidates[0].detailedSpecifications[0].startswith("明細")


def test_zapping_analysis_schema_rejects_missing_evidence():
    payload = _valid_result_payload()
    payload["storyCandidates"][0].pop("evidence")

    with pytest.raises(ValidationError):
        ZappingAnalysisResult.model_validate(payload)


def test_zapping_analysis_schema_rejects_evidence_without_transcript_cues():
    payload = _valid_result_payload()
    payload["storyCandidates"][0]["evidence"][0]["transcriptCueIds"] = []

    with pytest.raises(ValidationError):
        ZappingAnalysisResult.model_validate(payload)
