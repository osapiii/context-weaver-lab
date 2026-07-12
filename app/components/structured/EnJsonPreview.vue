<template>
  <div
    class="en-aistudio-json-preview overflow-hidden rounded-lg border border-neutral-200 bg-white"
    :class="compact ? 'text-xs' : 'text-sm'"
    data-testid="en-aistudio-json-preview"
  >
    <div
      v-if="loading"
      class="flex items-center justify-center px-4 py-10 text-sm text-neutral-500"
      role="status"
    >
      <UIcon
        name="material-symbols:progress-activity"
        class="mr-2 h-5 w-5 animate-spin text-emerald-600"
      />
      読み込み中…
    </div>

    <EnAlert
      v-else-if="errorMessage"
      color="warning"
      :title="errorMessage"
      description="生テキストとして表示します。"
    />

    <div
      v-if="!loading && parsedValue !== null"
      class="max-h-[min(70vh,640px)] overflow-auto p-3 sm:p-4"
    >
      <ClientOnly>
        <JsonViewer
          :value="parsedValue"
          theme="light"
          :expand-depth="expandDepth"
          copyable
          boxed
          sort
        />
      </ClientOnly>
    </div>

    <pre
      v-else-if="!loading && fallbackText"
      class="max-h-[min(70vh,640px)] overflow-auto whitespace-pre-wrap break-words bg-neutral-50 p-4 font-mono text-[12px] leading-relaxed text-neutral-800"
    >{{ fallbackText }}</pre>

    <p
      v-else-if="!loading"
      class="px-4 py-10 text-center text-sm text-neutral-500"
    >
      {{ emptyMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { JsonViewer } from "vue3-json-viewer";
import EnAlert from "@components/EnAlert.vue";
import { parseStructuredJsonText } from "@utils/structuredDataPreview";

const props = withDefaults(
  defineProps<{
    /** 生 JSON 文字列（未パース） */
    text?: string | null;
    /** すでにパース済みの値（text より優先） */
    value?: unknown;
    loading?: boolean;
    errorMessage?: string | null;
    expandDepth?: number;
    compact?: boolean;
    emptyMessage?: string;
  }>(),
  {
    text: null,
    value: undefined,
    loading: false,
    errorMessage: null,
    expandDepth: 2,
    compact: false,
    emptyMessage: "表示する JSON がありません",
  }
);

const parsedValue = computed((): unknown | null => {
  if (props.value !== undefined && props.value !== null) {
    return props.value;
  }
  if (!props.text?.trim()) return null;
  return parseStructuredJsonText({ text: props.text });
});

const fallbackText = computed((): string | null => {
  if (parsedValue.value !== null) return null;
  const raw = props.text?.trim();
  return raw || null;
});
</script>

<style scoped>
.en-aistudio-json-preview :deep(.jv-container) {
  background: transparent;
  font-size: inherit;
}
</style>
