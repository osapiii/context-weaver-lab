<template>
  <EnModal
    v-model:open="isOpen"
    title="スペースを選択"
    subtitle="作業内容ごとにマスタ・設定が分離されます"
    size="3xl"
    header-variant="default"
    padding="lg"
  >
    <!-- スペース一覧 (URadioGroup) -->
    <URadioGroup
      v-model="selectedSpaceId"
      :items="radioItems"
      variant="table"
      orientation="vertical"
      value-key="value"
      label-key="label"
      description-key="description"
    >
      <template #label="{ item }">
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <span class="font-semibold">{{ item.label }}</span>
            <EnBadge
              v-if="item.isDefault"
              color="primary"
              variant="soft"
              size="xs"
            >
              デフォルト
            </EnBadge>
          </div>
        </div>
      </template>
      <template #description="{ item }">
        <div class="flex flex-col gap-1">
          <p class="text-sm text-gray-600">
            {{ item.description || "説明なし" }}
          </p>
          <span class="text-xs text-gray-400">
            作成日: {{ formatDate(item.createdAt) }}
          </span>
        </div>
      </template>
    </URadioGroup>

    <!-- 空状態 -->
    <div v-if="spaces.length === 0" class="text-center py-12">
      <UIcon
        name="i-heroicons-cube"
        class="w-16 h-16 mx-auto text-gray-300 mb-4"
      />
      <p class="text-gray-600 mb-4">スペースが作成されていません</p>
      <UButton color="primary" size="md" @click="openCreateModal">
        最初のスペースを作成
      </UButton>
    </div>

    <template #footer>
      <UButton
        variant="outline"
        size="md"
        :icon="actionIcons.add"
        class="mr-auto"
        @click="openCreateModal"
      >
        新しいスペースを作成
      </UButton>
      <UButton variant="ghost" size="md" @click="handleClose">
        閉じる
      </UButton>
    </template>
  </EnModal>

  <!-- スペース作成モーダル -->
  <SpaceCreateModal v-model="isCreateModalOpen" />
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Timestamp } from "firebase/firestore";
import { useSpaceStore } from "@stores/space";
import { useActionIcons } from "@composables/useActionIcons";
import log from "@utils/logger";
import EnModal from "@components/EnModal.vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();

const spaceStore = useSpaceStore();
const actionIcons = useActionIcons();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const isCreateModalOpen = ref(false);
// ✅ currentUserSpacesが空の場合、spaces stateを直接参照（フォールバック）
const spaces = computed(() => {
  const userSpaces = spaceStore.currentUserSpaces;
  if (userSpaces.length === 0 && spaceStore.spaces.length > 0) {
    log(
      "WARN",
      "SpaceSelectModal: currentUserSpaces is empty, using spaces state as fallback"
    );
    return spaceStore.spaces.filter((s) => !s.deletedAt);
  }
  return userSpaces;
});
const selectedSpace = computed(() => spaceStore.selectedSpace);

// ✅ URadioGroup用のitems配列
const radioItems = computed(() => {
  return spaces.value.map((space) => ({
    value: space.id,
    label: space.name,
    description: space.description,
    isDefault: space.isDefault,
    createdAt: space.createdAt,
  }));
});

// ✅ 選択中のSpace ID
const selectedSpaceId = ref<string | null>(selectedSpace.value?.id || null);

// ✅ selectedSpaceIdの変更を監視
watch(selectedSpaceId, async (newValue) => {
  if (newValue && newValue !== selectedSpace.value?.id) {
    await handleSelectSpace(newValue);
  }
});

// ✅ selectedSpaceの変更を監視（外部からの変更に対応）
watch(
  selectedSpace,
  (newSpace) => {
    if (newSpace?.id !== selectedSpaceId.value) {
      selectedSpaceId.value = newSpace?.id || null;
    }
  },
  { immediate: true }
);

// ✅ モーダルが開かれたときにSpace一覧を取得
watch(isOpen, async (isOpenValue) => {
  if (isOpenValue) {
    try {
      // Space一覧が空の場合、または初回表示時に取得
      if (spaceStore.spaces.length === 0) {
        await spaceStore.fetchSpaces();
        log(
          "INFO",
          "SpaceSelectModal: fetched spaces",
          spaceStore.spaces.length
        );
      }
    } catch (error) {
      log("ERROR", "SpaceSelectModal: failed to fetch spaces", error);
    }
  }
});

/**
 * ✅ スペースを選択（切り替え処理）
 */
const handleSelectSpace = async (spaceId: string | null) => {
  if (!spaceId) return;

  try {
    // spaceStore.selectSpace() が内部で clearAllStores() を実行
    await spaceStore.selectSpace({ spaceId });

    // ✅ 切り替え完了後、モーダルを閉じる
    isOpen.value = false;
  } catch (error) {
    log("ERROR", "Space selection failed", error);
  }
};

const openCreateModal = () => {
  isCreateModalOpen.value = true;
};

const handleClose = () => {
  isOpen.value = false;
};

const formatDate = (timestamp: Timestamp | null | undefined) => {
  if (!timestamp || typeof timestamp.toDate !== "function") return "";
  const date = timestamp.toDate();
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};
</script>
