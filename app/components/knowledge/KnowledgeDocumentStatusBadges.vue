<template>
  <div
    class="absolute left-2 top-2 z-10 flex flex-col items-start gap-1 transition-opacity"
    :class="quiet ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : ''"
  >
    <span
      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ring-1 backdrop-blur-sm shadow-sm"
      :class="
        quiet
          ? 'bg-white/95 text-slate-600 ring-slate-200'
          : indexed
            ? 'bg-purple-50/90 text-purple-700 ring-purple-200'
            : 'bg-gray-100/90 text-gray-500 ring-gray-200'
      "
      :title="
        indexed
          ? 'AI 検索可能 — Agent Search (Discovery Engine) に登録済み'
          : 'AI 検索不可 — メタデータのみ (非対応形式)'
      "
    >
      <UIcon
        :name="
          indexed
            ? 'i-heroicons-sparkles'
            : 'i-heroicons-minus-circle'
        "
        class="w-3 h-3"
      />
      {{ indexed ? "AI 検索可" : "未登録" }}
    </span>

    <span
      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ring-1 backdrop-blur-sm shadow-sm"
      :class="quiet ? 'bg-white/95 text-slate-600 ring-slate-200' : sourceBadgeClass"
      :title="`取り込み元: ${source.label}`"
    >
      <UIcon :name="source.icon" class="w-3 h-3 shrink-0" />
      {{ source.label }}
    </span>

  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Document } from "@models/document";
import { isKnowledgeIndexed } from "@utils/knowledge";
import {
  knowledgeSourceMeta,
  type KnowledgeSourceTone,
} from "@utils/consultationKnowledge";

const props = defineProps<{
  document: Document;
  quiet?: boolean;
}>();

const indexed = computed(() => isKnowledgeIndexed(props.document));

const source = computed(() => knowledgeSourceMeta(props.document));

const sourceToneClass: Record<KnowledgeSourceTone, string> = {
  violet: "bg-violet-50/90 text-violet-700 ring-violet-200",
  sky: "bg-sky-50/90 text-sky-700 ring-sky-200",
  cyan: "bg-cyan-50/90 text-cyan-700 ring-cyan-200",
  slate: "bg-slate-100/90 text-slate-600 ring-slate-200",
};

const sourceBadgeClass = computed(
  () => sourceToneClass[source.value.tone] ?? sourceToneClass.slate
);
</script>
