<template>
  <div class="space-y-6">
    <EnAiPageHeader
      title="仕事ログ"
      subtitle="AI セッションと Workflow リクエストの実行状況をまとめて確認できます"
      :icon="navModeIcons.worklog"
    >
      <template #trailing>
        <EnButton
          variant="soft"
          color="neutral"
          size="sm"
          icon="i-heroicons-arrow-path"
          @click="store.subscribe()"
        >
          再読込
        </EnButton>
      </template>
    </EnAiPageHeader>

    <div class="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
      <EnCard variant="kpi" padding="snug" class="max-h-fit">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
          <UIcon name="material-symbols:autorenew" class="text-xl text-violet-600" />
          <span class="text-sm font-bold text-violet-600">実行中</span>
          </div>
          <div class="text-xl font-bold text-violet-600 tabular-nums">
            {{ filteredCounts.running }}
          </div>
        </div>
      </EnCard>

      <EnCard variant="kpi" padding="snug" class="max-h-fit">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
          <UIcon name="material-symbols:check-circle" class="text-xl text-emerald-600" />
          <span class="text-sm font-bold text-emerald-600">完了</span>
          </div>
          <div class="text-xl font-bold text-emerald-600 tabular-nums">
            {{ filteredCounts.completed }}
          </div>
        </div>
      </EnCard>

      <EnCard variant="kpi" padding="snug" class="max-h-fit">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
          <UIcon name="material-symbols:error" class="text-xl text-red-600" />
          <span class="text-sm font-bold text-red-600">エラー</span>
          </div>
          <div class="text-xl font-bold text-red-600 tabular-nums">
            {{ filteredCounts.error }}
          </div>
        </div>
      </EnCard>
    </div>

    <EnCard padding="snug">
      <div class="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="w-40">
          <label class="mb-1 block text-xs font-medium text-slate-600">種別</label>
          <EnSelectMenu
            v-model="sourceFilter"
            :items="sourceOptions"
            value-key="value"
            label-key="label"
            size="sm"
            :search-input="false"
          />
        </div>
        <div class="w-40">
          <label class="mb-1 block text-xs font-medium text-slate-600">ステータス</label>
          <EnSelectMenu
            v-model="statusFilter"
            :items="statusOptions"
            value-key="value"
            label-key="label"
            size="sm"
            :search-input="false"
          />
        </div>
        <div class="w-40">
          <label class="mb-1 block text-xs font-medium text-slate-600">期間</label>
          <EnSelectMenu
            v-model="periodFilter"
            :items="periodOptions"
            value-key="value"
            label-key="label"
            size="sm"
            :search-input="false"
          />
        </div>
        <EnButton
          v-if="hasActiveFilter"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="resetFilters"
        >
          クリア
        </EnButton>
        <span class="ml-auto text-xs font-medium text-slate-500">
          {{ filteredItems.length }}件
        </span>
      </div>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">ジョブ一覧</h2>
        <p class="text-xs text-gray-500">操作列から結果表示・詳細確認ができます</p>
      </div>
      <WorkflowExecutionAgGrid
        v-if="filteredItems.length > 0"
        :items="filteredItems"
        :grid-height-px="520"
        @open-result="onOpenResult"
        @open-detail="onOpenDetail"
      />
      <div
        v-else
        class="flex flex-col items-center justify-center py-16 text-gray-500"
      >
        <UIcon
          name="i-heroicons-inbox"
          class="mb-3 h-12 w-12 text-gray-300"
        />
        <p class="text-sm font-medium">条件に一致するジョブはありません</p>
      </div>
    </EnCard>

    <WorkflowExecutionDetailModal
      v-model:open="detailOpen"
      :item="selectedItem"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useWorkflowExecutionsStore } from "@stores/workflowExecutions";
import type { WorkflowItem } from "@models/workflowItem";
import EnAiPageHeader from "@components/ai/EnAiPageHeader.vue";
import WorkflowExecutionAgGrid from "@components/WorkflowExecutionAgGrid.vue";
import WorkflowExecutionDetailModal from "@components/workflow/WorkflowExecutionDetailModal.vue";

const navModeIcons = useNavModeIcons();
const router = useRouter();
const route = useRoute();
const store = useWorkflowExecutionsStore();

definePageMeta({
  layout: "admin",
  adminPageStack: false,
});

const sourceFilter = ref("all");
const statusFilter = ref("all");
const periodFilter = ref("all");
const detailOpen = ref(false);
const selectedItem = ref<WorkflowItem | null>(null);

const sourceOptions = [
  { value: "all", label: "すべて" },
  { value: "adkSession", label: "StoryVault" },
  { value: "workflowRequest", label: "ワークフロー" },
];
const statusOptions = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "待機中" },
  { value: "running", label: "実行中" },
  { value: "completed", label: "完了" },
  { value: "error", label: "エラー" },
];
const periodOptions = [
  { value: "all", label: "全期間" },
  { value: "today", label: "今日" },
  { value: "7days", label: "過去7日" },
  { value: "30days", label: "過去30日" },
];

const periodStart = computed(() => {
  const now = new Date();
  if (periodFilter.value === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (periodFilter.value === "7days") {
    return now.getTime() - 7 * 24 * 60 * 60 * 1000;
  }
  if (periodFilter.value === "30days") {
    return now.getTime() - 30 * 24 * 60 * 60 * 1000;
  }
  return null;
});

const filteredItems = computed(() =>
  store.items.filter((item) => {
    if (sourceFilter.value !== "all" && item.sourceKind !== sourceFilter.value) {
      return false;
    }
    if (statusFilter.value !== "all" && item.status !== statusFilter.value) {
      return false;
    }
    return periodStart.value === null || item.createdAt.getTime() >= periodStart.value;
  })
);

const filteredCounts = computed(() => ({
  running: filteredItems.value.filter(
    (item) => item.status === "pending" || item.status === "running"
  ).length,
  completed: filteredItems.value.filter((item) => item.status === "completed").length,
  error: filteredItems.value.filter((item) => item.status === "error").length,
}));

const hasActiveFilter = computed(
  () =>
    sourceFilter.value !== "all" ||
    statusFilter.value !== "all" ||
    periodFilter.value !== "all"
);

const onOpenResult = (item: WorkflowItem): void => {
  if (item.status !== "completed") return;
  if (!item.navigateTarget) return;
  router.push({
    name: item.navigateTarget.routeName,
    query: item.navigateTarget.query,
    params: item.navigateTarget.params,
  });
};

const onOpenDetail = (item: WorkflowItem): void => {
  selectedItem.value = item;
  detailOpen.value = true;
};

const openDetailByJobId = (jobId: unknown): void => {
  if (typeof jobId !== "string" || !jobId) return;
  const item = store.items.find((candidate) => candidate.id === jobId);
  if (!item) return;
  selectedItem.value = item;
  detailOpen.value = true;
};

const resetFilters = (): void => {
  sourceFilter.value = "all";
  statusFilter.value = "all";
  periodFilter.value = "all";
};

onMounted(() => {
  store.subscribe();
});

watch(
  () => [route.query.jobId, store.items] as const,
  ([jobId]) => {
    openDetailByJobId(jobId);
  },
  { immediate: true }
);
</script>
