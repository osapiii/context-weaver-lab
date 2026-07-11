import type { StoryVaultTranscriptCue } from "@models/storyVault";

export type StoryVaultClipSectionDraft = {
  startMs: number;
  endMs: number;
  title: string;
  summary: string;
  endCueId: string;
};

export type StoryVaultAiSectionCandidate = {
  endCueId: string;
  title: string;
  summary: string;
};

const compactText = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
};

const fallbackTitle = (
  cues: StoryVaultTranscriptCue[],
  startMs: number,
  endMs: number,
  index: number
): string => {
  const cue = cues.find(
    (item) => item.endMs > startMs && item.startMs < endMs && item.text.trim()
  );
  return compactText(cue?.text || `クリップ ${index + 1}`, 28);
};

export function buildFallbackStoryVaultSections(
  cues: StoryVaultTranscriptCue[],
  durationMs: number,
  targetDurationMs = 60_000
): StoryVaultClipSectionDraft[] {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);
  if (durationMs <= 0) return [];
  if (sorted.length === 0 || durationMs <= 90_000) {
    return [{
      startMs: 0,
      endMs: durationMs,
      title: fallbackTitle(sorted, 0, durationMs, 0),
      summary: "動画全体を1つのクリップとして取り込みます。",
      endCueId: sorted.at(-1)?.id || "",
    }];
  }

  const boundaryCueIds: string[] = [];
  let sectionStartMs = 0;
  let cueStartIndex = 0;
  while (durationMs - sectionStartMs > 90_000 && cueStartIndex < sorted.length) {
    const minEnd = sectionStartMs + 35_000;
    const targetEnd = sectionStartMs + targetDurationMs;
    const maxEnd = sectionStartMs + 90_000;
    const candidates = sorted
      .slice(cueStartIndex)
      .filter((cue) => cue.endMs >= minEnd && cue.endMs <= maxEnd);
    const selected = candidates.sort(
      (a, b) => Math.abs(a.endMs - targetEnd) - Math.abs(b.endMs - targetEnd)
    )[0];
    if (!selected) break;
    boundaryCueIds.push(selected.id);
    sectionStartMs = selected.endMs;
    cueStartIndex = sorted.findIndex((cue) => cue.id === selected.id) + 1;
  }

  return normalizeStoryVaultAiSections(
    boundaryCueIds.map((endCueId, index) => ({
      endCueId,
      title: "",
      summary: `約1分の説明区間 ${index + 1}`,
    })),
    sorted,
    durationMs
  );
}

export function normalizeStoryVaultAiSections(
  candidates: StoryVaultAiSectionCandidate[],
  cues: StoryVaultTranscriptCue[],
  durationMs: number
): StoryVaultClipSectionDraft[] {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);
  if (durationMs <= 0) return [];
  const cueById = new Map(sorted.map((cue) => [cue.id, cue]));
  const sections: StoryVaultClipSectionDraft[] = [];
  let startMs = 0;

  for (const candidate of candidates) {
    const cue = cueById.get(candidate.endCueId);
    if (!cue) continue;
    const isFinalCue = cue.id === sorted.at(-1)?.id;
    const endMs = isFinalCue
      ? durationMs
      : Math.min(durationMs, Math.max(startMs, cue.endMs));
    if (endMs - startMs < 20_000) continue;
    if (!isFinalCue && durationMs - endMs < 15_000) continue;
    sections.push({
      startMs,
      endMs,
      title:
        compactText(candidate.title, 42) ||
        fallbackTitle(sorted, startMs, endMs, sections.length),
      summary: compactText(candidate.summary, 120),
      endCueId: cue.id,
    });
    startMs = endMs;
    if (startMs >= durationMs) break;
  }

  if (startMs < durationMs) {
    const lastCue = sorted.at(-1);
    sections.push({
      startMs,
      endMs: durationMs,
      title: fallbackTitle(sorted, startMs, durationMs, sections.length),
      summary: "残りの説明をまとめた区間です。",
      endCueId: lastCue?.id || "",
    });
  }
  return sections;
}

export function sectionSplitPointsMs(
  sections: StoryVaultClipSectionDraft[]
): number[] {
  return sections.slice(0, -1).map((section) => section.endMs);
}

export function sliceStoryVaultTranscriptCues(
  cues: StoryVaultTranscriptCue[],
  startMs: number,
  endMs: number
): StoryVaultTranscriptCue[] {
  return [...cues]
    .sort((a, b) => a.startMs - b.startMs)
    .filter((cue) => cue.endMs > startMs && cue.startMs < endMs)
    .map((cue, index) => ({
      ...cue,
      id: `cue-${String(index + 1).padStart(4, "0")}`,
      index: index + 1,
      startMs: Math.max(0, cue.startMs - startMs),
      endMs: Math.max(0, Math.min(endMs, cue.endMs) - startMs),
    }))
    .filter((cue) => cue.endMs > cue.startMs);
}
