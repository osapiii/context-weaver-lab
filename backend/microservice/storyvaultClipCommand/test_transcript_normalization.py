import unittest

from transcript_normalization import bullet_summary, clip_local_transcript, normalize_transcript


class TranscriptNormalizationTest(unittest.TestCase):
    def test_normalizes_structured_transcription_into_cues(self):
        normalized = normalize_transcript(
            '{"transcript":"first second", "llm_output":{"paragraphs":[{"text":"first", "start":"00:00"}, {"text":"second", "start":"00:05"}]}}',
            10_000,
        )
        self.assertEqual(normalized["text"], "first second")
        self.assertEqual(
            [(cue["startMs"], cue["endMs"]) for cue in normalized["cues"]],
            [(0, 5000), (5000, 10000)],
        )

    def test_rebases_source_cues_to_the_clip_time_range(self):
        normalized = normalize_transcript(
            '{"transcript":"first second", "llm_output":{"paragraphs":[{"text":"first", "start":"00:00"}, {"text":"second", "start":"00:05"}]}}',
            10_000,
        )
        clip = clip_local_transcript(normalized, 5000, 10000, 5000)
        self.assertEqual(clip["text"], "second")
        self.assertEqual(clip["cues"][0]["startMs"], 0)
        self.assertEqual(clip["cues"][0]["endMs"], 5000)

    def test_spreads_paragraphs_when_all_starts_are_zero(self):
        normalized = normalize_transcript(
            '{"transcript":"short much longer", "llm_output":{"paragraphs":[{"text":"short", "start":"00:00"}, {"text":"much longer", "start":"00:00"}]}}',
            16_000,
        )
        self.assertEqual(len(normalized["cues"]), 2)
        self.assertEqual(normalized["cues"][0]["startMs"], 0)
        self.assertEqual(normalized["cues"][0]["endMs"], 5000)
        self.assertEqual(normalized["cues"][1]["startMs"], 5000)
        self.assertEqual(normalized["cues"][1]["endMs"], 16000)

    def test_builds_bulleted_summary_across_the_transcript(self):
        text = "最初の説明です。次の操作です。結果を確認します。最後に保存します。"
        summary = bullet_summary(text, [], limit=3)
        self.assertEqual(summary.splitlines(), [
            "- 最初の説明です。",
            "- 結果を確認します。",
            "- 最後に保存します。",
        ])

    def test_splits_a_long_paragraph_into_timestamped_sentences(self):
        normalized = normalize_transcript(
            '{"transcript":"一つ目です。二つ目です。三つ目です。", "llm_output":{"paragraphs":[{"text":"一つ目です。二つ目です。三つ目です。", "start":"00:00"}]}}',
            12_000,
        )
        self.assertEqual([cue["text"] for cue in normalized["cues"]], ["一つ目です。", "二つ目です。", "三つ目です。"])
        self.assertEqual(normalized["cues"][0]["startMs"], 0)
        self.assertEqual(normalized["cues"][-1]["endMs"], 12_000)
