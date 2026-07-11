export type StoryVaultSilenceRange = {
  startMs: number;
  endMs: number;
};

export type StoryVaultAudioLevelSample = {
  startMs: number;
  endMs: number;
  db: number;
};

export type StoryVaultAudioTimelineAnalysis = {
  silenceRanges: StoryVaultSilenceRange[];
  levelSamples: StoryVaultAudioLevelSample[];
};

export function normalizeStoryVaultCutRanges(
  ranges: StoryVaultSilenceRange[],
  durationMs?: number
): StoryVaultSilenceRange[] {
  const maximum = Number.isFinite(durationMs) ? Math.max(0, durationMs ?? 0) : Infinity;
  const sorted = ranges
    .map((range) => ({
      startMs: Math.max(0, Math.min(maximum, Number(range.startMs) || 0)),
      endMs: Math.max(0, Math.min(maximum, Number(range.endMs) || 0)),
    }))
    .filter((range) => range.endMs > range.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  return sorted.reduce<StoryVaultSilenceRange[]>((merged, range) => {
    const previous = merged.at(-1);
    if (!previous || range.startMs > previous.endMs) {
      merged.push({ ...range });
      return merged;
    }
    previous.endMs = Math.max(previous.endMs, range.endMs);
    return merged;
  }, []);
}

export function mergeNearbyStoryVaultSilenceRanges(
  ranges: StoryVaultSilenceRange[],
  maximumGapMs = 10_000
): StoryVaultSilenceRange[] {
  const gapLimitMs = Math.max(0, Number(maximumGapMs) || 0);
  const sorted = normalizeStoryVaultCutRanges(ranges);

  return sorted.reduce<StoryVaultSilenceRange[]>((merged, range) => {
    const previous = merged.at(-1);
    if (!previous || range.startMs - previous.endMs > gapLimitMs) {
      merged.push({ ...range });
      return merged;
    }
    previous.endMs = Math.max(previous.endMs, range.endMs);
    return merged;
  }, []);
}

type SilenceAnalysisOptions = {
  thresholdDb?: number;
  minSilenceMs?: number;
  keepPaddingMs?: number;
};

export async function analyzeAudioSilence(
  blob: Blob,
  options: SilenceAnalysisOptions = {}
): Promise<StoryVaultSilenceRange[]> {
  return (await analyzeAudioTimeline(blob, options)).silenceRanges;
}

export async function analyzeAudioTimeline(
  blob: Blob,
  options: SilenceAnalysisOptions = {}
): Promise<StoryVaultAudioTimelineAnalysis> {
  if (!import.meta.client || blob.size === 0) {
    return { silenceRanges: [], levelSamples: [] };
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return { silenceRanges: [], levelSamples: [] };
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const threshold = 10 ** ((options.thresholdDb ?? -38) / 20);
    const minSilenceMs = options.minSilenceMs ?? 5_000;
    const keepPaddingMs = options.keepPaddingMs ?? 180;
    const windowMs = 100;
    const samplesPerWindow = Math.max(1, Math.round(buffer.sampleRate * windowMs / 1000));
    const sampleStride = Math.max(1, Math.floor(buffer.sampleRate / 6000));
    const silentWindows: boolean[] = [];
    const levelSamples: StoryVaultAudioLevelSample[] = [];

    for (let offset = 0; offset < buffer.length; offset += samplesPerWindow) {
      const end = Math.min(buffer.length, offset + samplesPerWindow);
      let squareTotal = 0;
      let sampleCount = 0;
      for (let sample = offset; sample < end; sample += sampleStride) {
        let mixed = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
          mixed += Math.abs(buffer.getChannelData(channel)[sample] ?? 0);
        }
        mixed /= Math.max(1, buffer.numberOfChannels);
        squareTotal += mixed * mixed;
        sampleCount += 1;
      }
      const rms = Math.sqrt(squareTotal / Math.max(1, sampleCount));
      const startMs = offset / buffer.sampleRate * 1000;
      levelSamples.push({
        startMs,
        endMs: Math.min(buffer.duration * 1000, startMs + windowMs),
        db: Math.max(-72, 20 * Math.log10(Math.max(rms, 0.000001))),
      });
      silentWindows.push(rms < threshold);
    }

    const ranges: StoryVaultSilenceRange[] = [];
    let startWindow: number | null = null;
    for (let index = 0; index <= silentWindows.length; index += 1) {
      if (silentWindows[index] && startWindow === null) startWindow = index;
      if ((!silentWindows[index] || index === silentWindows.length) && startWindow !== null) {
        const detectedStartMs = startWindow * windowMs;
        const detectedEndMs = Math.min(buffer.duration * 1000, index * windowMs);
        if (detectedEndMs - detectedStartMs >= minSilenceMs) {
          const startMs = detectedStartMs + keepPaddingMs;
          const endMs = detectedEndMs - keepPaddingMs;
          if (endMs > startMs) ranges.push({ startMs, endMs });
        }
        startWindow = null;
      }
    }
    return {
      silenceRanges: mergeNearbyStoryVaultSilenceRanges(ranges),
      levelSamples,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

export function editedStoryVaultDurationMs(
  durationMs: number,
  silenceRanges: StoryVaultSilenceRange[],
  silenceCutEnabled: boolean
): number {
  if (!silenceCutEnabled) return durationMs;
  const removedMs = normalizeStoryVaultCutRanges(silenceRanges, durationMs).reduce(
    (total, range) => total + Math.max(0, range.endMs - range.startMs),
    0
  );
  return Math.max(0, durationMs - removedMs);
}
