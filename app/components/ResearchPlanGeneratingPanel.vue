<template>
  <div
    class="mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-4 py-10 text-center"
    data-testid="research-plan-generating-panel"
  >
    <div
      class="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-600"
    >
      <UIcon
        name="material-symbols:psychology-outline"
        class="h-8 w-8 animate-pulse"
      />
    </div>
    <div class="space-y-2">
      <h2 class="text-lg font-bold text-neutral-900">
        調査プランを組み立てています
      </h2>
      <p class="text-sm leading-relaxed text-neutral-600">
        AI が Briefing 内容から 1 問 1 答の構成案を作成中です。
        完了すると編集画面が表示されます。
      </p>
    </div>
    <ResearchAgentTerminalLog
      v-if="showProgress"
      class="w-full"
    />
  </div>
</template>

<script setup lang="ts">
import ResearchAgentTerminalLog from "@components/ResearchAgentTerminalLog.vue";

withDefaults(
  defineProps<{
    showProgress?: boolean;
  }>(),
  {
    showProgress: false,
  },
);
</script>
