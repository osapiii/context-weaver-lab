<template>
  <button
    type="button"
    class="hidden items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-400/20 sm:inline-flex"
    title="経営相談を開く"
    aria-label="経営相談を開く"
    @click="openConsultation"
  >
    <UIcon name="material-symbols:chat-outline" class="h-4 w-4" />
    <span>経営相談</span>
  </button>
</template>

<script setup lang="ts">
const assistantStore = useEnAiStudioAssistantStore();

const openConsultation = () => {
  assistantStore.open();
};
</script>
