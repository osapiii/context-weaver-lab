<template>
  <EnModal
    :open="open"
    title="ジョブ詳細"
    :subtitle="item ? `${sourceLabel} / ${item.label}` : ''"
    title-icon="i-heroicons-document-magnifying-glass"
    size="3xl"
    padding="none"
    :ui="{ content: 'h-[78vh]' }"
    @update:open="emit('update:open', $event)"
  >
    <UTabs
      v-if="item"
      v-model="activeTab"
      :items="tabs"
      class="flex min-h-0 flex-1 flex-col"
      :ui="{
        list: 'shrink-0 border-b border-slate-200 px-5 pt-3',
        content: 'min-h-0 flex-1 overflow-y-auto p-5',
      }"
    >
      <template #overview>
        <div class="grid gap-4 sm:grid-cols-2">
          <section class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold text-slate-500">基本情報</p>
            <dl class="mt-3 space-y-3 text-sm">
              <div v-for="row in overviewRows" :key="row.label">
                <dt class="text-xs text-slate-500">{{ row.label }}</dt>
                <dd class="mt-0.5 break-words font-medium text-slate-900">
                  {{ row.value }}
                </dd>
              </div>
            </dl>
          </section>
          <section class="rounded-xl border border-slate-200 bg-white p-4">
            <p class="text-xs font-semibold text-slate-500">実行状況</p>
            <div class="mt-3 flex items-center gap-2">
              <EnBadge :color="statusColor" variant="soft">
                {{ statusLabel }}
              </EnBadge>
              <span class="text-xs text-slate-500">{{ durationLabel }}</span>
            </div>
            <div v-if="item.progressLabel" class="mt-4">
              <p class="text-xs text-slate-500">進捗・依頼内容</p>
              <p class="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                {{ item.progressLabel }}
              </p>
            </div>
          </section>
        </div>
      </template>

      <template #payload>
        <div class="grid gap-4 lg:grid-cols-2">
          <JsonPanel title="入力" :value="requestInput" empty-label="入力データはありません" />
          <JsonPanel title="出力" :value="requestOutput" empty-label="出力データはありません" />
        </div>
      </template>

      <template #error>
        <div
          v-if="item.errorMessage"
          class="rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <div class="flex items-center gap-2 text-sm font-semibold text-red-700">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-5 w-5" />
            エラー内容
          </div>
          <pre class="mt-3 whitespace-pre-wrap break-words text-xs text-red-900">{{ item.errorMessage }}</pre>
        </div>
        <div v-else class="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          エラー情報はありません
        </div>
      </template>

      <template #raw>
        <JsonPanel title="元データ" :value="item.originalDoc" />
      </template>
    </UTabs>
  </EnModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { WorkflowItem } from "@models/workflowItem";
import JsonPanel from "./WorkflowExecutionJsonPanel.vue";

const props = defineProps<{
  open: boolean;
  item: WorkflowItem | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const activeTab = ref("overview");
const tabs = [
  { label: "概要", value: "overview", slot: "overview" },
  { label: "入出力", value: "payload", slot: "payload" },
  { label: "エラー", value: "error", slot: "error" },
  { label: "RAW", value: "raw", slot: "raw" },
];

watch(
  () => props.open,
  (open) => {
    if (open) activeTab.value = "overview";
  }
);

const sourceLabel = computed(() =>
  props.item?.sourceKind === "adkSession" ? "AIスタジオ" : "ワークフロー"
);

const statusLabel = computed(
  () =>
    ({
      pending: "待機中",
      running: "実行中",
      completed: "完了",
      error: "エラー",
    })[props.item?.status ?? "pending"]
);

const statusColor = computed(() => {
  if (props.item?.status === "completed") return "success";
  if (props.item?.status === "error") return "error";
  if (props.item?.status === "running") return "info";
  return "neutral";
});

const formatDate = (date: Date): string =>
  date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

const durationLabel = computed(() => {
  if (!props.item) return "";
  const durationMs = Math.max(
    0,
    props.item.updatedAt.getTime() - props.item.createdAt.getTime()
  );
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `実行時間 ${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `実行時間 ${minutes}分${seconds % 60}秒`;
  return `実行時間 ${Math.floor(minutes / 60)}時間${minutes % 60}分`;
});

const overviewRows = computed(() => {
  if (!props.item) return [];
  return [
    { label: "ジョブID", value: props.item.id },
    { label: "種別", value: sourceLabel.value },
    { label: "内容", value: props.item.label },
    { label: "開始", value: formatDate(props.item.createdAt) },
    { label: "更新", value: formatDate(props.item.updatedAt) },
  ];
});

const originalDoc = computed<Record<string, unknown>>(() =>
  props.item?.originalDoc && typeof props.item.originalDoc === "object"
    ? (props.item.originalDoc as Record<string, unknown>)
    : {}
);
const adkTaskBucket = computed<Record<string, unknown> | null>(() => {
  if (props.item?.sourceKind !== "adkSession") return null;
  const state = originalDoc.value.state;
  if (!state || typeof state !== "object") return null;
  const bucket = (state as Record<string, unknown>)[props.item.itemType];
  return bucket && typeof bucket === "object"
    ? (bucket as Record<string, unknown>)
    : null;
});

const requestInput = computed(
  () =>
    originalDoc.value.input ??
    (adkTaskBucket.value
      ? {
          setup: adkTaskBucket.value.setup,
          payload: adkTaskBucket.value.payload,
        }
      : undefined)
);
const requestOutput = computed(
  () =>
    originalDoc.value.output ??
    (adkTaskBucket.value
      ? {
          artifact: adkTaskBucket.value.artifact,
          invoke: adkTaskBucket.value.invoke,
        }
      : undefined)
);
</script>
