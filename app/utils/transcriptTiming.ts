export type TranscriptCueLike = {
  id?: string;
  index?: number;
  startMs?: number;
  endMs?: number;
  text?: string;
  confidence?: number;
};

const SRT_TIME_RE =
  /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/;

const pad = (value: number, size = 2): string =>
  String(Math.max(0, Math.floor(value))).padStart(size, "0");

export const formatTranscriptTime = (ms: number): string => {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = safeMs % 1000;
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`
    : `${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
};

const formatSrtTime = (ms: number): string => {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = safeMs % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
};

const parseSrtPart = (
  hour: string | undefined,
  minute: string,
  second: string,
  millis: string
): number => {
  const hours = Number(hour || 0);
  const minutes = Number(minute || 0);
  const seconds = Number(second || 0);
  const ms = Number(millis.padEnd(3, "0").slice(0, 3));
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + ms;
};

export const parseSrtTranscript = (srt?: string): TranscriptCueLike[] => {
  const raw = srt?.trim();
  if (!raw) return [];
  const cues: TranscriptCueLike[] = [];
  raw.split(/\n\s*\n/g).forEach((block, blockIndex) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const timeLineIndex = lines.findIndex((line) => SRT_TIME_RE.test(line));
    if (timeLineIndex < 0) return;
    const timeLine = lines[timeLineIndex];
    if (!timeLine) return;
    const match = timeLine.match(SRT_TIME_RE);
    if (!match?.[2] || !match[3] || !match[4] || !match[6] || !match[7] || !match[8]) {
      return;
    }
    const text = lines.slice(timeLineIndex + 1).join(" ").trim();
    if (!text) return;
    cues.push({
      id: `cue-${String(blockIndex + 1).padStart(4, "0")}`,
      index: blockIndex + 1,
      startMs: parseSrtPart(match[1], match[2], match[3], match[4]),
      endMs: parseSrtPart(match[5], match[6], match[7], match[8]),
      text,
    });
  });
  return cues;
};

export const normalizeTranscriptCues = (
  cues?: TranscriptCueLike[] | null
): TranscriptCueLike[] => {
  const normalized: TranscriptCueLike[] = [];
  (cues ?? []).forEach((cue, index) => {
    const startMs = Math.max(0, Math.round(Number(cue.startMs ?? 0)));
    const endMs = Math.max(startMs, Math.round(Number(cue.endMs ?? startMs)));
    const text = String(cue.text ?? "").trim();
    if (!text) return;
    normalized.push({
      id: cue.id?.trim() || `cue-${String(index + 1).padStart(4, "0")}`,
      index: Number.isFinite(cue.index) ? Number(cue.index) : index + 1,
      startMs,
      endMs,
      text,
      confidence:
        typeof cue.confidence === "number" && Number.isFinite(cue.confidence)
          ? cue.confidence
          : undefined,
    });
  });
  return normalized;
};

export const transcriptCuesToSrt = (cues?: TranscriptCueLike[] | null): string =>
  normalizeTranscriptCues(cues)
    .map((cue, index) =>
      [
        String(index + 1),
        `${formatSrtTime(cue.startMs ?? 0)} --> ${formatSrtTime(cue.endMs ?? 0)}`,
        cue.text,
      ].join("\n")
    )
    .join("\n\n");
