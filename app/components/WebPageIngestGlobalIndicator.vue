<template>
  <button
    v-if="chipState !== 'hidden'"
    type="button"
    data-testid="web-ingest-footer-chip"
    class="inline-flex max-w-[min(280px,42vw)] items-center gap-2 rounded-md px-2.5 h-5 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
    :class="chipToneClass"
    :title="chipTitle"
    @click="onChipClick"
  >
    <UIcon
      :name="chipIcon"
      class="h-3.5 w-3.5 shrink-0"
      :class="{ 'animate-spin': chipState === 'running' }"
    />
    <span class="min-w-0 truncate text-left leading-tight">
      <span class="block truncate">{{ summary.primary }}</span>
      <span
        v-if="summary.secondary"
        class="block truncate text-[10px] font-medium opacity-75"
      >
        {{ summary.secondary }}
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useWebCrawlRequestStore } from "@stores/webCrawlRequest";
import { useWebCrawlGlobalIngest } from "@composables/useWebCrawlGlobalIngest";
import {
  resolveWebCrawlFooterChipState,
  webCrawlFooterSummary,
} from "@utils/webCrawlFooterChip";

useWebCrawlGlobalIngest();

const store = useWebCrawlRequestStore();
const {
  activeIngestSession: session,
  footerCompletedFlashUntil,
  activeWatchingRequest,
} = storeToRefs(store);

const chipState = computed(() =>
  resolveWebCrawlFooterChipState({
    session: session.value,
    completedFlashUntil: footerCompletedFlashUntil.value,
    activeRequest: activeWatchingRequest.value,
  })
);

const summary = computed(() =>
  webCrawlFooterSummary({
    session: session.value,
    activeRequest: activeWatchingRequest.value,
    chipState: chipState.value,
  })
);

const chipToneClass = computed(() => {
  switch (chipState.value) {
    case "running":
      return "bg-purple-500/20 text-purple-100 ring-1 ring-purple-400/40 hover:bg-purple-500/30";
    case "completedFlash":
      return "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30";
    case "error":
      return "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/40 hover:bg-rose-500/30";
    default:
      return "";
  }
});

const chipIcon = computed(() => {
  switch (chipState.value) {
    case "running":
      return "i-heroicons-arrow-path";
    case "completedFlash":
      return "i-heroicons-check-circle";
    case "error":
      return "i-heroicons-exclamation-circle";
    default:
      return "i-heroicons-globe-alt";
  }
});

const chipTitle = computed(() => {
  if (chipState.value === "running") {
    return "Web ページ取り込みの進捗を表示";
  }
  if (chipState.value === "error") {
    return "取り込みエラーの詳細を表示";
  }
  return "Web ページ取り込み";
});

const onChipClick = () => {
  if (chipState.value === "hidden") return;
  store.openIngestProgressModal();
};
</script>
