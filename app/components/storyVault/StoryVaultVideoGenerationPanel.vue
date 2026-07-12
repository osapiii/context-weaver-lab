<template>
  <section class="space-y-4">
    <EnAlert
      v-if="notice"
      color="error"
      title="動画エディターを開けませんでした"
      :description="notice"
    />

    <EnAlert
      v-else-if="hasCheckedPreparedProject && !hasPreparedProject && !canStartGeneration"
      color="warning"
      title="動画生成の準備がまだ完了していません"
      description="タイムスタンプ付き文字起こしとSRT字幕が揃うと、動画エディターを自動で開きます。"
    />

    <VideoStudioWorkspace embedded />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
const hasPreparedProject = ref(false);
const hasCheckedPreparedProject = ref(false);
const notice = ref("");
let initializationSequence = 0;

const videoStudioVideoId = computed(() => `storyvault_${props.video.id}`);
const preparedProjectId = computed(() => `storyvault_narration_${props.video.id}`);
const isEditorReady = computed(
  () =>
    videoStudio.view === "editor" &&
    videoStudio.selectedProject?.videoId === videoStudioVideoId.value
);

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

watch(
  () => [
    props.video.id,
    videoStudio.organizationId,
    videoStudio.spaceId,
    activeTranscriptSegments.value.length,
    activeTranscriptSrt.value,
    videoStudio.view,
    videoStudio.selectedProject?.id ?? "",
  ] as const,
  ([videoId], previous) => {
    if (previous?.[0] !== videoId) {
      initializationSequence += 1;
      isPreparing.value = false;
      hasPreparedProject.value = false;
      hasCheckedPreparedProject.value = false;
      notice.value = "";
    }
    void ensureVideoEditorOpen();
  },
  { immediate: true, flush: "post" }
);

async function ensureVideoEditorOpen(): Promise<void> {
  if (isEditorReady.value || isPreparing.value) return;
  if (
    videoStudio.selectedProject &&
    (videoStudio.selectedProject.videoId === videoStudioVideoId.value ||
      videoStudio.selectedProject.id === preparedProjectId.value)
  ) {
    videoStudio.view = "editor";
    return;
  }
  if (!videoStudio.organizationId || !videoStudio.spaceId) return;

  const sequence = ++initializationSequence;
  const targetVideoId = props.video.id;
  isPreparing.value = true;
  notice.value = "";
  try {
    try {
      await videoStudio.openProject(videoStudioVideoId.value, preparedProjectId.value);
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ナレーションプロジェクトが見つかりません。") {
        throw error;
      }
    }

    if (sequence !== initializationSequence || props.video.id !== targetVideoId) return;
    hasPreparedProject.value = false;
    hasCheckedPreparedProject.value = true;
    if (!canStartGeneration.value) return;
    await createVideoEditorProject();
  } catch (error) {
    if (sequence !== initializationSequence || props.video.id !== targetVideoId) return;
    notice.value =
      error instanceof Error
        ? error.message
        : "Video Studioへの登録に失敗しました。";
  } finally {
    if (sequence === initializationSequence) {
      isPreparing.value = false;
    }
  }
}

async function createVideoEditorProject(): Promise<void> {
  const clip = primaryClip.value;
  if (!clip || !canStartGeneration.value) return;
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
  });
  hasPreparedProject.value = true;
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
