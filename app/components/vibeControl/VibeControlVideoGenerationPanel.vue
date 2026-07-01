<template>
  <section class="space-y-4">
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
            <UIcon name="material-symbols:movie-edit-outline" class="h-5 w-5 text-slate-500" />
            動画生成
          </h4>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            この操作動画をVideo Studio素材として登録し、ナレーション、字幕、無音カット、書き出しを行います。
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <EnButton
            variant="ai"
            size="xs"
            leading-icon="material-symbols:movie-edit-outline"
            :loading="isPreparing"
            :disabled="!canStartGeneration"
            @click="openInVideoStudio"
          >
            この動画で生成を開始
          </EnButton>
        </div>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">素材</p>
          <p class="mt-1 truncate text-sm font-bold text-slate-950">{{ primaryClip?.fileName || video.fileName }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">時間</p>
          <p class="mt-1 text-sm font-bold text-slate-950">{{ durationLabel }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">字幕素材</p>
          <p class="mt-1 text-sm font-bold text-slate-950">{{ transcriptLabel }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Video Studio ID</p>
          <p class="mt-1 truncate text-sm font-bold text-slate-950">{{ videoStudioVideoId }}</p>
        </div>
      </div>

      <EnAlert
        v-if="notice"
        class="mt-4"
        :color="noticeKind === 'error' ? 'error' : 'success'"
        :title="notice"
      />
    </div>

    <div
      v-if="isPreparing"
      class="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div class="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 text-center shadow-2xl">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
          <UIcon name="material-symbols:movie-edit-outline" class="h-7 w-7" />
        </div>
        <h4 class="mt-4 text-lg font-bold text-slate-950">動画エディターを準備しています</h4>
        <p class="mt-2 text-sm leading-6 text-slate-600">
          解析済みの字幕とストーリー根拠から、編集セクションを読み込んでいます。
        </p>
        <div class="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full w-2/3 animate-pulse rounded-full bg-teal-500" />
        </div>
      </div>
    </div>

    <VideoStudioWorkspace
      v-if="videoStudio.view === 'editor' && videoStudio.selectedProject?.videoId === videoStudioVideoId"
      embedded
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useVideoStudioStore } from "@stores/videoStudio";
import type { VideoStudioSection } from "@models/videoStudio";
import type {
  DecodedVibeControlOperationVideo,
  VibeControlOperationVideoClip,
  VibeControlTranscriptCue,
} from "@models/vibeControl";

const props = defineProps<{
  video: DecodedVibeControlOperationVideo;
}>();

const videoStudio = useVideoStudioStore();
const isPreparing = ref(false);
const notice = ref("");
const noticeKind = ref<"success" | "error">("success");

const primaryClip = computed<VibeControlOperationVideoClip | null>(() => {
  const clips = props.video.clips;
  return [...clips].sort((a, b) => (a.recordedAt || "").localeCompare(b.recordedAt || ""))[0] ?? null;
});

const videoStudioVideoId = computed(() => `vibe_${props.video.id}`);

const durationLabel = computed(() => {
  const ms = primaryClip.value?.durationMs ?? props.video.durationMs ?? 0;
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
});

const transcriptLabel = computed(() =>
  activeTranscriptSegments.value.length > 0 && activeTranscriptSrt.value
    ? "SRT字幕あり"
    : "SRT字幕なし"
);

const activeTranscriptSegments = computed(() =>
  primaryClip.value?.transcriptSegments?.length
    ? primaryClip.value.transcriptSegments
    : props.video.transcriptSegments
);

const activeTranscriptSrt = computed(() =>
  primaryClip.value?.transcriptSrt || props.video.transcriptSrt || ""
);

const canStartGeneration = computed(() =>
  Boolean(primaryClip.value) &&
  activeTranscriptSegments.value.length > 0 &&
  Boolean(activeTranscriptSrt.value)
);

async function openInVideoStudio(): Promise<void> {
  const clip = primaryClip.value;
  if (!clip || !canStartGeneration.value) return;
  isPreparing.value = true;
  notice.value = "";
  try {
    const transcriptSegments = normalizedTranscriptSegments(activeTranscriptSegments.value);
    await videoStudio.createStorageBackedVideo({
      videoId: videoStudioVideoId.value,
      title: props.video.title || props.video.quickScan?.title || clip.fileName,
      description:
        props.video.analysisResult?.operationIntent ||
        props.video.quickScan?.description ||
        props.video.description,
      tags: ["vibe-control", props.video.applicationId].filter(Boolean),
      storageBucket: clip.bucketName,
      storagePath: clip.storagePath,
      fileName: clip.fileName,
      contentType: clip.contentType,
      duration: (clip.durationMs ?? props.video.durationMs ?? 0) / 1000,
      sourceType: "screen_recording",
      transcriptSegments,
      transcriptSrt: activeTranscriptSrt.value,
      openAfterCreate: false,
    });
    await videoStudio.openVideo(videoStudioVideoId.value);
    if (!videoStudio.selectedVideo) {
      throw new Error("Video Studio素材を読み込めませんでした。");
    }
    await videoStudio.createOrOpenPreparedProject({
      video: videoStudio.selectedVideo,
      projectId: `vibe_narration_${props.video.id}`,
      name: `${props.video.title || props.video.quickScan?.title || clip.fileName} 編集`,
      description:
        props.video.analysisResult?.operationIntent ||
        props.video.quickScan?.description ||
        props.video.description ||
        "Vibe Controlの解析済み操作動画から作成した編集プロジェクト",
      voiceName: "Puck",
      sections: buildPreparedSections(clip),
      refreshPreparedSections: true,
    });
    noticeKind.value = "success";
    notice.value = "解析済み字幕を読み込んで動画エディターを開きました。";
  } catch (error) {
    noticeKind.value = "error";
    notice.value =
      error instanceof Error
        ? error.message
        : "Video Studioへの登録に失敗しました。";
  } finally {
    isPreparing.value = false;
  }
}

function buildPreparedSections(clip: VibeControlOperationVideoClip): VideoStudioSection[] {
  const transcriptSegments = normalizedTranscriptSegments(activeTranscriptSegments.value);
  const durationSeconds = inferDurationSeconds(clip, transcriptSegments);
  const sections = buildStorySections(clip, transcriptSegments, durationSeconds);
  const fallbackSections =
    sections.length > 0
      ? sections
      : buildTranscriptCueSections(clip, transcriptSegments, durationSeconds);
  if (fallbackSections.length === 0) {
    throw new Error("動画生成にはタイムスタンプ付き文字起こしが必要です。");
  }
  return fallbackSections;
}

function buildStorySections(
  clip: VibeControlOperationVideoClip,
  transcriptSegments: VibeControlTranscriptCue[],
  durationSeconds: number
): VideoStudioSection[] {
  const sections = (props.video.analysisResult?.storyCandidates ?? [])
    .map((story, storyIndex) => {
      const evidence = story.evidence.find((item) =>
        !item.videoId ||
        item.videoId === props.video.id ||
        item.videoId === clip.id
      ) ?? story.evidence[0];
      if (!evidence) return null;
      const [rawStart = 0, rawEnd = rawStart + 1] = evidence.tRange;
      const startTime = clampTime(rawStart, durationSeconds);
      const endTime = clampTime(Math.max(rawEnd, startTime + 1), durationSeconds);
      if (endTime <= startTime) return null;
      const cueText = transcriptTextForCueIds(transcriptSegments, evidence.transcriptCueIds);
      const transcript = evidence.transcriptQuote || cueText;
      if (!transcript.trim()) return null;
      return createPreparedSection({
        clip,
        id: `vibe-story-${story.id}`,
        index: storyIndex,
        title: story.title,
        memo: evidence.summary,
        startTime,
        endTime,
        transcript,
      });
    })
    .filter((section): section is VideoStudioSection => Boolean(section));
  return sections.map((section, index) => ({ ...section, index }));
}

function buildTranscriptCueSections(
  clip: VibeControlOperationVideoClip,
  transcriptSegments: VibeControlTranscriptCue[],
  durationSeconds: number
): VideoStudioSection[] {
  const groups: VibeControlTranscriptCue[][] = [];
  let current: VibeControlTranscriptCue[] = [];
  const maxSectionSeconds = 45;
  const maxCueCount = 12;

  for (const cue of transcriptSegments) {
    const first = current[0];
    const last = current.at(-1);
    const wouldExceedDuration =
      first && cue.endMs / 1000 - first.startMs / 1000 > maxSectionSeconds;
    const hasLargeGap = last && cue.startMs - last.endMs > 1800;
    if (current.length > 0 && (wouldExceedDuration || hasLargeGap || current.length >= maxCueCount)) {
      groups.push(current);
      current = [];
    }
    current.push(cue);
  }
  if (current.length > 0) groups.push(current);

  return groups
    .map((group, index) => {
      const first = group[0];
      const last = group.at(-1);
      if (!first || !last) return null;
      const startTime = clampTime(first.startMs / 1000, durationSeconds);
      const endTime = clampTime(Math.max(last.endMs / 1000, startTime + 1), durationSeconds);
      const transcript = group.map((cue) => cue.text.trim()).filter(Boolean).join("\n");
      if (!transcript || endTime <= startTime) return null;
      return createPreparedSection({
        clip,
        id: `vibe-transcript-${index + 1}`,
        index,
        title: sectionTitleFromTranscript(transcript, index),
        memo: "タイムスタンプ付き文字起こしから自動分割",
        startTime,
        endTime,
        transcript,
      });
    })
    .filter((section): section is VideoStudioSection => Boolean(section));
}

function createPreparedSection(params: {
  clip: VibeControlOperationVideoClip;
  id: string;
  index: number;
  title: string;
  memo?: string;
  startTime: number;
  endTime: number;
  transcript: string;
}): VideoStudioSection {
  const durationSeconds = Math.max(0, params.endTime - params.startTime);
  const segmentInfo = {
    bucketName: params.clip.bucketName,
    gcsFilePath: params.clip.storagePath,
    segmentNumber: params.index,
    startTime: params.startTime,
    endTime: params.endTime,
    duration: durationSeconds,
    sizeBytes: params.clip.sizeBytes ?? 0,
  };
  return {
    id: params.id,
    index: params.index,
    title: params.title,
    memo: params.memo,
    startTime: params.startTime,
    endTime: params.endTime,
    videoSegment: segmentInfo,
    splitVideo: segmentInfo,
    recording: {
      recordingId: `source-transcript-${params.id}`,
      audioBucketName: params.clip.bucketName,
      audioFilePath: params.clip.storagePath,
      audioContentType: params.clip.contentType || "video/webm",
      audioSizeBytes: params.clip.sizeBytes ?? 0,
      durationSeconds,
      waveform: [],
      transcriptionStatus: "completed",
      transcript: params.transcript,
    },
    finalyNarrations: [
      {
        id: `narration-${params.id}`,
        originalText: params.transcript,
        rewrittenText: params.transcript,
        start: formatClock(params.startTime),
        startSeconds: params.startTime,
        endSeconds: params.endTime,
        characterCount: params.transcript.length,
        isTtsGenerated: false,
      },
    ],
    isFixed: false,
  };
}

function transcriptTextForCueIds(
  transcriptSegments: VibeControlTranscriptCue[],
  cueIds: string[]
): string {
  if (cueIds.length === 0) return "";
  const ids = new Set(cueIds);
  return transcriptSegments
    .filter((cue) =>
      ids.has(cue.id) ||
      Array.from(ids).some((id) => id === `${primaryClip.value?.id}:${cue.id}` || id.endsWith(`:${cue.id}`))
    )
    .map((cue) => cue.text)
    .join("\n");
}

function normalizedTranscriptSegments(
  segments: VibeControlTranscriptCue[]
): VibeControlTranscriptCue[] {
  return [...segments]
    .map((segment, index) => {
      const startMs = Number(segment.startMs);
      const endMs = Number(segment.endMs);
      return {
        ...segment,
        index: Number.isFinite(segment.index) ? segment.index : index + 1,
        startMs: Number.isFinite(startMs) ? Math.max(0, startMs) : 0,
        endMs: Number.isFinite(endMs) ? Math.max(0, endMs) : 0,
        text: segment.text?.trim() ?? "",
      };
    })
    .filter((segment) => segment.text && segment.endMs > segment.startMs)
    .sort((a, b) => a.startMs - b.startMs);
}

function inferDurationSeconds(
  clip: VibeControlOperationVideoClip,
  transcriptSegments: VibeControlTranscriptCue[]
): number {
  const explicitDuration = Number(clip.durationMs ?? props.video.durationMs ?? 0) / 1000;
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) return explicitDuration;
  const lastCueEnd = transcriptSegments.at(-1)?.endMs ?? 0;
  return Math.max(0, lastCueEnd / 1000);
}

function clampTime(value: number, durationSeconds: number): number {
  if (!Number.isFinite(value)) return 0;
  if (durationSeconds <= 0) return Math.max(0, value);
  return Math.min(Math.max(0, value), durationSeconds);
}

function sectionTitleFromTranscript(transcript: string, index: number): string {
  const firstLine = transcript
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
  return firstLine ? `${index + 1}. ${firstLine}` : `セクション ${index + 1}`;
}

function formatClock(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const restSeconds = totalSeconds % 60;
  return `${minutes}:${String(restSeconds).padStart(2, "0")}`;
}
</script>
