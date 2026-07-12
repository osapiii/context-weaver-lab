<template>
  <div class="space-y-6">
    <AdminModePageNav current-page-label="リクエストログ" />

    <EnAiPageHeader
      title="リクエストログ"
      :subtitle="pageSubtitle"
      :icon="navCardIcons.requestLogs"
    >
      <template #trailing>
        <EnButton
          variant="soft"
          color="neutral"
          size="sm"
          icon="i-heroicons-arrow-path"
          :loading="requestLogStore.isLoading"
          @click="handleSearch"
        >
          再読込
        </EnButton>
        <EnButton
          variant="soft"
          color="neutral"
          size="sm"
          icon="i-heroicons-arrow-down-tray"
          :disabled="filteredLogs.length === 0"
          @click="handleExport"
        >
          エクスポート
        </EnButton>
      </template>
    </EnAiPageHeader>

    <EnRadioGroup
      v-model="viewMode"
      :items="viewModeOptions"
      variant="card"
      :columns="2"
      class="max-w-md"
    />

    <EnCard padding="snug">
      <div class="flex flex-wrap items-end gap-3">
        <div v-if="viewMode === 'requestDoc'" class="min-w-[220px] flex-1">
          <label class="mb-1 block text-xs font-medium text-gray-600">
            リクエスト種類
          </label>
          <UInputMenu
            v-model="selectedLogTypes"
            :items="logTypeInputMenuOptions"
            value-key="value"
            label-key="label"
            multiple
            placeholder="種類を選択"
            size="sm"
            class="w-full"
          />
        </div>
        <div v-else class="min-w-[220px] flex-1 text-xs text-slate-600">
          <span class="font-medium text-slate-700">対象:</span>
          Google Drive 同期 · Web Crawl (Workflow)
        </div>
        <div class="w-36">
          <label class="mb-1 block text-xs font-medium text-gray-600">
            ステータス
          </label>
          <EnSelectMenu
            v-model="selectedStatus"
            :options="statusOptions"
            value-key="value"
            label-key="label"
            placeholder="すべて"
            size="sm"
            class="w-full"
          />
        </div>
        <div class="w-40">
          <label class="mb-1 block text-xs font-medium text-gray-600">
            開始日
          </label>
          <UInput v-model="startDate" type="date" size="sm" />
        </div>
        <div class="w-40">
          <label class="mb-1 block text-xs font-medium text-gray-600">
            終了日
          </label>
          <UInput v-model="endDate" type="date" size="sm" />
        </div>
        <EnButton
          variant="solid"
          size="sm"
          :loading="requestLogStore.isLoading"
          @click="handleSearch"
        >
          検索
        </EnButton>
      </div>
      <p class="mt-3 text-xs text-gray-500">
        表示 {{ filteredLogs.length }} 件
        <span v-if="typeLegend.length > 0" class="ml-2 inline-flex flex-wrap gap-2">
          <span
            v-for="item in typeLegend"
            :key="item.type"
            class="inline-flex items-center gap-1"
          >
            <span
              class="h-2 w-2 rounded-full"
              :style="{ backgroundColor: item.color }"
            />
            {{ item.label }} ({{ item.count }})
          </span>
        </span>
      </p>
    </EnCard>

    <EnAlert
      v-if="requestLogStore.error"
      color="error"
      :title="requestLogStore.error"
      :actions="[
        { label: '再試行', onClick: () => requestLogStore.retry(currentFilters) },
      ]"
    />

    <div
      v-if="requestLogStore.isLoading"
      class="flex flex-1 items-center justify-center py-16"
    >
      <UIcon
        name="i-heroicons-arrow-path"
        class="h-8 w-8 animate-spin text-primary"
      />
      <span class="ml-3 text-sm font-medium">ログを読み込み中…</span>
    </div>

    <template v-else>
      <EnCard padding="snug" class="flex-shrink-0">
        <RequestLogTimelineChart
          :logs="filteredLogs"
          :start-date="startDate"
          :end-date="endDate"
        />
      </EnCard>

      <EnCard padding="snug">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
            リクエスト一覧
          </h2>
          <p class="text-xs text-gray-500">
            {{
              viewMode === "workflow"
                ? "行をクリックで RequestDoc / Input YAML / Step Logs を表示"
                : "行をクリックで詳細 JSON を表示"
            }}
          </p>
        </div>
        <RequestLogAgGrid
          v-if="filteredLogs.length > 0"
          :logs="filteredLogs"
          :grid-height-px="480"
          :workflow-mode="viewMode === 'workflow'"
          @select-log="openDetail"
        />
        <div
          v-else
          class="flex flex-col items-center justify-center py-16 text-gray-500"
        >
          <UIcon
            name="i-heroicons-document-text"
            class="mb-3 h-12 w-12 text-gray-300"
          />
          <p class="text-sm font-medium">条件に一致するログがありません</p>
        </div>
      </EnCard>
    </template>

    <EnModal
      v-model:open="detailOpen"
      :title="detailTitle"
      title-icon="i-heroicons-document-magnifying-glass"
      size="xl"
      header-variant="default"
      padding="md"
    >
      <WorkflowRequestLogDetail
        v-if="viewMode === 'workflow' && selectedLog"
        :log="selectedLog"
      />
      <JsonViewer
        v-else-if="selectedLog?.originalDoc"
        :value="selectedLog.originalDoc"
        :expand-depth="2"
        theme="dark"
        :copyable="true"
        class="rounded-lg"
      />
    </EnModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRequestLogHistoryStore } from "@stores/requestLogHistory";
import type { RequestLog } from "@stores/requestLogHistory";
import type { LogType } from "@utils/requestLogHelpers";
import {
  actualLogTypes,
  getLogTypeColor,
  getLogTypeLabel,
  parseRequestLogDate,
  formatCalendarDateInput,
  toJstDateKey,
} from "@utils/requestLogHelpers";
import {
  WORKFLOW_REQUEST_LOG_TYPES,
  type WorkflowRequestLogType,
} from "@utils/requestLogRegistry";
import WorkflowRequestLogDetail from "@components/requestLog/WorkflowRequestLogDetail.vue";
import EnAiPageHeader from "@components/ai/EnAiPageHeader.vue";

const navCardIcons = useNavCardIcons();

definePageMeta({
  layout: "admin",
  adminPageStack: false,
});

type RequestLogViewMode = "requestDoc" | "workflow";

const requestLogStore = useRequestLogHistoryStore();
const viewMode = ref<RequestLogViewMode>("requestDoc");
const viewModeOptions = [
  { value: "requestDoc", label: "RequestDoc" },
  { value: "workflow", label: "Workflow" },
];

const pageSubtitle = computed(() =>
  viewMode.value === "workflow"
    ? "Workflow 連携リクエストの RequestDoc と input artifact (YAML) を監査できます"
    : "全 RequestDoc の実行履歴を時系列と一覧で監査できます"
);

const selectedLogTypes = ref<LogType[]>([]);
const selectedStatus = ref<
  "completed" | "error" | "processing" | "pending" | null
>(null);
const startDate = ref("");
const endDate = ref("");

const detailOpen = ref(false);
const selectedLog = ref<RequestLog | null>(null);

const statusOptions = [
  { value: null, label: "すべて" },
  { value: "completed", label: "完了" },
  { value: "error", label: "エラー" },
  { value: "processing", label: "処理中" },
  { value: "pending", label: "待機中" },
];

const currentFilters = computed(() => {
  const workflowOnly = viewMode.value === "workflow";
  const singleType =
    !workflowOnly && selectedLogTypes.value.length === 1
      ? selectedLogTypes.value[0]
      : null;
  return {
    startDate: startDate.value || null,
    endDate: endDate.value || null,
    status: selectedStatus.value,
    requestType: singleType,
    requestTypes: workflowOnly
      ? ([...WORKFLOW_REQUEST_LOG_TYPES] as WorkflowRequestLogType[])
      : undefined,
  };
});

const filteredLogs = computed(() => {
  let rows = requestLogStore.logs;

  if (viewMode.value === "workflow") {
    const workflowSet = new Set<string>(WORKFLOW_REQUEST_LOG_TYPES);
    rows = rows.filter((log) => workflowSet.has(log.requestType));
  } else if (selectedLogTypes.value.length > 0) {
    const set = new Set(selectedLogTypes.value);
    rows = rows.filter((log) => set.has(log.requestType));
  }

  if (selectedStatus.value) {
    rows = rows.filter((log) => log.status === selectedStatus.value);
  }

  if (startDate.value && endDate.value) {
    rows = rows.filter((log) => {
      const created = parseRequestLogDate(log.createdAt);
      if (!created) return false;
      const key = toJstDateKey(created);
      return key >= startDate.value && key <= endDate.value;
    });
  }

  return rows;
});

const logTypeCounts = computed(() => {
  const counts = Object.fromEntries(
    actualLogTypes.map((t) => [t, 0])
  ) as Record<LogType, number>;
  for (const log of requestLogStore.logs) {
    counts[log.requestType] = (counts[log.requestType] ?? 0) + 1;
  }
  return counts;
});

const logTypeInputMenuOptions = computed(() =>
  actualLogTypes
    .map((type) => ({
      label: `${getLogTypeLabel(type)} (${logTypeCounts.value[type]}件)`,
      value: type,
    }))
    .sort((a, b) => {
      const countDiff =
        logTypeCounts.value[b.value] - logTypeCounts.value[a.value];
      if (countDiff !== 0) return countDiff;
      return getLogTypeLabel(a.value).localeCompare(
        getLogTypeLabel(b.value),
        "ja"
      );
    })
);

const typeLegend = computed(() =>
  selectedLogTypes.value.length > 0
    ? selectedLogTypes.value.map((type) => ({
        type,
        label: getLogTypeLabel(type),
        color: getLogTypeColor(type),
        count: filteredLogs.value.filter((l) => l.requestType === type).length,
      }))
    : actualLogTypes
        .filter((type) =>
          filteredLogs.value.some((l) => l.requestType === type)
        )
        .map((type) => ({
          type,
          label: getLogTypeLabel(type),
          color: getLogTypeColor(type),
          count: filteredLogs.value.filter((l) => l.requestType === type).length,
        }))
);

const detailTitle = computed(() => {
  if (!selectedLog.value) return "リクエスト詳細";
  return `${getLogTypeLabel(selectedLog.value.requestType)} · ${selectedLog.value.id}`;
});

const handleSearch = async (): Promise<void> => {
  await requestLogStore.fetchLogs(currentFilters.value);
};

const handleExport = (): void => {
  requestLogStore.exportLogs("json");
};

const openDetail = (log: RequestLog): void => {
  selectedLog.value = log;
  detailOpen.value = true;
};

watch(
  () => requestLogStore.logs.length,
  (len) => {
    if (viewMode.value === "workflow") return;
    if (len > 0 && selectedLogTypes.value.length === 0) {
      const available = actualLogTypes.filter(
        (type) => logTypeCounts.value[type] > 0
      );
      if (available.length > 0) {
        selectedLogTypes.value = [...available];
      }
    }
  },
  { immediate: true }
);

watch(viewMode, async () => {
  detailOpen.value = false;
  selectedLog.value = null;
  await handleSearch();
});

onMounted(async () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  startDate.value = formatCalendarDateInput(start);
  endDate.value = formatCalendarDateInput(end);
  await handleSearch();
});
</script>
