<template>
  <div v-if="folder" class="space-y-5">
    <EnAiPageHeader
      :title="folder.folder.name"
      :subtitle="folder.folder.description || 'このフォルダに追加したWebページを、取り込み単位で表示しています。'"
      icon="i-heroicons-folder-open"
    >
      <template #trailing>
        <EnButton
          variant="soft"
          color="neutral"
          size="sm"
          leading-icon="i-heroicons-pencil-square"
          @click="openEdit"
        >
          基本情報を修正
        </EnButton>
        <EnButton
          variant="ghost"
          color="error"
          size="sm"
          leading-icon="i-heroicons-trash"
          @click="openDelete"
        >
          削除
        </EnButton>
      </template>
    </EnAiPageHeader>

    <div
      class="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
    >
      <div class="flex items-center gap-2 text-slate-600">
        <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4 text-slate-400" />
        <span class="font-semibold tabular-nums text-slate-900">{{ folder.jobs.length }}</span>
        <span>取り込み</span>
      </div>
      <div class="flex items-center gap-2 text-slate-600">
        <UIcon name="i-heroicons-document-text" class="h-4 w-4 text-slate-400" />
        <span class="font-semibold tabular-nums text-slate-900">{{ folder.pageCount }}</span>
        <span>Webページ</span>
      </div>
      <div class="flex items-center gap-2 text-slate-600">
        <UIcon name="i-heroicons-photo" class="h-4 w-4 text-slate-400" />
        <span class="font-semibold tabular-nums text-slate-900">{{ folder.imageCount }}</span>
        <span>画像</span>
      </div>
      <div class="flex items-center gap-2 text-slate-500 sm:ml-auto">
        <UIcon name="i-heroicons-clock" class="h-4 w-4 text-slate-400" />
        <span>最終取り込み</span>
        <span class="font-semibold text-slate-800">{{ latestText || "-" }}</span>
      </div>
    </div>

    <UTabs
      v-model="activeTab"
      :items="tabs"
      :ui="{
        list: 'border-b border-slate-200 dark:border-slate-800',
        content: 'pt-5',
      }"
    >
      <template #contents>
        <div class="mb-4 flex items-center justify-between gap-3">
          <p class="text-sm text-slate-500">
            このディレクトリに追加されたWebページを取り込み単位で表示しています。
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

    <EnModal
      v-model:open="isEditOpen"
      title="基本情報を修正"
      title-icon="i-heroicons-pencil-square"
      size="lg"
      padding="md"
    >
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-xs font-semibold text-slate-600">
            ディレクトリ名
          </label>
          <UInput v-model="editName" placeholder="ディレクトリ名" />
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-semibold text-slate-600">
            説明
          </label>
          <UTextarea
            v-model="editDescription"
            :rows="4"
            placeholder="どういったページの情報を集めるかを補足します"
          />
        </div>
      </div>
      <template #footer>
        <EnButton variant="ghost" color="neutral" @click="isEditOpen = false">
          キャンセル
        </EnButton>
        <EnButton
          variant="solid"
          color="primary"
          leading-icon="i-heroicons-check"
          :loading="isSaving"
          @click="saveEdit"
        >
          保存
        </EnButton>
      </template>
    </EnModal>

    <EnModal
      v-model:open="isDeleteOpen"
      title="ディレクトリごと削除しますか?"
      title-icon="i-heroicons-trash"
      size="md"
      header-variant="warning"
      padding="md"
    >
      <div class="space-y-3 text-sm text-slate-700">
        <p>
          <span class="font-bold">{{ folder.folder.name }}</span>
          の
          <span class="font-bold text-purple-700">{{ folder.pageCount }} ページ</span>
          と
          <span class="font-bold text-violet-700">{{ folder.imageCount }} 画像</span>
          を削除します。
        </p>
        <p class="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200">
          AI索引、内部ストレージ、取得済みWebページ/画像、取り込み履歴を削除します。この操作は元に戻せません。
        </p>
        <div>
          <label class="mb-1.5 block text-xs font-semibold text-slate-600">
            確認のためディレクトリ名を入力
          </label>
          <UInput
            v-model="deleteConfirmName"
            :placeholder="folder.folder.name"
            :disabled="isDeleting"
          />
        </div>
      </div>
      <template #footer>
        <EnButton
          variant="ghost"
          color="neutral"
          :disabled="isDeleting"
          @click="isDeleteOpen = false"
        >
          キャンセル
        </EnButton>
        <EnButton
          variant="solid"
          color="error"
          leading-icon="i-heroicons-trash"
          :loading="isDeleting"
          :disabled="!canDeleteFolder"
          @click="deleteFolder"
        >
          削除する
        </EnButton>
      </template>
    </EnModal>

    <WorkflowExecutionDetailModal
      v-model:open="historyDetailOpen"
      :item="selectedHistoryItem"
    />
  </div>
</template>

<script setup lang="ts">
import type { WorkflowItem, WorkflowItemStatus } from "@models/workflowItem";
import type { DecodedWebCrawlRequest } from "@models/webCrawlRequest";
import type { WebCrawlFolderGroup, WebCrawlGroup } from "../../types/webCrawlGroup";
import EnAiPageHeader from "@components/ai/EnAiPageHeader.vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import EnModal from "@components/EnModal.vue";
import WorkflowExecutionAgGrid from "@components/WorkflowExecutionAgGrid.vue";
import WorkflowExecutionDetailModal from "@components/workflow/WorkflowExecutionDetailModal.vue";
import { useKnowledgeOperator } from "@composables/useKnowledgeOperator";
import { useWebCrawlRequestStore } from "@stores/webCrawlRequest";
import WebCrawlGroupVisualCard from "./WebCrawlGroupVisualCard.vue";

const props = defineProps<{
  folder: WebCrawlFolderGroup | null;
  fileSpaceId: string | null;
}>();

const emit = defineEmits<{
  "open-job": [job: WebCrawlGroup];
  "delete-job": [job: WebCrawlGroup];
  "folder-deleted": [];
  refresh: [];
}>();

const toast = useToast();
const webCrawlStore = useWebCrawlRequestStore();
const { deleteKnowledgeBulk } = useKnowledgeOperator();
const activeTab = ref("contents");
const isEditOpen = ref(false);
const isDeleteOpen = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);
const editName = ref("");
const editDescription = ref("");
const deleteConfirmName = ref("");
const historyDetailOpen = ref(false);
const selectedHistoryItem = ref<WorkflowItem | null>(null);

const tabs = [
  { label: "取り込み内容", value: "contents", slot: "contents" },
  { label: "履歴", value: "history", slot: "history" },
];

const latestText = computed(() =>
  props.folder?.latestAt ? props.folder.latestAt.toLocaleDateString("ja-JP") : ""
);

const canDeleteFolder = computed(
  () =>
    !isDeleting.value &&
    !!props.folder &&
    deleteConfirmName.value.trim() === props.folder.folder.name
);

const allDocs = computed(() =>
  props.folder
    ? props.folder.jobs.flatMap((job) => [
        ...job.markdownDocs,
        ...job.imageDocs,
        ...job.otherDocs,
      ])
    : []
);

const openEdit = () => {
  if (!props.folder) return;
  editName.value = props.folder.folder.name;
  editDescription.value = props.folder.folder.description ?? "";
  isEditOpen.value = true;
};

const openDelete = () => {
  deleteConfirmName.value = "";
  isDeleteOpen.value = true;
};

const saveEdit = async () => {
  if (!props.folder) return;
  isSaving.value = true;
  try {
    const result = await webCrawlStore.updateImportFolder(props.folder.folder.id, {
      name: editName.value,
      description: editDescription.value,
    });
    if (!result.ok) {
      toast.add({
        title: "更新に失敗しました",
        description: result.error,
        color: "error",
      });
      return;
    }
    isEditOpen.value = false;
    toast.add({ title: "基本情報を更新しました", color: "success" });
    emit("refresh");
  } finally {
    isSaving.value = false;
  }
};

const deleteFolder = async () => {
  if (!props.folder || !canDeleteFolder.value) return;
  isDeleting.value = true;
  try {
    const docs = allDocs.value;
    const deletion = docs.length
      ? await deleteKnowledgeBulk(docs, {
          storeId: props.fileSpaceId ?? undefined,
        })
      : { success: 0, fail: 0, reasons: [] };
    const requestDeletion = await webCrawlStore.deleteImportFolderRequests(
      props.folder.folder.id
    );
    if (deletion.fail > 0 || !requestDeletion.ok) {
      toast.add({
        title: "一部の削除に失敗しました",
        description:
          deletion.reasons[0] ?? requestDeletion.error ?? "詳細はログを確認してください",
        color: "warning",
      });
      emit("refresh");
      return;
    }
    toast.add({
      title: "ディレクトリを削除しました",
      description: `${deletion.success} 件の素材と ${requestDeletion.deleted} 件の履歴を削除しました`,
      color: "success",
    });
    isDeleteOpen.value = false;
    emit("folder-deleted");
  } finally {
    isDeleting.value = false;
  }
};

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

const toStatus = (request: DecodedWebCrawlRequest): WorkflowItemStatus => {
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
