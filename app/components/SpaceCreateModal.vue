<template>
  <EnModal
    v-model:open="isOpen"
    title="新しいスペースを作成"
    size="2xl"
    header-variant="default"
    padding="lg"
    :close-on-backdrop="!spaceStore.isLoading"
  >
    <div class="space-y-4">
      <UFormField label="スペース名" required>
        <UInput
          v-model="spaceName"
          placeholder="例: プロジェクトA"
          size="lg"
          class="w-2/3"
          :disabled="spaceStore.isLoading"
        />
      </UFormField>

      <UFormField
        label="説明"
        description="スペースの説明を入力してください（オプション）"
      >
        <UTextarea
          v-model="spaceDescription"
          placeholder="例: プロジェクトAの作業スペース"
          :rows="3"
          :disabled="spaceStore.isLoading"
          class="w-2/3"
        />
      </UFormField>

      <UFormField>
        <UCheckbox
          v-model="isDefault"
          label="デフォルトスペースとして設定"
          :disabled="spaceStore.isLoading"
        />
      </UFormField>

      <!-- エラーメッセージ表示 -->
      <EnAlert
        v-if="spaceStore.error"
        color="error"
        :title="spaceStore.error"
      />
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        :disabled="spaceStore.isLoading"
        @click="handleClose"
      >
        キャンセル
      </UButton>
      <UButton
        color="primary"
        size="lg"
        :loading="spaceStore.isLoading"
        :disabled="spaceStore.isLoading || !spaceName.trim()"
        @click="handleCreate"
      >
        作成
      </UButton>
    </template>
  </EnModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useSpaceStore } from "@stores/space";
import log from "@utils/logger";
import EnModal from "@components/EnModal.vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();

const spaceStore = useSpaceStore();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const spaceName = ref("");
const spaceDescription = ref("");
const isDefault = ref(false);

const handleClose = () => {
  spaceName.value = "";
  spaceDescription.value = "";
  isDefault.value = false;
  spaceStore.error = null;
  isOpen.value = false;
};

const handleCreate = async () => {
  try {
    if (!spaceName.value.trim()) {
      spaceStore.error = "スペース名を入力してください";
      return;
    }

    await spaceStore.createSpace({
      input: {
        name: spaceName.value.trim(),
        description: spaceDescription.value.trim() || undefined,
        isDefault: isDefault.value,
      },
    });

    log("INFO", "Space created successfully");
    handleClose();
  } catch (error) {
    log("ERROR", "Failed to create space", error);
    // エラーは spaceStore.error に設定される
  }
};

// Modalが閉じられたときにエラーをクリア
watch(isOpen, (isOpenValue) => {
  if (!isOpenValue) {
    spaceStore.error = null;
    spaceName.value = "";
    spaceDescription.value = "";
    isDefault.value = false;
  }
});
</script>
