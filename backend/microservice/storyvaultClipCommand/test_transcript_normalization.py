import unittest

from transcript_normalization import clip_local_transcript, normalize_transcript


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
