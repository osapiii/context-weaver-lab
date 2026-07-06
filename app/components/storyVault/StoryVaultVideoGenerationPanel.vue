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
            v-if="!hasPreparedProject"
            variant="ai"
            size="xs"
            leading-icon="material-symbols:movie-edit-outline"
            :loading="activeGenerationAction === 'start'"
            :global-loading="false"
            :disabled="!canStartGeneration"
            @click="openInVideoStudio('start')"
          >
            新しく始める
          </EnButton>
          <template v-else>
            <EnButton
              variant="ai"
              size="xs"
              leading-icon="material-symbols:resume"
              :loading="activeGenerationAction === 'resume'"
              :global-loading="false"
              :disabled="!canStartGeneration"
              @click="openInVideoStudio('resume')"
            >
              途中から再開
            </EnButton>
            <EnButton
              variant="outline"
              color="warning"
              size="xs"
              leading-icon="material-symbols:restart-alt"
              :loading="activeGenerationAction === 'restart'"
              :global-loading="false"
              :disabled="!canStartGeneration"
              @click="openInVideoStudio('restart')"
            >
              最初からやり直す
            </EnButton>
          </template>
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
      v-if="showPreparingOverlay"
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
      v-if="isEditorReady"
      embedded
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useVideoStudioStore } from "@stores/videoStudio";
import type { VideoStudioSection } from "@models/videoStudio";
import type {
  DecodedStoryVaultClip,
  StoryVaultOperationVideoClip,
  StoryVaultTranscriptCue,
} from "@models/storyVault";

const props = defineProps<{
  video: DecodedStoryVaultClip;
}>();

const videoStudio = useVideoStudioStore();
const isPreparing = ref(false);
const activeGenerationAction = ref<"start" | "resume" | "restart" | null>(null);
const hasPreparedProject = ref(false);
const notice = ref("");
const noticeKind = ref<"success" | "error">("success");

const videoStudioVideoId = computed(() => `storyvault_${props.video.id}`);
const preparedProjectId = computed(() => `storyvault_narration_${props.video.id}`);
const isEditorReady = computed(
  () =>
    videoStudio.view === "editor" &&
    videoStudio.selectedProject?.videoId === videoStudioVideoId.value
);
const showPreparingOverlay = computed(() => isPreparing.value && !isEditorReady.value);

const primaryClip = computed<StoryVaultOperationVideoClip | null>(() => {
  return {
    id: props.video.id,
    fileName: props.video.fileName,
    bucketName: props.video.bucketName,
    storagePath: props.video.storagePath,
    contentType: props.video.contentType,
    sizeBytes: props.video.sizeBytes,
    durationMs: props.video.durationMs,
    transcriptText: props.video.transcriptText,
    transcriptProvider: props.video.transcriptProvider,
    transcriptSummary: props.video.transcriptSummary,
    transcriptSegments: props.video.transcriptSegments ?? [],
    transcriptSrt: props.video.transcriptSrt,
    transcriptTimingStatus: props.video.transcriptTimingStatus ?? "unavailable",
    quickScan: props.video.quickScan,
    frameCaptures: props.video.frameCaptures ?? [],
    metadataFileName: props.video.metadataFileName,
    metadataStoragePath: props.video.metadataStoragePath,
    journeyFileName: props.video.journeyFileName,
    journeyStoragePath: props.video.journeyStoragePath,
    fileSpaceRequestId: props.video.fileSpaceRequestId,
    journeyFileSpaceRequestId: props.video.journeyFileSpaceRequestId,
    sourceAssetId: props.video.sourceAssetId,
    journeySourceAssetId: props.video.journeySourceAssetId,
    sourceDisplaySurface: props.video.sourceDisplaySurface,
    recordedAt: props.video.recordedAt,
  };
});

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

async function refreshPreparedProjectState(): Promise<void> {
  try {
    hasPreparedProject.value = await videoStudio.preparedProjectExists({
      videoId: videoStudioVideoId.value,
      projectId: preparedProjectId.value,
    });
  } catch {
    hasPreparedProject.value = false;
  }
}

onMounted(() => {
  void refreshPreparedProjectState();
});

watch(
  () => props.video.id,
  () => {
    hasPreparedProject.value = false;
    void refreshPreparedProjectState();
  }
);

async function openInVideoStudio(
  action: "start" | "resume" | "restart" = "resume"
): Promise<void> {
  const clip = primaryClip.value;
  if (!clip || !canStartGeneration.value) return;
  isPreparing.value = true;
  activeGenerationAction.value = action;
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
      tags: ["storyvault", props.video.applicationId].filter(Boolean),
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
      projectId: preparedProjectId.value,
      name: `${props.video.title || props.video.quickScan?.title || clip.fileName} 編集`,
      description:
        props.video.analysisResult?.operationIntent ||
        props.video.quickScan?.description ||
        props.video.description ||
        "StoryVaultの解析済み操作動画から作成した編集プロジェクト",
      voiceName: "Puck",
      sections: buildPreparedSections(clip),
      refreshPreparedSections: false,
      resetPreparedProject: action === "restart",
    });
    hasPreparedProject.value = true;
    noticeKind.value = "success";
    notice.value =
      action === "restart"
        ? "既存の動画プロジェクトを初期化して、最初から開きました。"
        : "解析済み字幕を読み込んで動画エディターを開きました。";
  } catch (error) {
    noticeKind.value = "error";
    notice.value =
      error instanceof Error
        ? error.message
        : "Video Studioへの登録に失敗しました。";
  } finally {
    isPreparing.value = false;
    activeGenerationAction.value = null;
  }
}

function buildPreparedSections(clip: StoryVaultOperationVideoClip): VideoStudioSection[] {
  const transcriptSegments = normalizedTranscriptSegments(activeTranscriptSegments.value);
  const durationSeconds = inferDurationSeconds(clip, transcriptSegments);
  const sections = buildTranscriptChapterSections(clip, transcriptSegments, durationSeconds);
  if (sections.length === 0) {
    throw new Error("動画生成にはタイムスタンプ付き文字起こしが必要です。");
  }
  return sections;
}

function buildTranscriptChapterSections(
  clip: StoryVaultOperationVideoClip,
  transcriptSegments: StoryVaultTranscriptCue[],
  durationSeconds: number
): VideoStudioSection[] {
  const groups = groupTranscriptCuesIntoChapters(transcriptSegments);

  return groups
    .map((group, index) => {
      const first = group[0];
      const last = group.at(-1);
      if (!first || !last) return null;
      const nextFirst = groups[index + 1]?.[0] ?? null;
      const startTime = clampTime(index === 0 ? 0 : first.startMs / 1000, durationSeconds);
      const rawEndTime = nextFirst
        ? nextFirst.startMs / 1000
        : Math.max(durationSeconds, last.endMs / 1000);
      const endTime = clampTime(Math.max(rawEndTime, startTime + 0.1), durationSeconds);
      const transcript = group.map((cue) => cue.text.trim()).filter(Boolean).join("\n");
      if (!transcript || endTime <= startTime) return null;
      return createPreparedSection({
        clip,
        id: `storyvault-chapter-${index + 1}`,
        index,
        title: chapterTitleFromTranscript(transcript, index),
        memo: "SRT字幕から作成したチャプター",
        startTime,
        endTime,
        transcript,
        transcriptCues: group,
      });
    })
    .filter((section): section is VideoStudioSection => Boolean(section));
}

function groupTranscriptCuesIntoChapters(
  transcriptSegments: StoryVaultTranscriptCue[]
): StoryVaultTranscriptCue[][] {
  const groups: StoryVaultTranscriptCue[][] = [];
  let current: StoryVaultTranscriptCue[] = [];
  const maxChapterSeconds = 46;
  const targetChapterSeconds = 34;
  const maxCueCount = 14;

  for (const cue of transcriptSegments) {
    const first = current[0];
    const last = current.at(-1);
    const currentDurationSeconds = first ? (cue.endMs - first.startMs) / 1000 : 0;
    const gapMs = last ? cue.startMs - last.endMs : 0;
    const shouldSplit =
      current.length > 0 &&
      (
        gapMs > 1800 ||
        current.length >= maxCueCount ||
        currentDurationSeconds > maxChapterSeconds ||
        (
          currentDurationSeconds >= targetChapterSeconds &&
          last !== undefined &&
          isNaturalChapterBreak(last.text, cue.text)
        )
      );
    if (shouldSplit) {
      groups.push(current);
      current = [];
    }
    current.push(cue);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function isNaturalChapterBreak(previousText: string, nextText: string): boolean {
  const previous = previousText.trim();
  const next = nextText.trim();
  if (!previous) return false;
  if (/[。！？!?]$/.test(previous)) return true;
  if (/(できます|しました|します|です|ます|でした|ました)$/.test(previous)) return true;
  if (/^(その|次に|続いて|ここから|これで|では|また|一方で|最後に)/.test(next)) return true;
  return false;
}

function groupChapterCuesForNarration(
  cues: StoryVaultTranscriptCue[]
): StoryVaultTranscriptCue[][] {
  const groups: StoryVaultTranscriptCue[][] = [];
  let current: StoryVaultTranscriptCue[] = [];
  const maxNarrationSeconds = 18;
  const targetNarrationSeconds = 10;
  const maxCueCount = 5;

  for (const cue of cues) {
    const first = current[0];
    const last = current.at(-1);
    const durationSeconds = first ? (cue.endMs - first.startMs) / 1000 : 0;
    const shouldSplit =
      current.length > 0 &&
      (
        current.length >= maxCueCount ||
        durationSeconds > maxNarrationSeconds ||
        (
          durationSeconds >= targetNarrationSeconds &&
          last !== undefined &&
          isNaturalChapterBreak(last.text, cue.text)
        )
      );
    if (shouldSplit) {
      groups.push(current);
      current = [];
    }
    current.push(cue);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function createPreparedSection(params: {
  clip: StoryVaultOperationVideoClip;
  id: string;
  index: number;
  title: string;
  memo?: string;
  startTime: number;
  endTime: number;
  transcript: string;
  transcriptCues: StoryVaultTranscriptCue[];
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
  const narrationGroups = groupChapterCuesForNarration(params.transcriptCues);
  return {
    id: params.id,
    index: params.index,
    title: params.title,
    memo: params.memo,
    sourceKind: "transcript_chapter",
    sourceTranscriptCueIds: params.transcriptCues.map((cue) => cue.id),
    sourceTranscriptCues: params.transcriptCues.map((cue) => ({
      id: cue.id,
      sourceId: params.clip.id,
      index: cue.index,
      startMs: cue.startMs,
      endMs: cue.endMs,
      text: cue.text,
      confidence: cue.confidence,
    })),
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
      ...narrationGroups.map((group, index) => {
        const first = group[0]!;
        const last = group.at(-1)!;
        const text = group.map((cue) => cue.text.trim()).filter(Boolean).join("\n");
        const startSeconds = Math.max(0, first.startMs / 1000 - params.startTime);
        const endSeconds = Math.max(startSeconds, last.endMs / 1000 - params.startTime);
        return {
          id: `narration-${params.id}-${index + 1}`,
          originalText: text,
          rewrittenText: text,
          start: formatClock(startSeconds),
          startSeconds,
          endSeconds,
          characterCount: text.length,
          isTtsGenerated: false,
        };
      }),
    ],
    isFixed: false,
  };
}

function normalizedTranscriptSegments(
  segments: StoryVaultTranscriptCue[]
): StoryVaultTranscriptCue[] {
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
  clip: StoryVaultOperationVideoClip,
  transcriptSegments: StoryVaultTranscriptCue[]
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

function chapterTitleFromTranscript(transcript: string, index: number): string {
  const firstLine = transcript
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
  return firstLine ? `Chapter ${index + 1}: ${firstLine}` : `Chapter ${index + 1}`;
}

function formatClock(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const restSeconds = totalSeconds % 60;
  return `${minutes}:${String(restSeconds).padStart(2, "0")}`;
}
</script>
