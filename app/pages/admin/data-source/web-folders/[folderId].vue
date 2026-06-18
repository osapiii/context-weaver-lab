<template>
  <div class="space-y-5">
    <AdminModePageNav
      current-page-label="Webディレクトリ詳細"
      :trail="breadcrumbLinks"
    />

    <EnAlert
      v-if="defaultFileSpaceError"
      color="error"
      :title="`素材プールの取得に失敗: ${defaultFileSpaceError}`"
    />

    <div v-else-if="isLoading" class="space-y-4">
      <USkeleton class="h-16 w-full rounded-lg" />
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <USkeleton v-for="i in 3" :key="i" class="h-40 rounded-lg" />
      </div>
    </div>

    <EnAlert
      v-else-if="!folder"
      color="warning"
      title="ディレクトリが見つかりません"
      description="削除済み、または別の素材プールのディレクトリの可能性があります"
    >
      <template #actions>
        <EnButton
          variant="soft"
          color="neutral"
          size="sm"
          leading-icon="i-heroicons-arrow-left"
          @click="goBackToList"
        >
          一覧へ戻る
        </EnButton>
      </template>
    </EnAlert>

    <WebCrawlFolderDetailView
      v-else
      :folder="folder"
      :file-space-id="resolvedFileSpaceId"
      @open-job="onGroupClick"
      @delete-job="onDeleteClick"
      @folder-deleted="goBackToList"
      @refresh="refreshAll"
    />

    <WebCrawlGroupDetailModal
      v-model:open="isDetailOpen"
      :group="selectedGroup"
      @delete-group="onDeleteGroup"
      @refresh="refreshAll"
    />

    <EnModal
      v-model:open="isConfirmOpen"
      title="この取り込みを削除しますか?"
      title-icon="i-heroicons-trash"
      size="md"
      header-variant="warning"
      padding="md"
    >
      <div v-if="pendingDeleteGroup" class="space-y-3">
        <p class="text-sm text-gray-700">
          <span class="font-bold">{{ pendingDeleteGroup.title || pendingDeleteGroup.hostname }}</span>
          の
          <span class="font-bold text-purple-700">{{ pendingDeleteGroup.markdownCount }} ページ</span>
          と
          <span class="font-bold text-violet-700">{{ pendingDeleteGroup.imageCount }} 画像</span>
          を削除します。
        </p>
        <p class="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200">
          AI索引、内部ストレージ、取得済みWebページ/画像を削除します。この操作は元に戻せません。
        </p>
      </div>

      <template #footer>
        <EnButton
          variant="ghost"
          color="neutral"
          :disabled="isDeletingGroup"
          @click="isConfirmOpen = false"
        >
          キャンセル
        </EnButton>
        <EnButton
          variant="solid"
          color="error"
          leading-icon="i-heroicons-trash"
          :loading="isDeletingGroup"
          @click="confirmDeleteGroup"
        >
          削除する
        </EnButton>
      </template>
    </EnModal>
  </div>
</template>

<script setup lang="ts">
import type { WebCrawlFolderGroup, WebCrawlGroup } from "../../../../types/webCrawlGroup";
import EnButton from "@components/EnButton.vue";
import EnModal from "@components/EnModal.vue";
import WebCrawlFolderDetailView from "@components/dataSource/WebCrawlFolderDetailView.vue";
import WebCrawlGroupDetailModal from "@components/dataSource/WebCrawlGroupDetailModal.vue";
import { useDefaultFileSpace } from "@composables/useDefaultFileSpace";
import { useKnowledgeOperator } from "@composables/useKnowledgeOperator";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useSpaceStore } from "@stores/space";
import { useWebCrawlRequestStore } from "@stores/webCrawlRequest";
import { buildWebCrawlFolders, buildWebCrawlGroups } from "@utils/webCrawlFolders";

definePageMeta({
  layout: "admin",
  adminPageStack: false,
});

const route = useRoute();
const router = useRouter();
const toast = useToast();
const spaceStore = useSpaceStore();
const fileSpaceStore = useGeminiFileSpaceOperatorStore();
const webCrawlStore = useWebCrawlRequestStore();
const { deleteKnowledgeBulk } = useKnowledgeOperator();
const {
  fileSpaceId,
  isLoading: isLoadingDefaultFileSpace,
  error: defaultFileSpaceError,
} = useDefaultFileSpace();

const selectedGroup = ref<WebCrawlGroup | null>(null);
const isDetailOpen = ref(false);
const pendingDeleteGroup = ref<WebCrawlGroup | null>(null);
const isConfirmOpen = ref(false);
const isDeletingGroup = ref(false);

const routeFolderId = computed(() => String(route.params.folderId || ""));
const resolvedFileSpaceId = computed(() =>
  typeof route.query.fileSpaceId === "string" ? route.query.fileSpaceId : fileSpaceId.value
);

const groups = computed(() => buildWebCrawlGroups(fileSpaceStore.documents));
const folders = computed<WebCrawlFolderGroup[]>(() =>
  buildWebCrawlFolders({
    groups: groups.value,
    requests: webCrawlStore.recentRequests,
    fileSpaceId: resolvedFileSpaceId.value,
    spaceId: spaceStore.selectedSpace?.id,
  })
);
const folder = computed(
  () => folders.value.find((item) => item.folder.id === routeFolderId.value) ?? null
);
const isLoading = computed(
  () => isLoadingDefaultFileSpace.value || fileSpaceStore.isLoadingDocuments || webCrawlStore.isLoading
);

const breadcrumbLinks = computed(() => [
  { label: "AIを育てる", to: "/admin/data-source" },
  { label: folder.value?.folder.name ?? "Webディレクトリ詳細" },
]);

const refreshAll = async () => {
  await webCrawlStore.fetchRecentRequests();
  if (resolvedFileSpaceId.value) {
    await fileSpaceStore.fetchDocumentsFromFirestore(resolvedFileSpaceId.value);
  }
};

watch(
  resolvedFileSpaceId,
  async (newId) => {
    if (!newId) return;
    await refreshAll();
  },
  { immediate: true }
);

const goBackToList = () => {
  void router.push({ path: "/admin/data-source", query: { mode: "view" } });
};

const onGroupClick = (group: WebCrawlGroup) => {
  selectedGroup.value = group;
  isDetailOpen.value = true;
};

const onDeleteClick = (group: WebCrawlGroup) => {
  pendingDeleteGroup.value = group;
  isConfirmOpen.value = true;
};

const onDeleteGroup = (group: WebCrawlGroup) => {
  isDetailOpen.value = false;
  onDeleteClick(group);
};

const confirmDeleteGroup = async () => {
  const group = pendingDeleteGroup.value;
  if (!group) return;
  isDeletingGroup.value = true;
  try {
    const docs = [...group.markdownDocs, ...group.imageDocs, ...group.otherDocs];
    const result = await deleteKnowledgeBulk(docs, {
      storeId: resolvedFileSpaceId.value ?? undefined,
    });
    if (result.success > 0) {
      toast.add({
        title: "取り込みを削除しました",
        description:
          result.fail > 0
            ? `${result.success} 件成功 / ${result.fail} 件失敗`
            : `${result.success} 件を削除しました`,
        color: result.fail > 0 ? "warning" : "success",
      });
      isConfirmOpen.value = false;
      pendingDeleteGroup.value = null;
      await refreshAll();
    } else {
      toast.add({
        title: "削除に失敗しました",
        description: result.reasons[0] ?? "削除対象が見つかりませんでした",
        color: "error",
      });
    }
  } finally {
    isDeletingGroup.value = false;
  }
};
</script>
