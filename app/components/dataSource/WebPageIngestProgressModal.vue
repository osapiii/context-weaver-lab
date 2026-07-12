<template>
  <EnModal
    v-model:open="open"
    size="full"
    header-variant="dark"
    :subtitle="progressSubtitle"
    :close-on-backdrop="!isSessionRunning"
    :fullscreen="isFullscreen"
    padding="md"
    hide-close
    :ui="modalUi"
  >
    <template #title>
      <span class="inline-flex min-w-0 items-center gap-2.5">
        <UIcon
          name="i-heroicons-globe-alt"
          class="h-[18px] w-[18px] shrink-0 text-violet-400"
          :class="{ 'animate-pulse': isSessionRunning }"
        />
        <span class="truncate">Web ページ取り込みの進捗</span>
      </span>
    </template>

    <template #subtitle>
      <span class="inline-flex flex-wrap items-center gap-2">
        <span
          v-if="isSessionRunning"
          class="relative inline-flex h-2 w-2 shrink-0"
          aria-hidden="true"
        >
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70"
          />
          <span
            class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"
          />
        </span>
        <span>{{ progressSubtitle }}</span>
      </span>
    </template>

    <template #close>
      <div class="flex shrink-0 items-center gap-1.5">
        <button
          v-if="storageBrowserUrl"
          type="button"
          class="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition-colors hover:bg-white/10 sm:inline-flex"
          @click="openExternal(storageBrowserUrl)"
        >
          <UIcon name="i-heroicons-cloud" class="h-3.5 w-3.5 text-violet-300" />
          {{ WEB_CRAWL_IMPORT_USER_LABELS.summary.storageOpen }}
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          :aria-label="isFullscreen ? '通常表示に戻す' : '全画面表示'"
          :title="isFullscreen ? '通常表示に戻す' : '全画面表示'"
          @click="isFullscreen = !isFullscreen"
        >
          <UIcon
            :name="
              isFullscreen
                ? 'i-heroicons-arrows-pointing-in'
                : 'i-heroicons-arrows-pointing-out'
            "
            class="h-4 w-4"
          />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="閉じる"
          @click="open = false"
        >
          <UIcon name="i-heroicons-x-mark" class="h-4 w-4" />
        </button>
      </div>
    </template>

    <div class="flex min-h-0 flex-1 flex-col gap-4">
      <div
        v-if="displaySession.requestId"
        class="overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50/80 to-purple-50/30 shadow-sm ring-1 ring-slate-200/80 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-purple-950/20 dark:ring-white/10"
      >
        <div class="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
          <div class="flex shrink-0 items-center gap-4">
            <div class="relative h-[4.5rem] w-[4.5rem] shrink-0">
              <svg
                viewBox="0 0 36 36"
                class="h-[4.5rem] w-[4.5rem] -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  class="stroke-slate-200 dark:stroke-slate-700"
                  stroke-width="2.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  class="stroke-purple-500 transition-all duration-700 ease-out"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  pathLength="100"
                  :stroke-dasharray="`${overallProgressPercent} 100`"
                />
              </svg>
              <div
                class="absolute inset-0 flex flex-col items-center justify-center"
              >
                <span class="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                  {{ overallProgressPercent }}
                </span>
                <span class="text-[9px] font-medium uppercase tracking-wider text-gray-500">
                  %
                </span>
              </div>
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <EnBadge
                  :color="statusPresentation.badgeColor"
                  :variant="statusPresentation.badgeVariant"
                  size="xs"
                >
                  {{ phaseLabel }}
                </EnBadge>
                <span
                  v-if="displaySession.sourceUrl"
                  class="truncate text-[11px] text-gray-500"
                >
                  {{ sourceHostname }}
                </span>
              </div>
              <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {{ activePhaseTitle }}
              </p>
              <p class="text-[11px] text-gray-500">
                {{ totalPagesLabel }}
              </p>
            </div>
          </div>
          <div class="min-w-0 flex-1 lg:pl-2">
            <EnStepper
              :model-value="stepperActiveIndex"
              :items="stepperItems"
              color="warning"
              size="sm"
              orientation="horizontal"
            />
          </div>
        </div>
        <EnAlert
          v-if="displaySession.phase === 'error' && displaySession.errorMessage"
          color="error"
          class="mx-4 mb-4"
          :title="
            isCancelledSession
              ? '取り込みをキャンセルしました'
              : '取り込みに失敗しました'
          "
          :description="displaySession.errorMessage"
        />
      </div>

      <div
        v-else
        class="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-500"
      >
        進行中の取り込みはありません
      </div>

      <div
        v-if="displaySession.requestId"
        class="flex min-h-0 flex-1 flex-col"
      >
        <WebCrawlPageProgressTable
          :rows="pageRows"
          :is-awaiting-page-list="isAwaitingPageList"
          :is-discovering="isDiscoveringPages"
          :is-preparing="isPreparingPages"
        />
      </div>
    </div>

    <template #footer>
      <div
        class="flex w-full items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/90 px-1 py-0.5 dark:border-white/10 dark:bg-slate-900/40"
      >
        <p class="hidden text-[11px] text-gray-500 sm:block">
          {{ WEB_CRAWL_IMPORT_USER_LABELS.flow.source }} → クラウド保存 →
          {{ WEB_CRAWL_IMPORT_USER_LABELS.flow.sink }}
        </p>
        <div class="ml-auto flex flex-wrap justify-end gap-2">
          <EnButton
            v-if="isSessionRunning"
            variant="outline"
            color="error"
            size="sm"
            :loading="isCancellingIngest"
            :disabled="isCancellingIngest"
            @click="onCancelIngest"
          >
            {{ WEB_CRAWL_IMPORT_USER_LABELS.cancel.button }}
          </EnButton>
          <EnButton
            v-if="workflowConsoleUrl"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="openExternal(workflowConsoleUrl)"
          >
            Workflow
          </EnButton>
          <EnButton variant="outline" color="neutral" @click="open = false">
            閉じる
          </EnButton>
        </div>
      </div>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useToast } from "#imports";
import EnModal from "@components/EnModal.vue";
import EnButton from "@components/EnButton.vue";
import EnBadge from "@components/EnBadge.vue";
import EnAlert from "@components/EnAlert.vue";
import EnStepper from "@components/EnStepper.vue";
import WebCrawlPageProgressTable from "@components/dataSource/WebCrawlPageProgressTable.vue";
import { useWebCrawlRequestStore } from "@stores/webCrawlRequest";
import { useWebCrawlGlobalIngest } from "@composables/useWebCrawlGlobalIngest";
import { projectWebCrawlRequestToSession } from "@utils/webCrawlSession";
import { buildWebCrawlStepperItems } from "@utils/buildWebCrawlStepper";
import {
  buildWebCrawlPageRows,
  computeWebCrawlPageProgressPercent,
  isWebCrawlAwaitingPageList,
  isWebCrawlDiscoveringPages,
  isWebCrawlPreparingPages,
} from "@utils/webCrawlPageRows";
import { getWebCrawlStatusPresentation } from "@utils/webCrawlProgress";
import { WEB_CRAWL_IMPORT_USER_LABELS } from "@constants/webCrawlImportUserLabels";
import { gcsBrowserUrlFromGsUri } from "@models/googleDriveSyncRequest";
import { isWebCrawlCancelled } from "@utils/webCrawlTerminal";

useWebCrawlGlobalIngest();

const toast = useToast();
const store = useWebCrawlRequestStore();
const {
  ingestProgressModalOpen,
  activeIngestSession,
  activeWatchingRequest,
  isCancellingIngest,
} = storeToRefs(store);

const displaySession = computed(() => {
  const req = activeWatchingRequest.value;
  if (req) {
    return projectWebCrawlRequestToSession(
      req,
      activeIngestSession.value.requestId === req.id
        ? activeIngestSession.value
        : null
    );
  }
  return activeIngestSession.value;
});

const open = computed({
  get: () => ingestProgressModalOpen.value,
  set: (v: boolean) => {
    if (v) store.openIngestProgressModal();
    else store.closeIngestProgressModal();
  },
});

const isFullscreen = ref(false);

const modalUi = computed(() =>
  isFullscreen.value
    ? {
        content:
          "!fixed !inset-0 !m-0 !max-w-none !w-screen !h-dvh !max-h-none flex flex-col rounded-none",
        overlay: "bg-slate-900/55",
      }
    : {
        content:
          "sm:max-w-[min(96vw,80rem)] sm:w-full h-[min(92vh,920px)] max-h-[92vh] flex flex-col",
      }
);

const statusPresentation = computed(() => {
  const req = activeWatchingRequest.value;
  if (!req) {
    return {
      label: "待機",
      badgeColor: "neutral" as const,
      badgeVariant: "outline" as const,
    };
  }
  return getWebCrawlStatusPresentation(req);
});

const phaseLabel = computed(() => statusPresentation.value.label);

const isSessionRunning = computed(() => {
  const req = activeWatchingRequest.value;
  if (req) {
    if (isWebCrawlCancelled(req)) return false;
    const pres = getWebCrawlStatusPresentation(req);
    return pres.label === "実行中" || pres.label === "待機";
  }
  return displaySession.value.phase === "running";
});

const isCancelledSession = computed(() => {
  const req = activeWatchingRequest.value;
  return req ? isWebCrawlCancelled(req) : false;
});

const stepperState = computed(() => buildWebCrawlStepperItems(displaySession.value));
const stepperItems = computed(() => stepperState.value.items);
const stepperActiveIndex = computed(() => stepperState.value.activeIndex);

const pageRows = computed(() =>
  buildWebCrawlPageRows({ session: displaySession.value })
);

const isAwaitingPageList = computed(() =>
  isWebCrawlAwaitingPageList(displaySession.value)
);

const isDiscoveringPages = computed(() =>
  isWebCrawlDiscoveringPages(displaySession.value)
);

const isPreparingPages = computed(() =>
  isWebCrawlPreparingPages(displaySession.value)
);

const overallProgressPercent = computed(() =>
  computeWebCrawlPageProgressPercent(pageRows.value)
);

const activePhaseTitle = computed(() => {
  const idx = stepperActiveIndex.value;
  return stepperItems.value[idx]?.title ?? WEB_CRAWL_IMPORT_USER_LABELS.stepper.prepare;
});

const sourceHostname = computed(() => {
  const url = displaySession.value.sourceUrl;
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
});

const progressSubtitle = computed(() => {
  if (isDiscoveringPages.value) {
    return WEB_CRAWL_IMPORT_USER_LABELS.discovering.subtitle;
  }
  if (isPreparingPages.value) {
    return WEB_CRAWL_IMPORT_USER_LABELS.preparing.subtitle;
  }
  const total = pageRows.value.filter((row) => !row.isPlaceholder).length;
  if (total > 0) {
    return `${total} 件の URL を順番に処理しています`;
  }
  return "Web ページから AI ナレッジへ反映する進捗を表示します";
});

const totalPagesLabel = computed(() => {
  if (isDiscoveringPages.value) {
    return WEB_CRAWL_IMPORT_USER_LABELS.discovering.pageCount;
  }
  if (isPreparingPages.value) {
    return WEB_CRAWL_IMPORT_USER_LABELS.preparing.pageCount;
  }
  const total = displaySession.value.progress.totalPages;
  const processed = displaySession.value.progress.processedPages;
  if (total > 0) {
    return `${processed}/${total} ページ`;
  }
  const confirmedRows = pageRows.value.filter((row) => !row.isPlaceholder);
  return confirmedRows.length > 0 ? `${confirmedRows.length} URL` : "—";
});

const workflowConsoleUrl = computed(
  () => displaySession.value.workflow?.consoleUrl ?? null
);

const storageGsUri = computed(() => {
  const out = displaySession.value.output;
  if (!out?.gcsBucketName || !out?.gcsPrefix) return null;
  return `gs://${out.gcsBucketName}/${out.gcsPrefix}`;
});

const storageBrowserUrl = computed(() =>
  gcsBrowserUrlFromGsUri(storageGsUri.value)
);

watch(open, (visible) => {
  if (!visible) {
    isFullscreen.value = false;
  }
});

const openExternal = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

async function onCancelIngest(): Promise<void> {
  if (!window.confirm(WEB_CRAWL_IMPORT_USER_LABELS.cancel.confirm)) {
    return;
  }
  const result = await store.cancelActiveWebCrawlIngest();
  if (!result.ok) {
    toast.add({
      title: "中止できませんでした",
      description: result.error,
      color: "error",
    });
    return;
  }
  toast.add({
    title: "取り込みを中止しました",
    description: "フッターのインジケータはまもなく消えます",
    color: "success",
  });
}
</script>
