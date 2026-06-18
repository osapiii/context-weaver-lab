<template>
  <div
    v-if="sources.length > 0"
    class="min-w-0 w-full max-w-full"
    data-testid="consultation-source-carousel"
  >
    <p class="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
      <UIcon name="material-symbols:library-books-outline" class="h-3.5 w-3.5" />
      参考にした資料
      <EnBadge variant="tag" size="xs">{{ sources.length }}</EnBadge>
    </p>
    <div
      class="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:thin]"
    >
      <button
        v-for="src in sources"
        :key="src.key"
        type="button"
        class="group flex w-[168px] flex-shrink-0 flex-col gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-2.5 py-2 text-left shadow-sm transition-all hover:-translate-y-px hover:border-purple-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 dark:border-neutral-700 dark:bg-gray-900"
        :title="`${src.reason || src.subtitle || src.title} · クリックでプレビュー`"
        @click="openSourcePreview(src)"
      >
        <div class="flex items-center gap-1.5">
          <div
            class="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-50 ring-1 ring-neutral-100 dark:bg-neutral-800 dark:ring-neutral-700"
          >
            <img
              v-if="src.thumbnailUrl"
              :src="src.thumbnailUrl"
              :alt="src.title"
              class="h-full w-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
            >
            <UIcon
              v-else
              :name="src.icon"
              class="h-4 w-4 text-neutral-500"
            />
          </div>
          <EnBadge
            :variant="src.sourceType === 'webSearch' ? 'assistant' : 'tag'"
            size="xs"
          >
            {{ src.sourceType === "webSearch" ? "Web" : "FileSpace" }}
          </EnBadge>
        </div>
        <p class="line-clamp-2 text-[11px] font-semibold leading-snug text-gray-900 dark:text-gray-100">
          {{ src.title }}
        </p>
        <p
          v-if="src.subtitle"
          class="truncate text-[10px] text-gray-500 dark:text-gray-400"
        >
          {{ src.subtitle }}
        </p>
        <p
          v-if="src.reason"
          class="line-clamp-2 text-[10px] leading-snug text-gray-600 dark:text-gray-400"
        >
          {{ src.reason }}
        </p>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Document } from "@models/document";
import { useKnowledgePreview } from "@composables/useKnowledgePreview";
import {
  extractSourceReferences,
  resolveConsultationSources,
  type ConsultationSourceReference,
  type ResolvedConsultationSource,
} from "@utils/consultationSourceReferences";

const { open: openKnowledgePreview } = useKnowledgePreview();

const openSourcePreview = (src: ResolvedConsultationSource): void => {
  openKnowledgePreview(src);
};

const props = defineProps<{
  sourceReferences?: ConsultationSourceReference[] | null;
  groundingMetadata?: unknown;
  documents: Document[];
}>();

const sources = computed(() => {
  const refs = extractSourceReferences({
    sourceReferences: props.sourceReferences,
    groundingMetadata: props.groundingMetadata,
  });
  return resolveConsultationSources({
    references: refs,
    documents: props.documents,
  });
});
</script>
