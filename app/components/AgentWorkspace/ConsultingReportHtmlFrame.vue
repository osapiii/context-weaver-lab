<template>
  <div
    class="flex h-full min-h-0 flex-col"
    data-testid="consulting-report-html-frame"
  >
    <div
      v-if="showToolbar"
      class="flex flex-shrink-0 items-center justify-between gap-2 border-b border-neutral-200/80 bg-[#f4f4f5] px-3 py-2"
    >
      <p class="truncate text-[11px] font-medium text-neutral-600">
        レポートプレビュー
      </p>
      <div class="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          class="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-neutral-700 hover:bg-white/80"
          title="縮小"
          @click="adjustZoom(-0.1)"
        >
          <UIcon name="material-symbols:zoom-out" class="h-3.5 w-3.5" />
        </button>
        <span class="min-w-[2.5rem] text-center text-[10px] tabular-nums text-neutral-500">
          {{ Math.round(zoom * 100) }}%
        </span>
        <button
          type="button"
          class="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-neutral-700 hover:bg-white/80"
          title="拡大"
          @click="adjustZoom(0.1)"
        >
          <UIcon name="material-symbols:zoom-in" class="h-3.5 w-3.5" />
        </button>
        <button
          v-if="allowFullscreen"
          type="button"
          class="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-neutral-700 hover:bg-white/80"
          title="全画面"
          @click="fullscreenOpen = true"
        >
          <UIcon name="material-symbols:fullscreen" class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div
      class="min-h-0 flex-1 overflow-auto bg-[#e8e8ea] p-4 sm:p-6"
      :class="compact ? 'p-2' : ''"
    >
      <div
        class="mx-auto origin-top shadow-xl ring-1 ring-neutral-300/60 transition-transform"
        :style="paperStyle"
      >
        <iframe
          :srcdoc="normalizedHtml"
          sandbox="allow-same-origin"
          class="block w-full border-0 bg-white"
          :class="compact ? 'min-h-[12rem]' : 'min-h-[32rem]'"
          :style="{ height: iframeHeight }"
          :title="title"
          referrerpolicy="no-referrer"
        />
      </div>
    </div>

    <EnModal
      v-if="allowFullscreen"
      v-model:open="fullscreenOpen"
      size="full"
      header-variant="default"
      padding="lg"
      :ui="{ overlay: 'z-[70]', content: 'z-[70]' }"
    >
      <template #title>
        <span class="truncate text-base font-semibold text-slate-900">{{ title }}</span>
      </template>
      <div class="h-[calc(100vh-10rem)] min-h-[400px] overflow-auto bg-[#e8e8ea] p-4">
        <div class="mx-auto max-w-[960px] shadow-2xl ring-1 ring-neutral-300/60">
          <iframe
            :srcdoc="normalizedHtml"
            sandbox="allow-same-origin"
            class="block min-h-[calc(100vh-12rem)] w-full border-0 bg-white"
            :title="title"
            referrerpolicy="no-referrer"
          />
        </div>
      </div>
    </EnModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import EnModal from "@components/EnModal.vue";
import { normalizeHtmlDocumentForPreview } from "@utils/consultingReportHtml";

const props = withDefaults(
  defineProps<{
    html: string;
    title?: string;
    compact?: boolean;
    showToolbar?: boolean;
    allowFullscreen?: boolean;
    wide?: boolean;
  }>(),
  {
    title: "レポート",
    compact: false,
    showToolbar: true,
    allowFullscreen: true,
    wide: false,
  }
);

const zoom = ref(1);
const fullscreenOpen = ref(false);

const normalizedHtml = computed(() =>
  normalizeHtmlDocumentForPreview(props.html)
);

const paperStyle = computed(() => ({
  transform: `scale(${zoom.value})`,
  width: props.wide || props.compact ? "100%" : "min(920px, 100%)",
  maxWidth: "100%",
}));

const iframeHeight = computed(() =>
  props.compact ? "12rem" : "calc(100vh - 14rem)"
);

const adjustZoom = (delta: number): void => {
  zoom.value = Math.min(1.25, Math.max(0.75, zoom.value + delta));
};
</script>
