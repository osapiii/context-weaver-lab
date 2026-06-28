<template>
  <EnModal
    v-model:open="open"
    size="full"
    header-variant="dark"
    padding="none"
    title-icon="logos:google-drive"
    :title="modalTitle"
    :subtitle="modalSubtitle"
    :close-on-backdrop="!isRunning"
    :ui="{ content: 'mx-auto h-[min(92vh,860px)] w-[min(96vw,88rem)]' }"
  >
    <div class="flex min-h-0 flex-1 flex-col bg-slate-50">
      <section class="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
            :style="{ background: progressRingBackground }"
          >
            <div
              class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-black tabular-nums text-slate-900 shadow-sm"
            >
              {{ overallPercent }}%
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <EnBadge :color="statusTone" variant="soft" size="xs">
                {{ statusLabel }}
              </EnBadge>
              <span class="text-[11px] font-medium text-slate-500">
                {{ closeHint }}
              </span>
            </div>
            <p class="mt-1 truncate text-sm font-bold text-slate-950">
              {{ currentStepLabel }}
            </p>
            <div class="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span class="font-semibold tabular-nums text-slate-700">
                対象 {{ targetCount }} 件
              </span>
              <span class="font-semibold tabular-nums text-emerald-700">
                処理済み {{ processedCount }} 件
              </span>
              <span
                class="font-semibold tabular-nums"
                :class="failedCount > 0 ? 'text-rose-600' : 'text-slate-500'"
              >
                失敗 {{ failedCount }} 件
              </span>
              <span>Workflow: {{ workflowStateLabel }}</span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                class="h-full rounded-full transition-all duration-700 ease-out"
                :class="isRunning ? 'bg-sky-500 progress-stripe' : progressBarClass"
                :style="{ width: `${overallPercent}%` }"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="shrink-0 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div class="grid gap-2 md:grid-cols-4">
          <div
            v-for="(item, index) in stepper.items"
            :key="item.title"
            class="rounded-lg border bg-white px-3 py-2 shadow-sm"
            :class="
              index === stepper.activeIndex
                ? 'border-sky-200 ring-2 ring-sky-100'
                : 'border-slate-200'
            "
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="item.icon ?? 'i-heroicons-minus-circle'"
                class="h-4 w-4 shrink-0"
                :class="[
                  index === stepper.activeIndex ? 'text-sky-600' : 'text-slate-400',
                  item.icon === 'i-heroicons-arrow-path' &&
                  index === stepper.activeIndex
                    ? 'animate-spin'
                    : '',
                ]"
              />
              <div class="min-w-0">
                <p class="truncate text-[13px] font-bold leading-5 text-slate-950">
                  {{ item.title }}
                </p>
                <p class="truncate text-[11px] leading-4 text-slate-500">
                  {{ item.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="primaryError"
          class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900"
        >
          <div class="flex items-center gap-1.5 font-bold text-rose-700">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4" />
            エラー内容
          </div>
          <p class="mt-1 line-clamp-2 whitespace-pre-wrap break-words leading-5">
            {{ primaryError }}
          </p>
        </div>
      </section>

      <section
        class="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <DriveImportFileProgressTable :rows="fileRows" />

        <aside
          class="flex min-h-0 flex-col overflow-hidden rounded-xl bg-slate-950/95 shadow-sm ring-1 ring-slate-200/80"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2"
          >
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              実行ログ
            </p>
            <EnBadge
              variant="soft"
              color="neutral"
              size="xs"
              custom-class="bg-slate-800 text-slate-300"
            >
              {{ terminalLogs.length }} 行
            </EnBadge>
          </div>
          <div
            ref="logScrollRef"
            class="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
          >
            <p
              v-if="terminalLogs.length === 0"
              class="py-8 text-center text-slate-500"
            >
              ログ待機中
            </p>
            <ul v-else class="space-y-1.5">
              <li
                v-for="(entry, index) in terminalLogs"
                :key="`${entry.stepId ?? 'log'}-${entry.at ?? index}-${index}`"
                class="grid grid-cols-[3.4rem_2.3rem_minmax(0,1fr)] items-start gap-x-2"
              >
                <span class="shrink-0 tabular-nums text-slate-500">
                  {{ formatLogTime(entry.at) }}
                </span>
                <span
                  class="inline-flex h-4 w-9 items-center justify-center rounded border px-1 text-[9px] font-bold uppercase leading-none"
                  :class="logLevelClass(entry.level)"
                >
                  {{ entry.level ?? "info" }}
                </span>
                <span class="min-w-0 whitespace-pre-wrap break-words">
                  <span v-if="entry.stepId" class="font-semibold text-sky-300">
                    [{{ logHeading(entry) }}]
                  </span>
                  <span
                    class="ml-1"
                    :class="entry.level === 'error' ? 'text-rose-300' : 'text-slate-200'"
                  >
                    {{ entry.message }}
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import EnBadge from "@components/EnBadge.vue";
import EnModal from "@components/EnModal.vue";
import DriveImportFileProgressTable from "@components/dataSource/DriveImportFileProgressTable.vue";
import { useGoogleDriveSyncStore } from "@stores/googleDriveSync";
import { driveImportStepUserLabel } from "@constants/driveImportUserLabels";
import {
  buildDriveImportFileRows,
  computeDriveImportProgressPercent,
  DRIVE_IMPORT_FILE_COLUMNS,
  type DriveImportFileRow,
} from "@utils/driveImportFileRows";
import { buildDriveImportStepperItems } from "@utils/buildDriveImportStepper";
import {
  summarizeFailedFiles,
  type DriveImportSessionState,
} from "@utils/driveImportSession";
import { getDriveSyncStepLabel } from "@utils/googleDriveSyncProgress";
import type { GoogleDriveSyncLogEntry } from "@models/googleDriveSyncRequest";

type UiLogEntry = GoogleDriveSyncLogEntry & {
  source?: string;
};

const driveStore = useGoogleDriveSyncStore();
const { importProgressModalOpen, activeImportSession } = storeToRefs(driveStore);

const open = computed({
  get: () => importProgressModalOpen.value,
  set: (value: boolean) => {
    if (value) driveStore.openImportProgressModal();
    else driveStore.closeImportProgressModal();
  },
});

const session = computed<DriveImportSessionState>(() => activeImportSession.value);
const fileRows = computed(() => buildDriveImportFileRows({ session: session.value }));
const stepper = computed(() => buildDriveImportStepperItems(session.value));
const logScrollRef = ref<HTMLElement | null>(null);

const isRunning = computed(() => session.value.phase === "running");
const isError = computed(() => session.value.phase === "error");
const isCompleted = computed(() => session.value.phase === "completed");

const overallPercent = computed(() => {
  if (isCompleted.value || isError.value) return 100;
  if (fileRows.value.length > 0) {
    return computeDriveImportProgressPercent(fileRows.value);
  }
  const total =
    session.value.progress.totalFiles ||
    session.value.importCount + session.value.removeCount;
  if (total > 0) {
    return Math.min(
      99,
      Math.round((session.value.progress.processedFiles / total) * 100)
    );
  }
  return isRunning.value ? 5 : 0;
});

const targetCount = computed(
  () => session.value.importCount + session.value.removeCount || fileRows.value.length
);

const processedCount = computed(() => {
  const progressCount = session.value.progress.processedFiles;
  if (progressCount > 0) return progressCount;
  return fileRows.value.filter((row) =>
    rowColumnStatuses(row).every((status) =>
      ["completed", "skipped", "error"].includes(status)
    )
  ).length;
});

const failedCount = computed(() =>
  Math.max(
    summarizeFailedFiles(session.value),
    fileRows.value.filter((row) =>
      rowColumnStatuses(row).some((status) => status === "error")
    ).length
  )
);

const workflowStateLabel = computed(() => session.value.workflow?.state ?? "未開始");
const currentStepLabel = computed(() =>
  getDriveSyncStepLabel(session.value.progress.currentStep)
);

const statusLabel = computed(() => {
  if (isRunning.value) return "実行中";
  if (isCompleted.value) return failedCount.value > 0 ? "一部失敗" : "完了";
  if (isError.value) return "失敗";
  return "待機中";
});

const statusTone = computed<
  "primary" | "success" | "warning" | "error" | "neutral"
>(() => {
  if (isRunning.value) return "primary";
  if (isCompleted.value) return failedCount.value > 0 ? "warning" : "success";
  if (isError.value) return "error";
  return "neutral";
});

const progressBarClass = computed(() => {
  if (isError.value) return "bg-rose-500";
  if (isCompleted.value) return failedCount.value > 0 ? "bg-amber-500" : "bg-emerald-500";
  return "bg-slate-400";
});

const progressRingColor = computed(() => {
  if (isError.value) return "#f43f5e";
  if (isCompleted.value) return failedCount.value > 0 ? "#f59e0b" : "#10b981";
  return "#0ea5e9";
});

const progressRingBackground = computed(
  () => `conic-gradient(${progressRingColor.value} ${overallPercent.value * 3.6}deg, #e2e8f0 0deg)`
);

const modalTitle = computed(() =>
  isRunning.value ? "Google Drive 取り込み中" : "Google Drive 取り込み進捗"
);

const modalSubtitle = computed(() => {
  if (session.value.requestId) {
    return `${currentStepLabel.value} · ${overallPercent.value}%`;
  }
  return "Drive 取り込みの進捗を表示します";
});

const closeHint = computed(() =>
  isRunning.value
    ? "閉じてもバックグラウンドで処理は継続します"
    : "結果を確認して閉じられます"
);

const primaryError = computed(() => {
  const erroredStep = session.value.steps.find((step) => step.status === "error");
  if (erroredStep?.error) {
    return `${driveImportStepUserLabel(erroredStep.id)}: ${erroredStep.error}`;
  }
  const erroredRow = fileRows.value.find((row) => row.errorMessage);
  return erroredRow?.errorMessage ?? null;
});

const terminalLogs = computed<UiLogEntry[]>(() => {
  const stepLogs = session.value.stepLogs ?? {};
  return Object.entries(stepLogs)
    .flatMap(([stepId, entries]) =>
      entries.map((entry) => ({
        ...entry,
        stepId: entry.stepId ?? stepId,
        source: "stepLogs",
      }))
    )
    .sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
});

function rowColumnStatuses(row: DriveImportFileRow) {
  return DRIVE_IMPORT_FILE_COLUMNS.map((column) => row.columns[column.id]);
}

function logHeading(entry: UiLogEntry): string {
  if (entry.stepId) return driveImportStepUserLabel(entry.stepId);
  return entry.source ?? "log";
}

function formatLogTime(value: string | null | undefined): string {
  if (!value) return "--:--:--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(11, 19) || value;
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function logLevelClass(level: string | undefined): string {
  if (level === "error") {
    return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  }
  if (level === "warn") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  return "border-slate-600 bg-slate-800 text-slate-200";
}

watch(
  () => terminalLogs.value.length,
  async () => {
    await nextTick();
    const el = logScrollRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  }
);
</script>

<style scoped>
.progress-stripe {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.24) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.24) 50%,
    rgba(255, 255, 255, 0.24) 75%,
    transparent 75%,
    transparent
  );
  background-size: 1rem 1rem;
  animation: progress-stripe 1s linear infinite;
}

@keyframes progress-stripe {
  from {
    background-position: 1rem 0;
  }
  to {
    background-position: 0 0;
  }
}
</style>
