<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-slate-900">操作動画</h2>
        <p class="mt-1 text-xs text-slate-500">
          {{ application?.fileSpaceId ? application.fileSpaceId : "FileSpace未設定" }}
        </p>
      </div>
      <EnBadge
        :color="isRecording ? 'error' : videos.length > 0 ? 'success' : 'neutral'"
        variant="soft"
      >
        {{ isRecording ? "録画中" : `${videos.length}件` }}
      </EnBadge>
    </div>

    <EnAlert
      v-if="errorMessage"
      class="mt-4"
      color="warning"
      :title="errorMessage"
    />

    <EnAlert
      v-if="surfaceWarning"
      class="mt-4"
      color="warning"
      :title="surfaceWarning"
    />

    <EnAlert
      v-if="application && !application.fileSpaceId"
      class="mt-4"
      color="warning"
      title="アプリ専用FileSpaceが未作成です"
      description="録画は開始できます。保存とDiscoveryEngine登録には専用FileSpaceが必要です。"
    >
      <template #actions>
        <EnButton
          variant="ai"
          size="xs"
          leading-icon="material-symbols:add-circle-outline"
          :loading="isProvisioningFileSpace"
          :disabled="application.fileSpaceProvisioningStatus === 'creating'"
          @click="$emit('create-file-space')"
        >
          専用FileSpace作成
        </EnButton>
      </template>
    </EnAlert>

    <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div class="space-y-3">
        <div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
          <video
            v-if="previewUrl"
            :src="previewUrl"
            controls
            class="aspect-video w-full bg-slate-950"
          />
          <div
            v-else
            class="flex aspect-video items-center justify-center bg-slate-950 text-sm text-slate-300"
          >
            <div class="flex items-center gap-2">
              <UIcon
                name="material-symbols:video-camera-back-outline"
                class="h-5 w-5"
              />
              <span>{{ isRecording ? elapsedLabel : "No preview" }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span class="font-semibold text-slate-700">{{ elapsedLabel }}</span>
            <span v-if="sourceDisplaySurfaceLabel">/ {{ sourceDisplaySurfaceLabel }}</span>
            <span v-if="recordedBlob">/ {{ formatBytes(recordedBlob.size) }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <EnButton
              v-if="!isRecording"
              variant="outline"
              color="neutral"
              size="sm"
              leading-icon="material-symbols:window-outline"
              :disabled="!canCapture || isSaving"
              @click="startCapture"
            >
              Window選択
            </EnButton>
            <EnButton
              v-else
              variant="soft"
              color="error"
              size="sm"
              leading-icon="material-symbols:stop-circle-outline"
              @click="stopCapture"
            >
              停止
            </EnButton>
          </div>
        </div>
      </div>

      <form
        class="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
        @submit.prevent="saveRecording"
      >
        <label class="block">
          <span class="text-xs font-medium text-slate-600">タイトル</span>
          <input
            v-model="title"
            type="text"
            class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            placeholder="ログイン導線の操作確認"
          >
        </label>
        <label class="block">
          <span class="text-xs font-medium text-slate-600">説明</span>
          <textarea
            v-model="description"
            rows="5"
            class="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            placeholder="確認した操作、期待結果、気づいた差分"
          />
        </label>
        <div class="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
          <EnButton
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="isRecording || isSaving"
            @click="resetRecording"
          >
            クリア
          </EnButton>
          <EnButton
            variant="ai"
            size="sm"
            leading-icon="material-symbols:save-outline"
            :disabled="!canSave"
            :loading="isSaving"
            @click="saveRecording"
          >
            保存
          </EnButton>
        </div>
      </form>
    </div>

    <div class="mt-5 border-t border-slate-100 pt-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Library
        </h3>
        <EnButton
          variant="ghost"
          color="neutral"
          size="xs"
          leading-icon="material-symbols:refresh"
          @click="$emit('refresh')"
        >
          再読込
        </EnButton>
      </div>

      <div
        v-if="videos.length === 0"
        class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
      >
        保存済みの操作動画はありません
      </div>

      <div
        v-else
        class="grid gap-3 lg:grid-cols-2"
      >
        <article
          v-for="video in videos"
          :key="video.id"
          class="overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <video
            v-if="videoUrls[video.id]"
            :src="videoUrls[video.id]"
            controls
            preload="metadata"
            class="aspect-video w-full bg-slate-950"
          />
          <div
            v-else
            class="flex aspect-video items-center justify-center bg-slate-950 text-xs text-slate-300"
          >
            URL loading
          </div>
          <div class="space-y-2 p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h4 class="truncate text-sm font-semibold text-slate-900">
                  {{ video.title }}
                </h4>
                <p class="mt-1 text-xs text-slate-500">
                  {{ formatRecordedAt(video.recordedAt) }}
                </p>
              </div>
              <EnBadge
                :color="discoveryColor(video.discoveryStatus)"
                variant="soft"
              >
                {{ discoveryLabel(video.discoveryStatus) }}
              </EnBadge>
            </div>
            <p
              v-if="video.description"
              class="line-clamp-2 text-xs leading-relaxed text-slate-600"
            >
              {{ video.description }}
            </p>
            <div class="flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span>{{ formatDuration(video.durationMs) }}</span>
              <span>{{ formatBytes(video.sizeBytes) }}</span>
              <span>{{ displaySurfaceLabel(video.sourceDisplaySurface) }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { getDownloadURL } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import type {
  DecodedVibeControlApplication,
  DecodedVibeControlOperationVideo,
  VibeControlOperationVideoDiscoveryStatus,
  VibeControlOperationVideoDisplaySurface,
} from "@models/vibeControl";
import type { VibeControlOperationVideoSaveInput } from "@stores/vibeControl";

const props = defineProps<{
  application: DecodedVibeControlApplication | null;
  videos: DecodedVibeControlOperationVideo[];
  isSaving: boolean;
  isProvisioningFileSpace?: boolean;
}>();

const emit = defineEmits<{
  save: [input: VibeControlOperationVideoSaveInput];
  "create-file-space": [];
  refresh: [];
}>();

const title = ref("");
const description = ref("");
const errorMessage = ref("");
const sourceDisplaySurface = ref<VibeControlOperationVideoDisplaySurface>("unknown");
const isRecording = ref(false);
const elapsedMs = ref(0);
const recordedDurationMs = ref<number | undefined>();
const recordedBlob = ref<Blob | null>(null);
const previewUrl = ref("");
const videoUrls = reactive<Record<string, string>>({});

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let startedAt = 0;
let elapsedTimer: number | null = null;
let chunks: BlobPart[] = [];

const canCapture = computed(
  () => Boolean(props.application?.id) && !props.isSaving
);
const canSave = computed(
  () =>
    Boolean(props.application?.id) &&
    Boolean(props.application?.fileSpaceId) &&
    Boolean(recordedBlob.value) &&
    title.value.trim().length > 0 &&
    !isRecording.value &&
    !props.isSaving
);

const elapsedLabel = computed(() => formatDuration(elapsedMs.value));
const sourceDisplaySurfaceLabel = computed(() =>
  displaySurfaceLabel(sourceDisplaySurface.value)
);
const surfaceWarning = computed(() => {
  if (!isRecording.value && !recordedBlob.value) return "";
  if (sourceDisplaySurface.value === "window") return "";
  if (sourceDisplaySurface.value === "unknown") return "";
  return "Window以外が選択されている可能性があります";
});

watch(
  () => props.application,
  (application) => {
    if (!application) return;
    title.value = `${application.name} 操作動画`;
  },
  { immediate: true }
);

watch(
  () => props.videos,
  (videos) => {
    void resolveVideoUrls(videos);
  },
  { immediate: true, deep: true }
);

onBeforeUnmount(() => {
  stopElapsedTimer();
  stopTracks();
  revokePreviewUrl();
});

async function startCapture(): Promise<void> {
  errorMessage.value = "";
  if (!navigator.mediaDevices?.getDisplayMedia) {
    errorMessage.value = "このブラウザでは画面録画を開始できません";
    return;
  }

  try {
    resetRecording();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "window" } as MediaTrackConstraints,
      audio: false,
    });
    mediaStream = stream;
    const track = stream.getVideoTracks()[0];
    const settings = (track?.getSettings() ?? {}) as MediaTrackSettings & {
      displaySurface?: string;
    };
    sourceDisplaySurface.value = parseDisplaySurface(settings.displaySurface);
    track?.addEventListener("ended", () => {
      if (isRecording.value) stopCapture();
    });

    const mimeType = resolveRecorderMimeType();
    mediaRecorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    chunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const blobType = mediaRecorder?.mimeType || mimeType || "video/webm";
      recordedBlob.value = new Blob(chunks, { type: blobType });
      recordedDurationMs.value = elapsedMs.value;
      previewUrl.value = URL.createObjectURL(recordedBlob.value);
      stopElapsedTimer();
      stopTracks();
      mediaRecorder = null;
      isRecording.value = false;
    };
    startedAt = Date.now();
    elapsedMs.value = 0;
    elapsedTimer = window.setInterval(() => {
      elapsedMs.value = Date.now() - startedAt;
    }, 500);
    mediaRecorder.start(1000);
    isRecording.value = true;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "録画開始に失敗しました";
    stopElapsedTimer();
    stopTracks();
    mediaRecorder = null;
    isRecording.value = false;
  }
}

function stopCapture(): void {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    return;
  }
  stopElapsedTimer();
  stopTracks();
  isRecording.value = false;
}

function resetRecording(): void {
  if (isRecording.value) return;
  revokePreviewUrl();
  recordedBlob.value = null;
  recordedDurationMs.value = undefined;
  elapsedMs.value = 0;
  chunks = [];
  sourceDisplaySurface.value = "unknown";
}

function saveRecording(): void {
  if (!props.application || !recordedBlob.value || !canSave.value) return;
  emit("save", {
    applicationId: props.application.id,
    title: title.value.trim(),
    description: description.value.trim() || undefined,
    blob: recordedBlob.value,
    durationMs: recordedDurationMs.value ?? elapsedMs.value,
    contentType: recordedBlob.value.type || "video/webm",
    sourceDisplaySurface: sourceDisplaySurface.value,
  });
}

async function resolveVideoUrls(
  videos: DecodedVibeControlOperationVideo[]
): Promise<void> {
  await Promise.all(
    videos.map(async (video) => {
      if (videoUrls[video.id]) return;
      try {
        const storageRef = storageRefForBucketPath({
          bucketName: video.bucketName,
          filePath: video.storagePath,
        });
        videoUrls[video.id] = await getDownloadURL(storageRef);
      } catch {
        videoUrls[video.id] = "";
      }
    })
  );
}

function resolveRecorderMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
}

function parseDisplaySurface(
  value: string | undefined
): VibeControlOperationVideoDisplaySurface {
  if (value === "browser" || value === "monitor" || value === "window") {
    return value;
  }
  return "unknown";
}

function stopElapsedTimer(): void {
  if (elapsedTimer === null) return;
  window.clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function stopTracks(): void {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

function revokePreviewUrl(): void {
  if (!previewUrl.value) return;
  URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
}

function formatDuration(durationMs?: number): string {
  const totalSeconds = Math.max(0, Math.floor((durationMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatBytes(bytes?: number): string {
  const value = bytes ?? 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRecordedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
}

function displaySurfaceLabel(
  value?: VibeControlOperationVideoDisplaySurface
): string {
  if (value === "window") return "Window";
  if (value === "browser") return "Tab";
  if (value === "monitor") return "Screen";
  return "Unknown";
}

function discoveryLabel(
  status: VibeControlOperationVideoDiscoveryStatus
): string {
  if (status === "queued") return "Queued";
  if (status === "completed") return "Indexed";
  if (status === "error") return "Error";
  return "Local";
}

function discoveryColor(
  status: VibeControlOperationVideoDiscoveryStatus
): "neutral" | "success" | "warning" | "error" {
  if (status === "queued") return "warning";
  if (status === "completed") return "success";
  if (status === "error") return "error";
  return "neutral";
}
</script>
