import { describe, expect, it } from "vitest";
import type { StoryVaultTranscriptCue } from "@models/storyVault";
import {
  buildFallbackStoryVaultSections,
  normalizeStoryVaultAiSections,
  sectionSplitPointsMs,
  sliceStoryVaultTranscriptCues,
} from "./storyVaultClipSectioning";

const cues = Array.from({ length: 12 }, (_, index): StoryVaultTranscriptCue => ({
  id: `cue-${String(index + 1).padStart(4, "0")}`,
  index: index + 1,
  startMs: index * 10_000,
  endMs: (index + 1) * 10_000,
  text: `機能 ${index + 1} の説明`,
}));

describe("storyVaultClipSectioning", () => {
  it("normalizes AI cue boundaries into contiguous sections", () => {
    const sections = normalizeStoryVaultAiSections(
      [
        { endCueId: "cue-0006", title: "検索機能", summary: "検索の説明" },
        { endCueId: "missing", title: "無効", summary: "" },
      ],
      cues,
      120_000
    );

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ startMs: 0, endMs: 60_000, title: "検索機能" });
    expect(sections[1]).toMatchObject({ startMs: 60_000, endMs: 120_000 });
    expect(sectionSplitPointsMs(sections)).toEqual([60_000]);
  });

  it("falls back to roughly one-minute sections", () => {
    const sections = buildFallbackStoryVaultSections(cues, 120_000);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.endMs).toBe(60_000);
    expect(sections[1]?.startMs).toBe(60_000);
  });

  it("keeps short videos as one section", () => {
    expect(buildFallbackStoryVaultSections(cues.slice(0, 6), 60_000)).toHaveLength(1);
  });

  it("keeps the AI title for the final section", () => {
    const sections = normalizeStoryVaultAiSections(
      [
        { endCueId: "cue-0006", title: "検索機能", summary: "検索の説明" },
        { endCueId: "cue-0012", title: "保存機能", summary: "保存の説明" },
      ],
      cues,
      120_000
    );

    expect(sections[1]).toMatchObject({
      startMs: 60_000,
      endMs: 120_000,
      title: "保存機能",
    });
  });

  it("slices and shifts transcript cues for a prepared clip", () => {
    const sliced = sliceStoryVaultTranscriptCues(cues, 55_000, 75_000);

    expect(sliced).toHaveLength(3);
    expect(sliced[0]).toMatchObject({ index: 1, startMs: 0, endMs: 5_000 });
    expect(sliced[2]).toMatchObject({ index: 3, startMs: 15_000, endMs: 20_000 });
  });
});
