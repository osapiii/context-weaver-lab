<template>
  <div class="px-3 py-4 border-t border-gray-200 bg-white">
    <!-- スペース情報表示 -->
    <div class="mb-2">
      <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        現在のスペース
      </div>
      <div v-if="selectedSpace" class="space-y-1">
        <div class="text-sm font-bold text-gray-900 truncate">
          {{ selectedSpace.name }}
        </div>
        <div class="text-xs text-gray-500 font-mono truncate">
          ID: {{ selectedSpace.id }}
        </div>
      </div>
      <div v-else class="text-sm text-gray-500 italic">
        未選択
      </div>
    </div>

    <!-- ✅ スペース切り替えボタン -->
    <UButton
      color="primary"
      variant="outline"
      size="md"
      class="w-full"
      :icon="actionIcons.swap"
      @click="openModal"
    >
      スペースを切り替え
    </UButton>

    <!-- スペース選択モーダル -->
    <SpaceSelectModal v-model="isModalOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useSpaceStore } from "@stores/space";
import { useActionIcons } from "@composables/useActionIcons";

const actionIcons = useActionIcons();
const spaceStore = useSpaceStore();

const isModalOpen = ref(false);
const selectedSpace = computed(() => spaceStore.selectedSpace);

const openModal = () => {
  isModalOpen.value = true;
};
</script>

