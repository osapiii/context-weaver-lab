<template>
  <div class="space-y-5">
    <AdminModePageNav current-page-label="ナレッジ素材" />
    <EnAiPageHeader
      title="AI を育てる"
      subtitle="PDF や文書を AI に教えると、経営相談や AI 部下の回答精度が上がります"
      :icon="navModeIcons.grow"
    >
      <template #trailing>
        <UTabs
          v-model="mode"
          :items="modeTabs"
          variant="pill"
          size="sm"
          :content="false"
        />
      </template>
    </EnAiPageHeader>

    <!-- 素材プール準備中メッセージ -->
    <EnAlert
      v-if="defaultFileSpaceError"
      color="error"
      :title="`素材プールの取得に失敗: ${defaultFileSpaceError}`"
    />
    <EnAlert
      v-else-if="isLoadingDefaultFileSpace && !fileSpaceId"
      title="素材プールを準備中..."
      description="初回アクセス時は数秒〜十数秒かかります"
    />

    <!-- モード本体: transition でスッと切り替え -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-4"
      mode="out-in"
    >
      <DataSourceUploadMode
        v-if="mode === 'upload'"
        :file-space-id="fileSpaceId"
        :documents="documents"
        :is-loading-documents="isLoadingDocuments"
        @refresh="onRefreshDocuments"
        @switch-to-view="mode = 'view'"
      />
      <DataSourceViewMode
        v-else
        :file-space-id="fileSpaceId"
        :documents="documents"
        :is-loading-documents="isLoadingDocuments"
        @refresh="onRefreshDocuments"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { storeToRefs } from "pinia";
import EnAiPageHeader from "@components/ai/EnAiPageHeader.vue";
import { useNavModeIcons } from "@composables/useNavModeIcons";
import DataSourceUploadMode from "@components/dataSource/DataSourceUploadMode.vue";
import DataSourceViewMode from "@components/dataSource/DataSourceViewMode.vue";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useDefaultFileSpace } from "@composables/useDefaultFileSpace";
import { useGoogleDriveFolderSync } from "@composables/useGoogleDriveFolderSync";

defineOptions({
  name: "AdminDataSourcePage",
});

const navModeIcons = useNavModeIcons();

type DataSourceMode = "upload" | "view";

const modeTabs = [
  {
    value: "upload",
    label: "知識を教える",
    icon: "i-heroicons-academic-cap",
  },
  {
    value: "view",
    label: "知識を確認",
    icon: "i-heroicons-magnifying-glass",
  },
];

definePageMeta({
  layout: "admin",
  adminPageStack: false,
});

const route = useRoute();
const mode = ref<DataSourceMode>(route.query.mode === "view" ? "view" : "upload");

const fileSpaceStore = useGeminiFileSpaceOperatorStore();
const { documents, isLoadingDocuments } = storeToRefs(fileSpaceStore);

const {
  fileSpaceId,
  isLoading: isLoadingDefaultFileSpace,
  error: defaultFileSpaceError,
} = useDefaultFileSpace();

// fileSpaceId 解決後に Document 一覧をロード
watch(
  fileSpaceId,
  async (newId) => {
    if (!newId) return;
    await fileSpaceStore.fetchDocumentsFromFirestore(newId);
  },
  { immediate: false }
);

const onRefreshDocuments = async () => {
  if (!fileSpaceId.value) return;
  await fileSpaceStore.fetchDocumentsFromFirestore(fileSpaceId.value);
};

const { syncCompletedTick } = useGoogleDriveFolderSync();

// pending scan / active job 監視は admin layout (useGoogleDriveGlobalSync) が担当

watch(syncCompletedTick, () => {
  void onRefreshDocuments();
});

watch(
  () => route.query.mode,
  (nextMode) => {
    if (nextMode === "view" || nextMode === "upload") {
      mode.value = nextMode;
    }
  }
);
</script>
