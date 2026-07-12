<template>
  <USlideover
    v-model:open="store.isOpen"
    :side="slideoverSide"
    :ui="slideoverUi"
  >
    <template #content>
      <EnAssistantPanel />
    </template>
  </USlideover>
</template>

<script lang="ts" setup>
/**
 * EN AIstudio 統合アシスタントの Slideover ラッパー。
 *
 * - PC: 右側から (相談を継続しやすい)
 * - モバイル: bottom から (画面占有が小さい)
 *
 * 旧 AssistantBottomSheet (bottom 75vh) と 旧 AIChatPanel Slideover (right) を 1 つに統合。
 */

const store = useEnAiStudioAssistantStore();
const { isMobile } = useIsMobile();

const slideoverSide = computed<"right" | "bottom">(() =>
  isMobile.value ? "bottom" : "right"
);

const slideoverUi = computed(() => {
  if (isMobile.value) {
    return {
      content: "h-[85vh] rounded-t-3xl",
    };
  }
  return {
    content: "w-full sm:max-w-[640px]",
  };
});
</script>
