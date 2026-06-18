<template>
  <EnModal
    :open="open"
    :title="folder?.folder.name || '取り込みフォルダ'"
    title-icon="i-heroicons-folder-open"
    size="full"
    fullscreen
    padding="none"
    @update:open="emit('update:open', $event)"
  >
    <UTabs
      v-if="folder"
      v-model="activeTab"
      :items="tabs"
      class="flex min-h-0 flex-1 flex-col"
      :ui="{
        list: 'shrink-0 border-b border-slate-200 px-5 dark:border-slate-800',
        content: 'min-h-0 flex-1 overflow-y-auto p-5',
      }"
    >
      <template #contents>
        <div class="mb-4 flex items-center justify-between gap-3">
          <p class="text-sm text-slate-500">
            このフォルダに追加したWebページを、取り込み単位で表示しています。
          </p>
          <EnBadge variant="soft" color="warning">
            {{ folder.jobs.length }}件
          </EnBadge>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <WebCrawlGroupVisualCard
            v-for="job in folder.jobs"
            :key="job.key"
            :group="job"
            @click="emit('open-job', job)"
            @delete="emit('delete-job', job)"
          />
        </div>
      </template>

      <template #history>
        <WorkflowExecutionAgGrid
          v-if="historyItems.length > 0"
          :items="historyItems"
          :grid-height-px="560"
          @open-result="openHistoryResult"
          @open-detail="openHistoryDetail"
        />
        <div v-else class="py-16 text-center text-sm text-slate-500">
          履歴はまだありません
        </div>
      </template>
    </UTabs>

    <WorkflowExecutionDetailModal
      v-model:open="historyDetailOpen"
      :item="selectedHistoryItem"
    />
  </EnModal>
</template>

<script setup lang="ts">
import type { WorkflowItem, WorkflowItemStatus } from "@models/workflowItem";
import type { DecodedWebCrawlRequest } from "@models/webCrawlRequest";
import type {
  WebCrawlFolderGroup,
  WebCrawlGroup,
} from "../../types/webCrawlGroup";
import EnBadge from "@components/EnBadge.vue";
import EnModal from "@components/EnModal.vue";
import WorkflowExecutionAgGrid from "@components/WorkflowExecutionAgGrid.vue";
import WorkflowExecutionDetailModal from "@components/workflow/WorkflowExecutionDetailModal.vue";
import WebCrawlGroupVisualCard from "./WebCrawlGroupVisualCard.vue";

const props = defineProps<{
  open: boolean;
  folder: WebCrawlFolderGroup | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "open-job": [job: WebCrawlGroup];
  "delete-job": [job: WebCrawlGroup];
}>();

const activeTab = ref("contents");
const historyDetailOpen = ref(false);
const selectedHistoryItem = ref<WorkflowItem | null>(null);
const tabs = [
  { label: "取り込み内容", value: "contents", slot: "contents" },
  { label: "履歴", value: "history", slot: "history" },
];

watch(
  () => props.open,
  (open) => {
    if (open) activeTab.value = "contents";
  }
);

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
};

const toStatus = (
  request: DecodedWebCrawlRequest
): WorkflowItemStatus => {
  const hasStepError = Object.values(request.steps ?? {}).some(
    (step) => step.status === "error"
  );
  if (
    request.errorMessage ||
    hasStepError ||
    request.workflow?.state === "FAILED" ||
    request.workflow?.state === "CANCELLED"
  ) {
    return "error";
  }
  if (request.status === "processing") return "running";
  if (request.status === "completed") return "completed";
  if (request.status === "error") return "error";
  return "pending";
};

const historyItems = computed<WorkflowItem[]>(() =>
  (props.folder?.requests ?? []).map((request) => ({
    id: `workflowRequest:webCrawlRequest:${request.id}`,
    sourceKind: "workflowRequest",
    itemType: "webCrawlRequest",
    label: "Webページ取り込み",
    color: "#14b8a6",
    status: toStatus(request),
    createdAt: toDate(request.createdAt),
    updatedAt: toDate(request.updatedAt),
    progressLabel: request.input.url,
    errorMessage: request.errorMessage ?? undefined,
    originalDoc: request,
  }))
);

const openHistoryDetail = (item: WorkflowItem) => {
  selectedHistoryItem.value = item;
  historyDetailOpen.value = true;
};

const openHistoryResult = (item: WorkflowItem) => {
  const requestId = item.id.split(":").at(-1);
  const job = props.folder?.jobs.find((candidate) => candidate.key === requestId);
  if (job) emit("open-job", job);
};
</script>
