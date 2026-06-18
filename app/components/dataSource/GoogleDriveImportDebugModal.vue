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
          name="i-heroicons-arrow-path"
          class="h-[18px] w-[18px] shrink-0 text-violet-400"
          :class="{ 'animate-spin': isSessionRunning }"
        />
        <span class="truncate">取り込みの進捗</span>
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
          v-if="mirrorBrowserUrl"
          type="button"
          class="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition-colors hover:bg-white/10 sm:inline-flex"
          @click="openExternal(mirrorBrowserUrl)"
        >
          <UIcon name="i-heroicons-cloud" class="h-3.5 w-3.5 text-violet-300" />
          {{ DRIVE_IMPORT_USER_LABELS.summary.mirrorOpenStorage }}
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
        v-if="session.requestId"
        class="overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50/80 to-emerald-50/30 shadow-sm ring-1 ring-slate-200/80 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-emerald-950/20 dark:ring-white/10"
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
                  class="stroke-emerald-500 transition-all duration-700 ease-out"
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
                  v-if="addedFiles > 0 || failedFiles > 0"
                  class="text-[11px] tabular-nums"
                  :class="
                    failedFiles > 0
                      ? 'font-medium text-purple-700'
                      : 'text-emerald-700'
                  "
                >
                  反映 +{{ addedFiles }}
                  <template v-if="failedFiles > 0">
                    · 失敗 {{ failedFiles }}
                  </template>
                </span>
              </div>
              <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {{ activePhaseTitle }}
              </p>
              <p class="text-[11px] text-gray-500">
                {{ totalFilesLabel }}
              </p>
            </div>
          </div>
          <div class="min-w-0 flex-1 lg:pl-2">
            <EnStepper
              :model-value="stepperActiveIndex"
              :items="stepperItems"
              size="sm"
              orientation="horizontal"
            />
          </div>
        </div>
        <EnAlert
          v-if="failedFiles > 0"
          color="warning"
          class="mx-4 mb-4"
          title="一部のファイルが反映できませんでした"
          :description="partialFailureDescription"
        />
      </div>

      <div class="flex min-h-0 flex-1 flex-col">
        <DriveImportFileProgressTable :rows="fileRows" />
      </div>

      <section
        class="grid grid-cols-1 gap-4 md:grid-cols-2"
        :aria-label="'取り込み結果サマリ'"
      >
        <EnCard variant="kpi" padding="snug">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100"
                >
                  <UIcon name="i-heroicons-cloud" class="h-4 w-4" />
                </div>
                <p class="font-semibold text-sm text-gray-900 dark:text-white">
                  {{ DRIVE_IMPORT_USER_LABELS.summary.mirror }}
                </p>
              </div>
              <a
                v-if="mirrorBrowserUrl"
                :href="mirrorBrowserUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900"
              >
                GCS で開く
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3 w-3" />
              </a>
            </div>
          </template>
          <div class="grid grid-cols-5 gap-2">
            <div
              v-for="stat in mirrorSummaryStats"
              :key="stat.key"
              class="rounded-xl bg-slate-50/80 px-2 py-2 text-center dark:bg-white/5"
            >
              <p
                class="text-xl font-bold tabular-nums leading-none"
                :class="stat.emphasis ? 'text-purple-700' : 'text-gray-900 dark:text-white'"
              >
                {{ stat.value }}
              </p>
              <p class="mt-1 text-[10px] text-gray-500">
                {{ stat.label }}
              </p>
            </div>
          </div>
          <button
            v-if="session.mirror?.gcsPrefixUri"
            type="button"
            class="mt-3 flex w-full items-center gap-1.5 text-left text-[10px] text-gray-500 hover:text-gray-700"
            @click="showMirrorPath = !showMirrorPath"
          >
            <UIcon
              :name="showMirrorPath ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              class="h-3 w-3 shrink-0"
            />
            <span>{{ showMirrorPath ? "保存先パスを隠す" : "保存先パスを表示" }}</span>
          </button>
          <p
            v-if="showMirrorPath && session.mirror?.gcsPrefixUri"
            class="mt-1 rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-gray-500 break-all dark:bg-white/5"
          >
            {{ session.mirror.gcsPrefixUri }}
          </p>
        </EnCard>

        <EnCard variant="kpi" padding="snug">
          <template #header>
            <div class="flex items-center gap-2">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
              >
                <UIcon name="i-heroicons-circle-stack" class="h-4 w-4" />
              </div>
              <p class="font-semibold text-sm text-gray-900 dark:text-white">
                {{ DRIVE_IMPORT_USER_LABELS.summary.register }}
              </p>
            </div>
          </template>
          <div class="grid grid-cols-4 gap-2">
            <div
              v-for="stat in registerSummaryStats"
              :key="stat.key"
              class="rounded-xl bg-slate-50/80 px-2 py-2 text-center dark:bg-white/5"
            >
              <p
                class="text-xl font-bold tabular-nums leading-none"
                :class="stat.emphasis ? 'text-purple-700' : 'text-gray-900 dark:text-white'"
              >
                {{ stat.value }}
              </p>
              <p class="mt-1 text-[10px] text-gray-500">
                {{ stat.label }}
              </p>
            </div>
          </div>
          <ul
            v-if="session.register?.failedItems?.length"
            class="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-lg bg-purple-50/80 px-2 py-2 text-[10px] text-purple-800"
          >
            <li
              v-for="(item, idx) in session.register.failedItems"
              :key="`failed-${idx}`"
              class="break-words"
            >
              <span class="font-mono">{{ item.driveFileId ?? "(不明)" }}</span>
              <span v-if="item.reason">: {{ item.reason }}</span>
            </li>
          </ul>
        </EnCard>
      </section>
    </div>

    <template #footer>
      <div
        class="flex w-full items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/90 px-1 py-0.5 dark:border-white/10 dark:bg-slate-900/40"
      >
        <p class="hidden text-[11px] text-gray-500 sm:block">
          Google Drive → クラウド保存 → 素材プール
        </p>
        <div class="ml-auto flex gap-2">
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
import EnModal from "@components/EnModal.vue";
import EnButton from "@components/EnButton.vue";
import EnBadge from "@components/EnBadge.vue";
import EnAlert from "@components/EnAlert.vue";
import EnStepper from "@components/EnStepper.vue";
import EnCard from "@components/EnCard.vue";
import DriveImportFileProgressTable from "@components/dataSource/DriveImportFileProgressTable.vue";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import {
  gcsBrowserUrlFromGsUri,
  type DecodedGoogleDriveSyncRequest,
} from "@models/googleDriveSyncRequest";
import {
  summarizeAddedFiles,
  summarizeFailedFiles,
} from "@utils/driveImportSession";
import { buildDriveImportStepperItems } from "@utils/buildDriveImportStepper";
import { DRIVE_IMPORT_USER_LABELS } from "@constants/driveImportUserLabels";
import {
  buildDriveImportFileRows,
  computeDriveImportProgressPercent,
} from "@utils/driveImportFileRows";
import {
  getDriveSyncStatusPresentation,
} from "@utils/googleDriveSyncProgress";

const open = defineModel<boolean>("open", { default: false });

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

const driveStore = useGoogleDriveSyncStore();
const { activeImportSession: session } = storeToRefs(driveStore);

const activeRequest = computed((): DecodedGoogleDriveSyncRequest | null => {
  if (!session.value.requestId) return null;
  return driveStore.fetchWatchingRequest(session.value.requestId);
});

const statusPresentation = computed(() => {
  const req = activeRequest.value;
  if (!req) {
    return {
      label: "待機",
      badgeColor: "neutral" as const,
      badgeVariant: "outline" as const,
    };
  }
  return getDriveSyncStatusPresentation(req);
});

const phaseLabel = computed(() => statusPresentation.value.label);

const showMirrorPath = ref(false);

const isSessionRunning = computed(() => {
  const req = activeRequest.value;
  if (req) {
    const pres = getDriveSyncStatusPresentation(req);
    return pres.label === "実行中" || pres.label === "待機";
  }
  return session.value.phase === "running";
});

const stepperState = computed(() => buildDriveImportStepperItems(session.value));
const stepperItems = computed(() => stepperState.value.items);
const stepperActiveIndex = computed(() => stepperState.value.activeIndex);

const mirrorBrowserUrl = computed(() =>
  gcsBrowserUrlFromGsUri(session.value.mirror?.gcsPrefixUri ?? null)
);

watch(open, (visible) => {
  if (!visible) {
    isFullscreen.value = false;
    showMirrorPath.value = false;
  }
});

const progressSubtitle = computed(() => {
  const total =
    session.value.fileItems.length ||
    session.value.importCount + session.value.removeCount;
  if (total > 0) {
    return `${total} 件のファイルを順番に処理しています`;
  }
  return "Drive から素材プールへ反映する進捗を表示します";
});

const fileRows = computed(() =>
  buildDriveImportFileRows({ session: session.value })
);

const overallProgressPercent = computed(() =>
  computeDriveImportProgressPercent(fileRows.value)
);

const activePhaseTitle = computed(() => {
  const idx = stepperActiveIndex.value;
  const item = stepperItems.value[idx];
  return item?.title ?? DRIVE_IMPORT_USER_LABELS.stepper.prepare;
});

type SummaryStat = {
  key: string;
  label: string;
  value: number;
  emphasis?: boolean;
};

const mirrorSummaryStats = computed((): SummaryStat[] => [
  { key: "added", label: "追加", value: session.value.mirror?.addedCount ?? 0 },
  {
    key: "updated",
    label: "更新",
    value: session.value.mirror?.updatedCount ?? 0,
  },
  {
    key: "removed",
    label: "削除",
    value: session.value.mirror?.removedCount ?? 0,
  },
  {
    key: "skipped",
    label: "スキップ",
    value: session.value.mirror?.skippedCount ?? 0,
  },
  {
    key: "failed",
    label: "失敗",
    value: session.value.mirror?.failedCount ?? 0,
    emphasis: (session.value.mirror?.failedCount ?? 0) > 0,
  },
]);

const registerSummaryStats = computed((): SummaryStat[] => [
  { key: "added", label: "追加", value: session.value.register?.addedCount ?? 0 },
  {
    key: "updated",
    label: "更新",
    value: session.value.register?.updatedCount ?? 0,
  },
  {
    key: "removed",
    label: "削除",
    value: session.value.register?.removedCount ?? 0,
  },
  {
    key: "failed",
    label: "失敗",
    value: session.value.register?.failedCount ?? 0,
    emphasis: (session.value.register?.failedCount ?? 0) > 0,
  },
]);

const totalFilesLabel = computed(() => {
  const total = session.value.progress.totalFiles;
  const processed = session.value.progress.processedFiles;
  const batches = session.value.progress.totalBatches;
  if (total > 0) {
    return `${processed}/${total} ファイル · ${batches} バッチ`;
  }
  if (session.value.importCount + session.value.removeCount > 0) {
    return `${session.value.importCount} 追加 / ${session.value.removeCount} 削除`;
  }
  return "件数算出中…";
});

const addedFiles = computed(() => summarizeAddedFiles(session.value));
const failedFiles = computed(() => summarizeFailedFiles(session.value));

const partialFailureDescription = computed(() => {
  const mirror = session.value.mirror;
  const register = session.value.register;
  const mirrorFailed = mirror?.failedCount ?? 0;
  const registerFailed = register?.failedCount ?? 0;
  const parts: string[] = [];
  if (mirrorFailed > 0) {
    parts.push(
      `${DRIVE_IMPORT_USER_LABELS.errors.mirrorFailed} ${mirrorFailed} 件失敗`
    );
  }
  if (registerFailed > 0) {
    parts.push(
      `${DRIVE_IMPORT_USER_LABELS.errors.registerFailed} ${registerFailed} 件失敗`
    );
  }
  if (parts.length === 0) {
    parts.push("一部の処理で失敗が発生しました");
  }
  parts.push("失敗した行の詳細は上のファイル一覧を確認してください。");
  return parts.join(" · ");
});

const openExternal = (url: string | null | undefined) => {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};
</script>
