<template>
  <div>
    <button
      type="button"
      class="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50"
      @click="openStatusModal"
    >
      <UIcon :name="runningCount ? 'material-symbols:autorenew' : 'material-symbols:monitor-heart-outline'" :class="['h-4 w-4', runningCount ? 'animate-spin text-sky-500' : 'text-slate-500']" />
      <span>解析ステータス</span>
      <span v-if="runningCount" class="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">解析中 {{ runningCount }}</span>
      <span v-if="partialCount" class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">要確認 {{ partialCount }}</span>
      <span v-if="completedCount" class="hidden text-emerald-600 xl:inline">完了 {{ completedCount }}</span>
    </button>

    <EnModal
      v-model:open="open"
      title="録画解析ステータス"
      title-icon="material-symbols:monitor-heart-outline"
      size="full"
      :ui="{ content: 'sm:max-w-[1500px]' }"
    >
      <div class="h-[min(82vh,900px)] min-h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div v-if="api.errorMessage.value" class="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ api.errorMessage.value }}
        </div>
        <div v-else-if="!api.loading.value && !api.pipelines.value.length" class="flex h-full flex-col items-center justify-center text-slate-400">
          <UIcon name="material-symbols:video-library-outline" class="h-12 w-12" />
          <p class="mt-4 text-sm font-semibold text-slate-700">録画解析はまだありません</p>
          <p class="mt-1 text-xs">録画をバックグラウンド実行すると、ここに進捗が表示されます。</p>
        </div>

        <div v-else class="grid h-full min-h-0 lg:grid-cols-[minmax(360px,42%)_minmax(0,58%)]">
          <aside class="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
            <div class="border-b border-slate-200 bg-white px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600">Recording queue</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">解析ジョブを選択</p>
                </div>
                <span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">{{ api.pipelines.value.length }} jobs</span>
              </div>
            </div>

            <div class="max-h-64 space-y-2 overflow-y-auto border-b border-slate-200 p-3 lg:max-h-80">
              <button
                v-for="pipeline in api.pipelines.value"
                :key="pipeline.id"
                type="button"
                :class="[
                  'group w-full rounded-xl border p-3 text-left transition',
                  pipeline.id === selectedPipelineId
                    ? 'border-sky-400 bg-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,.12)]'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                ]"
                @click="selectPipeline(pipeline.id)"
              >
                <div class="flex items-start gap-3">
                  <span :class="['mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', jobIconClass(pipeline.status)]">
                    <UIcon :name="jobIcon(pipeline.status)" :class="['h-4 w-4', isPipelineRunning(pipeline) ? 'animate-spin' : '']" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center justify-between gap-2">
                      <strong class="truncate text-sm text-slate-900">{{ pipeline.title || '録画解析' }}</strong>
                      <span :class="statusClass(pipeline.status)" class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">{{ statusLabel(pipeline.status) }}</span>
                    </span>
                    <span class="mt-1 block truncate text-[11px] text-slate-500">{{ pipeline.applicationName || pipeline.applicationId }} / {{ pipeline.clipGroupName || pipeline.clipGroupId || '未分類' }}</span>
                    <span class="mt-2 flex items-center gap-2">
                      <span class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <span :class="progressBarClass(pipeline.status)" class="block h-full rounded-full transition-all duration-700" :style="{ width: `${clampedProgress(pipeline)}%` }" />
                      </span>
                      <span class="w-8 text-right text-[10px] font-semibold text-slate-400">{{ clampedProgress(pipeline) }}%</span>
                    </span>
                  </span>
                </div>
              </button>
            </div>

            <div v-if="selectedPipeline" class="flex min-h-0 flex-1 flex-col p-4">
              <div class="relative aspect-video shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-black shadow-2xl">
                <video
                  v-if="selectedVideoUrl"
                  :key="selectedPipeline.id"
                  :src="selectedVideoUrl"
                  controls
                  playsinline
                  preload="metadata"
                  class="h-full w-full object-contain"
                />
                <div v-else class="flex h-full flex-col items-center justify-center bg-slate-950 text-slate-500">
                  <UIcon :name="videoLoading ? 'material-symbols:progress-activity' : 'material-symbols:movie-outline'" :class="['h-10 w-10', videoLoading ? 'animate-spin text-sky-400' : '']" />
                  <p class="mt-2 text-xs">{{ videoLoading ? '録画を読み込んでいます' : '録画プレビューを取得できません' }}</p>
                </div>
                <div v-if="isPipelineRunning(selectedPipeline)" class="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-cyan-300 shadow-[0_0_8px_2px_rgba(34,211,238,.9)] motion-safe:animate-[pipeline-scan_2.8s_ease-in-out_infinite]" />
                <div class="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300 backdrop-blur">
                  <span :class="['h-1.5 w-1.5 rounded-full', isPipelineRunning(selectedPipeline) ? 'animate-pulse bg-cyan-300' : 'bg-emerald-400']" />
                  {{ isPipelineRunning(selectedPipeline) ? 'AI scanning' : 'scan archived' }}
                </div>
              </div>

            </div>
          </aside>

          <main v-if="selectedPipeline" class="flex min-h-0 flex-col bg-white">
            <header class="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span :class="statusClass(selectedPipeline.status)" class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{{ statusLabel(selectedPipeline.status) }}</span>
                    <span class="text-[11px] text-slate-500">{{ elapsedLabel(selectedPipeline.createdAt, selectedPipeline.completedAt) }}</span>
                  </div>
                  <h2 class="mt-2 truncate text-xl font-bold text-slate-900">{{ selectedPipeline.title || '録画解析' }}</h2>
                  <p class="mt-1 text-xs text-slate-500">{{ selectedPipeline.applicationName || selectedPipeline.applicationId }} · Request {{ selectedPipeline.id }}</p>
                </div>
                <div class="text-right">
                  <div class="text-3xl font-black tabular-nums text-slate-900">{{ clampedProgress(selectedPipeline) }}<span class="ml-1 text-sm text-slate-400">%</span></div>
                  <p class="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">overall progress</p>
                </div>
              </div>
              <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div :class="progressBarClass(selectedPipeline.status)" class="h-full rounded-full transition-all duration-700" :style="{ width: `${clampedProgress(selectedPipeline)}%` }" />
              </div>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-5">
              <details open class="rounded-xl border border-slate-200 bg-white shadow-sm">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-900">
                  <span class="flex items-center gap-2"><UIcon name="material-symbols:movie-outline" class="h-4 w-4 text-sky-600" />生成クリップ</span>
                  <span class="text-[11px] font-medium text-slate-500">{{ selectedPipeline.clips?.length || 0 }} clips · 表示を切り替え</span>
                </summary>
                <div class="border-t border-slate-100 p-3">
                  <div v-if="selectedPipeline.clips?.length" class="space-y-2">
                    <div v-for="clip in selectedPipeline.clips" :key="clip.clipId" class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <span class="min-w-0 flex-1 font-semibold text-slate-800">{{ clip.title || clip.clipId }}</span>
                        <span :class="clip.status === 'error' ? 'text-red-600' : clip.status === 'completed' ? 'text-emerald-600' : 'text-sky-600'" class="shrink-0 font-semibold">{{ clipStatusLabel(clip.status) }}</span>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span>Quick Scan {{ compactStatus(clip.quickScanStatus) }}</span>
                        <span>Zapping {{ compactStatus(clip.zappingStatus) }}</span>
                        <span>Story候補 {{ clip.storyCandidateCount || 0 }}</span>
                      </div>
                      <button v-if="clip.status === 'error'" class="mt-2 rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50" @click="api.retry(selectedPipeline.id, { clipId: clip.clipId, step: clip.failedStep })">このクリップを再実行</button>
                    </div>
                  </div>
                  <p v-else class="text-xs text-slate-500">分割クリップの生成を待っています。</p>
                </div>
              </details>

              <section :class="currentStepPanelClass(selectedPipeline.status)" class="mt-4 rounded-xl border p-4">
                <div class="flex items-center gap-3">
                  <span :class="['flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', currentStepIconClass(selectedPipeline.status)]">
                    <UIcon :name="currentStepIcon(selectedPipeline.status)" :class="['h-6 w-6', isPipelineRunning(selectedPipeline) ? 'animate-spin' : '']" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Current operation</p>
                    <p class="mt-1 text-base font-bold text-slate-900">{{ currentOperationTitle(selectedPipeline) }}</p>
                    <p class="mt-1 text-xs text-slate-600">{{ currentOperationMessage(selectedPipeline) }}</p>
                  </div>
                </div>
              </section>

              <section class="mt-5">
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">解析工程</h3>
                  <span class="text-[10px] text-slate-500">{{ completedStepCount(selectedPipeline) }} / {{ steps.length }} completed</span>
                </div>
                <ol class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <li v-for="(step, index) in steps" :key="step" :class="stepCardClass(selectedPipeline, step)" class="relative rounded-xl border p-3 transition">
                    <div class="flex items-start gap-3">
                      <span :class="stepIconClass(selectedPipeline, step)" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <UIcon :name="stepIcon(selectedPipeline, step)" :class="['h-4 w-4', stepEffectiveStatus(selectedPipeline, step) === 'processing' ? 'animate-spin' : '']" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="flex items-center justify-between gap-2">
                          <strong class="text-xs text-slate-900">{{ stepLabel(step) }}</strong>
                          <span class="text-[9px] font-bold uppercase tracking-wider" :class="stepStatusTextClass(selectedPipeline, step)">{{ stepStatusLabel(stepEffectiveStatus(selectedPipeline, step)) }}</span>
                        </span>
                        <span class="mt-1 block text-[10px] leading-4 text-slate-500">{{ stepDescription(step, selectedPipeline.steps?.[step]?.message) }}</span>
                        <span v-if="selectedPipeline.steps?.[step]?.errorMessage" class="mt-1 block text-[10px] text-red-300">{{ selectedPipeline.steps[step]?.errorMessage }}</span>
                      </span>
                    </div>
                    <span class="absolute right-2 top-1 text-[9px] text-slate-300">{{ String(index + 1).padStart(2, '0') }}</span>
                  </li>
                </ol>
              </section>

              <section class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div v-for="metric in metrics(selectedPipeline)" :key="metric.label" class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p class="text-[10px] font-semibold text-slate-500">{{ metric.label }}</p>
                  <p :class="metric.class" class="mt-1 text-xl font-black tabular-nums">{{ metric.value }}</p>
                </div>
              </section>

              <section class="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <div class="flex items-center gap-2">
                    <span class="h-2 w-2 rounded-full bg-red-400" /><span class="h-2 w-2 rounded-full bg-amber-400" /><span class="h-2 w-2 rounded-full bg-emerald-400" />
                    <span class="ml-1 font-mono text-[10px] text-slate-500">解析ログ · {{ selectedPipeline.id }}</span>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <select v-model="logLevel" class="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"><option value="">すべてのレベル</option><option value="info">info</option><option value="warning">warning</option><option value="error">error</option></select>
                    <select v-model="logStep" class="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"><option value="">すべての工程</option><option v-for="step in steps" :key="step" :value="step">{{ stepLabel(step) }}</option></select>
                  </div>
                </div>
                <div class="h-56 overflow-y-auto p-3 font-mono text-[11px] leading-5">
                  <div v-if="!selectedEvents.length" class="text-slate-400">解析イベントを待っています<span class="animate-pulse">…</span></div>
                  <div v-for="event in selectedEvents" :key="event.id" :class="event.level === 'error' ? 'text-red-700' : event.level === 'warning' ? 'text-amber-700' : 'text-slate-600'">
                    <span class="text-slate-400">{{ formatTime(event.createdAt) }}</span>
                    <span :class="event.level === 'error' ? 'text-red-600' : event.level === 'warning' ? 'text-amber-600' : 'text-sky-600'"> [{{ event.level || 'info' }}]</span>
                    <span class="text-violet-600"> {{ event.step || 'system' }}</span>
                    <span> {{ event.message }}</span>
                    <span v-if="event.retryCount" class="text-amber-300"> retry={{ event.retryCount }}</span>
                  </div>
                </div>
              </section>

              <button v-if="selectedPipeline.status === 'error' || selectedPipeline.status === 'partial_error'" class="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700" @click="api.retry(selectedPipeline.id, { step: selectedPipeline.currentStep })">失敗工程から再開</button>
            </div>
          </main>
        </div>
      </div>
    </EnModal>
  </div>
</template>

<script setup lang="ts">
import { getDownloadURL } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import {
  STORYVAULT_CLIP_PIPELINE_STEPS,
  type StoryVaultClipPipelineRequest,
  type StoryVaultClipPipelineStatus,
  type StoryVaultClipPipelineStepId,
} from "@models/storyVaultClipPipelineRequest";

const api = useStoryVaultClipPipelines();
const storyVaultStore = useStoryVaultStore();
const open = ref(false);
const selectedPipelineId = ref("");
const logLevel = ref("");
const logStep = ref("");
const videoUrls = reactive<Record<string, string>>({});
const videoLoadingIds = reactive(new Set<string>());
const steps = STORYVAULT_CLIP_PIPELINE_STEPS;
const refreshedPipelineIds = new Set<string>();

const runningCount = computed(() => api.pipelines.value.filter(isPipelineRunning).length);
const partialCount = computed(() => api.pipelines.value.filter((pipeline) => pipeline.status === "partial_error" || pipeline.status === "error").length);
const completedCount = computed(() => api.pipelines.value.filter((pipeline) => pipeline.status === "completed").length);
const selectedPipeline = computed(() => api.pipelines.value.find((pipeline) => pipeline.id === selectedPipelineId.value) || api.pipelines.value[0] || null);
const selectedVideoUrl = computed(() => selectedPipeline.value ? videoUrls[selectedPipeline.value.id] || "" : "");
const videoLoading = computed(() => selectedPipeline.value ? videoLoadingIds.has(selectedPipeline.value.id) : false);
const selectedEvents = computed(() => {
  const pipelineId = selectedPipeline.value?.id;
  if (!pipelineId) return [];
  return (api.events.value[pipelineId] || []).filter((event) =>
    (!logLevel.value || event.level === logLevel.value) &&
    (!logStep.value || event.step === logStep.value)
  );
});

function openStatusModal(): void {
  open.value = true;
  const preferred = api.pipelines.value.find(isPipelineRunning) || api.pipelines.value[0];
  if (preferred) selectPipeline(preferred.id);
}

function selectPipeline(id: string): void {
  selectedPipelineId.value = id;
  api.subscribeEvents(id);
  const pipeline = api.pipelines.value.find((item) => item.id === id);
  if (pipeline) void loadPipelineVideo(pipeline);
}

async function loadPipelineVideo(pipeline: StoryVaultClipPipelineRequest): Promise<void> {
  if (videoUrls[pipeline.id] || videoLoadingIds.has(pipeline.id)) return;
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(pipeline.input?.sourceGcsUri || "");
  if (!match?.[1] || !match[2]) return;
  videoLoadingIds.add(pipeline.id);
  try {
    videoUrls[pipeline.id] = await getDownloadURL(storageRefForBucketPath({ bucketName: match[1], filePath: match[2] }));
  } catch {
    videoUrls[pipeline.id] = "";
  } finally {
    videoLoadingIds.delete(pipeline.id);
  }
}

function isPipelineRunning(pipeline: StoryVaultClipPipelineRequest): boolean { return pipeline.status === "pending" || pipeline.status === "processing"; }
function clampedProgress(pipeline: StoryVaultClipPipelineRequest): number { return Math.round(Math.max(0, Math.min(100, pipeline.progress || 0))); }
function statusLabel(status: StoryVaultClipPipelineStatus): string { return ({ pending: "待機中", processing: "解析中", completed: "完了", partial_error: "一部失敗", error: "失敗" })[status] || status; }
function statusClass(status: StoryVaultClipPipelineStatus): string { return status === "completed" ? "bg-emerald-100 text-emerald-700" : status === "error" ? "bg-red-100 text-red-700" : status === "partial_error" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"; }
function progressBarClass(status: StoryVaultClipPipelineStatus): string { return status === "completed" ? "bg-emerald-400" : status === "error" ? "bg-red-400" : status === "partial_error" ? "bg-amber-400" : "bg-sky-400"; }
function jobIcon(status: StoryVaultClipPipelineStatus): string { return status === "completed" ? "material-symbols:check-rounded" : status === "error" ? "material-symbols:error-outline" : status === "partial_error" ? "material-symbols:warning-outline" : "material-symbols:progress-activity"; }
function jobIconClass(status: StoryVaultClipPipelineStatus): string { return status === "completed" ? "bg-emerald-100 text-emerald-700" : status === "error" ? "bg-red-100 text-red-700" : status === "partial_error" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"; }
function currentStepIcon(status: StoryVaultClipPipelineStatus): string { return jobIcon(status); }
function currentStepIconClass(status: StoryVaultClipPipelineStatus): string { return jobIconClass(status); }
function currentStepPanelClass(status: StoryVaultClipPipelineStatus): string { return status === "completed" ? "border-emerald-200 bg-emerald-50" : status === "error" ? "border-red-200 bg-red-50" : status === "partial_error" ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"; }

function stepEffectiveStatus(pipeline: StoryVaultClipPipelineRequest, step: StoryVaultClipPipelineStepId): string {
  const status = pipeline.steps?.[step]?.status || "pending";
  if (status === "pending" && pipeline.currentStep === step && isPipelineRunning(pipeline)) return "processing";
  return status === "running" ? "processing" : status;
}
function stepCardClass(pipeline: StoryVaultClipPipelineRequest, step: StoryVaultClipPipelineStepId): string {
  const status = stepEffectiveStatus(pipeline, step);
  return status === "completed" ? "border-emerald-200 bg-emerald-50" : status === "processing" ? "border-sky-400 bg-sky-50 shadow-[0_0_0_2px_rgba(56,189,248,.10)]" : status === "error" ? "border-red-300 bg-red-50" : status === "skipped" ? "border-slate-200 bg-slate-100 opacity-70" : "border-slate-200 bg-white";
}
function stepIcon(pipeline: StoryVaultClipPipelineRequest, step: StoryVaultClipPipelineStepId): string {
  const status = stepEffectiveStatus(pipeline, step);
  return status === "completed" ? "material-symbols:check-rounded" : status === "processing" ? "material-symbols:progress-activity" : status === "error" ? "material-symbols:close-rounded" : status === "skipped" ? "material-symbols:skip-next" : "material-symbols:more-horiz";
}
function stepIconClass(pipeline: StoryVaultClipPipelineRequest, step: StoryVaultClipPipelineStepId): string {
  const status = stepEffectiveStatus(pipeline, step);
  return status === "completed" ? "bg-emerald-100 text-emerald-700" : status === "processing" ? "bg-sky-100 text-sky-700" : status === "error" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-400";
}
function stepStatusTextClass(pipeline: StoryVaultClipPipelineRequest, step: StoryVaultClipPipelineStepId): string {
  const status = stepEffectiveStatus(pipeline, step);
  return status === "completed" ? "text-emerald-600" : status === "processing" ? "text-sky-600" : status === "error" ? "text-red-600" : "text-slate-400";
}
function stepStatusLabel(status?: string): string { return ({ pending: "待機", processing: "実行中", running: "実行中", completed: "完了", error: "失敗", skipped: "省略" } as Record<string, string>)[status || "pending"] || status || "待機"; }
function stepLabel(step?: string): string { return ({ upload: "アップロード", trimSilence: "無音カット", transcribe: "文字起こし", section: "AI分割", split: "動画分割", registerClips: "クリップ保存", quickScan: "Quick Scan", zappingAnalysis: "Zapping解析", capabilityStructuring: "Capability整理", storyGeneration: "Story生成", verifyUiAssets: "UI反映確認", notification: "完了メールを送信" } as Record<string, string>)[step || ""] || step || "待機中"; }
function stepDescription(step: StoryVaultClipPipelineStepId, message?: string): string { return message || ({ upload: "元録画を安全に受け付けます", trimSilence: "無音・ノイズ区間を整理します", transcribe: "発話をタイムコード化します", section: "操作単位の分割案を作ります", split: "採用区間を動画へ書き出します", registerClips: "StoryVaultへクリップ登録します", quickScan: "代表フレームと概要を抽出します", zappingAnalysis: "操作・意図・Story候補を解析します", capabilityStructuring: "機能体系へ整理します", storyGeneration: "正式User Storyを生成します", verifyUiAssets: "画面に表示可能か検証します", notification: "解析レポートをメール送信します" })[step]; }
function completedStepCount(pipeline: StoryVaultClipPipelineRequest): number { return steps.filter((step) => stepEffectiveStatus(pipeline, step) === "completed").length; }
function currentOperationTitle(pipeline: StoryVaultClipPipelineRequest): string { return pipeline.status === "completed" ? "すべての解析が完了しました" : pipeline.status === "error" ? `${stepLabel(pipeline.currentStep)}で停止しました` : pipeline.status === "partial_error" ? "一部の成果を保存して完了しました" : `${stepLabel(pipeline.currentStep)}を実行しています`; }
function currentOperationMessage(pipeline: StoryVaultClipPipelineRequest): string { return pipeline.steps?.[pipeline.currentStep || "upload"]?.message || (pipeline.status === "completed" ? "Clip・Capability・User StoryをStoryVaultへ反映済みです。" : pipeline.status === "error" ? "詳細ログを確認し、失敗工程から再実行できます。" : "ブラウザを閉じてもバックグラウンドで処理を継続します。"); }
function metrics(pipeline: StoryVaultClipPipelineRequest) { return [
  { label: "生成", value: pipeline.counters?.total || pipeline.clips?.length || 0, class: "text-slate-900" },
  { label: "成功", value: pipeline.counters?.completed || 0, class: "text-emerald-600" },
  { label: "実行中", value: pipeline.counters?.processing || 0, class: "text-sky-600" },
  { label: "失敗", value: pipeline.counters?.failed || 0, class: "text-red-600" },
  { label: "メール", value: compactStatus(pipeline.notification?.status), class: pipeline.notification?.status === "completed" ? "text-emerald-600 text-sm" : "text-slate-600 text-sm" },
]; }
function compactStatus(status?: string): string { return ({ pending: "待機", processing: "実行中", completed: "完了", error: "失敗", skipped: "省略" } as Record<string, string>)[status || "pending"] || status || "待機"; }
function clipStatusLabel(status?: string): string { return ({ registered: "登録済み", processing: "解析中", completed: "完了", error: "失敗" } as Record<string, string>)[status || "registered"] || status || "登録済み"; }
function asDate(value: unknown): Date | null { if (!value) return null; if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate() as Date; const parsed = new Date(value as string | number | Date); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function elapsedLabel(start: unknown, end: unknown): string { const from = asDate(start); if (!from) return "開始時刻不明"; const seconds = Math.max(0, Math.round(((asDate(end)?.getTime() || Date.now()) - from.getTime()) / 1000)); return `${from.toLocaleString("ja-JP")} 開始 · ${Math.floor(seconds / 60)}分${seconds % 60}秒`; }
function formatTime(value: unknown): string { return asDate(value)?.toLocaleTimeString("ja-JP") || "--:--:--"; }

watch([open, () => api.pipelines.value], ([isOpen]) => {
  if (!isOpen || !api.pipelines.value.length) return;
  if (!api.pipelines.value.some((pipeline) => pipeline.id === selectedPipelineId.value)) {
    const preferred = api.pipelines.value.find(isPipelineRunning) || api.pipelines.value[0];
    if (preferred) selectPipeline(preferred.id);
  }
}, { immediate: true });

// Clip documents are written by the background worker, not this browser tab.
// Refresh the SSOT list once the worker reports saved clip results so completed
// recordings appear in their selected group without a manual page reload.
watch(
  () => api.pipelines.value,
  (pipelines) => {
    const newlyCompletedWithClips = pipelines.some(
      (pipeline) =>
        !refreshedPipelineIds.has(pipeline.id) &&
        (pipeline.status === "completed" || pipeline.status === "partial_error") &&
        (pipeline.clips?.length || 0) > 0
    );
    if (!newlyCompletedWithClips) return;
    pipelines.forEach((pipeline) => {
      if (
        (pipeline.status === "completed" || pipeline.status === "partial_error") &&
        (pipeline.clips?.length || 0) > 0
      ) {
        refreshedPipelineIds.add(pipeline.id);
      }
    });
    void storyVaultStore.fetchFromFirestore();
  },
  { immediate: true }
);
</script>

<style scoped>
@keyframes pipeline-scan {
  0%, 100% { transform: translateY(8px); opacity: 0.35; }
  50% { transform: translateY(calc(min(42vw, 360px) * 0.55)); opacity: 1; }
}
</style>
