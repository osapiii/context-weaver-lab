<template>
  <EnModal
    v-model:open="modalIsOpen"
    title="知識フォルダを作成"
    size="2xl"
    header-variant="default"
    padding="lg"
    :close-on-backdrop="!store.isLoading"
  >
    <div class="space-y-4">
      <UFormField
        label="表示名"
        description="知識フォルダの表示名を入力してください（オプション）"
      >
        <UInput
          v-model="displayName"
          placeholder="例: プロジェクトAのナレッジベース"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="説明"
        description="知識フォルダの説明を入力してください（オプション）"
      >
        <UTextarea
          v-model="description"
          placeholder="例: プロジェクトAに関するドキュメントや資料を管理するための知識フォルダです"
          size="lg"
          :rows="4"
          class="w-full"
        />
      </UFormField>

      <EnAlert
        v-if="store.crudError"
        color="error"
        :title="store.crudError"
      />
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        :disabled="store.isLoading"
        @click="handleClose"
      >
        キャンセル
      </UButton>
      <UButton
        color="primary"
        size="lg"
        :loading="store.isLoading"
        :disabled="store.isLoading"
        @click="handleCreate"
      >
        作成
      </UButton>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import { useGeminiFileSpaceSnapshot } from "@composables/useGeminiFileSpaceSnapshot";
import log from "@utils/logger";
import EnModal from "@components/EnModal.vue";

//#region Props & Emits
const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  created: [requestId: string];
}>();

const modalIsOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
//#endregion

//#region Stores
const store = useGeminiFileSpaceOperatorStore();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
//#endregion

//#region State
const displayName = ref<string>("");
const description = ref<string>("");
//#endregion

//#region Methods
const handleClose = () => {
  displayName.value = "";
  description.value = "";
  store.crudError = null;
  modalIsOpen.value = false;
};

const handleCreate = async () => {
  try {
    const organizationId = organizationStore.getLoggedInOrganizationId;
    const spaceId = spaceStore.selectedSpace?.id;

    if (!organizationId) {
      store.crudError = "組織が選択されていません";
      return;
    }

    if (!spaceId) {
      store.crudError = "Spaceが選択されていません";
      return;
    }

    // FileSpaceを作成（Store側でRequestDoc作成）
    const requestDoc = await store.createFileSpace({
      displayName: displayName.value || undefined,
      description: description.value || undefined,
      organizationId,
      spaceId,
    });

    if (!requestDoc) {
      store.crudError = "知識フォルダの作成に失敗しました";
      return;
    }

    log("INFO", "FileSpaceRequest created", {
      requestId: requestDoc.id,
      operationType: requestDoc.input.operationType,
    });

    // RequestDocの変更を監視開始
    // completedになったら、useGeminiFileSpaceSnapshot内で自動的にFirestoreに永続化される
    useGeminiFileSpaceSnapshot(requestDoc.id);

    // 作成成功時はModalを閉じる
    handleClose();
    emit("created", requestDoc.id);
  } catch (error) {
    log("ERROR", "Failed to create FileSpaceRequest", error);
    store.crudError = "知識フォルダの作成に失敗しました";
  }
};
//#endregion

//#region Watchers
// Modalが閉じられたときにエラーをクリア
watch(modalIsOpen, (isOpen) => {
  if (!isOpen) {
    store.crudError = null;
    displayName.value = "";
    description.value = "";
  }
});
//#endregion
</script>
