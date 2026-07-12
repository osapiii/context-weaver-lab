import { describe, expect, it } from "vitest";
import {
  editedStoryVaultDurationMs,
  mergeNearbyStoryVaultSilenceRanges,
  normalizeStoryVaultCutRanges,
} from "./storyVaultClipEditing";

describe("storyVaultClipEditing", () => {
  it("subtracts detected silence from the edited duration", () => {
    expect(
      editedStoryVaultDurationMs(
        60_000,
        [
          { startMs: 10_000, endMs: 15_000 },
          { startMs: 40_000, endMs: 42_000 },
        ],
        true
      )
    ).toBe(53_000);
  });

  it("keeps the original duration when silence cutting is skipped", () => {
    expect(
      editedStoryVaultDurationMs(
        60_000,
        [{ startMs: 10_000, endMs: 20_000 }],
        false
      )
    ).toBe(60_000);
  });

  it("merges overlapping automatic and manual cut ranges", () => {
    expect(
      normalizeStoryVaultCutRanges(
        [
          { startMs: 8_000, endMs: 14_000 },
          { startMs: 10_000, endMs: 18_000 },
          { startMs: -500, endMs: 1_000 },
          { startMs: 58_000, endMs: 64_000 },
        ],
        60_000
      )
    ).toEqual([
      { startMs: 0, endMs: 1_000 },
      { startMs: 8_000, endMs: 18_000 },
      { startMs: 58_000, endMs: 60_000 },
    ]);
  });

  it("does not subtract overlapping ranges twice", () => {
    expect(
      editedStoryVaultDurationMs(
        60_000,
        [
          { startMs: 10_000, endMs: 20_000 },
          { startMs: 15_000, endMs: 25_000 },
        ],
        true
      )
    ).toBe(45_000);
  });

  it("merges silence ranges separated by no more than 10 seconds", () => {
    expect(
      mergeNearbyStoryVaultSilenceRanges([
        { startMs: 5_000, endMs: 15_000 },
        { startMs: 25_000, endMs: 32_000 },
        { startMs: 41_999, endMs: 50_000 },
      ])
    ).toEqual([{ startMs: 5_000, endMs: 50_000 }]);
  });

  it("keeps silence ranges separate when the gap is longer than 10 seconds", () => {
    expect(
      mergeNearbyStoryVaultSilenceRanges([
        { startMs: 5_000, endMs: 15_000 },
        { startMs: 25_001, endMs: 32_000 },
      ])
    ).toEqual([
      { startMs: 5_000, endMs: 15_000 },
      { startMs: 25_001, endMs: 32_000 },
    ]);
  });
});
