<template>
  <div
    v-if="hasAnyContent"
    class="min-w-0 w-full max-w-full space-y-3"
  >
    <button
      type="button"
      class="flex items-center gap-1.5 text-left"
      @click="expanded = !expanded"
    >
      <UIcon
        name="material-symbols:library-books-outline"
        class="h-3.5 w-3.5 flex-shrink-0 text-neutral-400"
      />
      <span class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
        参考にした資料
      </span>
      <EnBadge variant="tag" size="xs">{{ totalCount }}</EnBadge>
      <UIcon
        :name="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        class="h-3 w-3 text-neutral-400"
      />
    </button>

    <div v-if="expanded" class="space-y-3">
      <div
        v-if="groundingModel.retrievalQueries.length > 0"
        class="rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/60"
      >
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          検索クエリ
        </p>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <EnBadge
            v-for="query in groundingModel.retrievalQueries"
            :key="query"
            variant="tag"
            size="xs"
          >
            {{ query }}
          </EnBadge>
        </div>
      </div>

      <div
        v-if="groundingModel.supports.length > 0"
        class="space-y-2"
      >
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          回答との対応
        </p>
        <div
          v-for="(support, idx) in groundingModel.supports"
          :key="`support-${idx}`"
          class="rounded-lg border border-sky-200/80 bg-sky-50/50 px-3 py-2 dark:border-sky-900/60 dark:bg-sky-950/20"
        >
          <p
            v-if="support.segmentText"
            class="text-[11px] leading-snug text-neutral-800 dark:text-neutral-100"
          >
            「{{ support.segmentText }}」
          </p>
          <p class="mt-1 text-[10px] text-neutral-500">
            根拠 chunk:
            {{ support.chunkIndices.join(", ") }}
            <span v-if="support.confidenceScores?.length">
              (score: {{ support.confidenceScores.map((s) => s.toFixed(2)).join(", ") }})
            </span>
          </p>
        </div>
      </div>

      <div
        v-if="groundingModel.chunks.length > 0"
        class="space-y-2"
      >
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          検索ヒット ({{ groundingModel.chunks.length }})
        </p>
        <div class="space-y-2">
          <article
            v-for="chunk in groundingModel.chunks"
            :key="`chunk-${chunk.index}`"
            class="rounded-lg border border-neutral-200/80 bg-white px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <EnBadge
                    :variant="chunk.kind === 'web' ? 'assistant' : 'tag'"
                    size="xs"
                  >
                    #{{ chunk.index }} {{ chunk.kind === "web" ? "Web" : "FileSpace" }}
                  </EnBadge>
                  <p class="text-[11px] font-semibold text-neutral-900 dark:text-neutral-100">
                    {{ chunk.title }}
                  </p>
                </div>
                <p
                  v-if="chunk.documentId"
                  class="mt-0.5 truncate font-mono text-[10px] text-neutral-400"
                >
                  {{ chunk.documentId }}
                </p>
                <a
                  v-if="chunk.uri"
                  :href="chunk.uri"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-0.5 block truncate text-[10px] text-sky-600 hover:underline dark:text-sky-400"
                >
                  {{ chunk.uri }}
                </a>
              </div>
            </div>
            <p
              v-if="chunk.text"
              class="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300"
            >
              {{ chunk.text }}
            </p>
          </article>
        </div>
      </div>

      <div
        v-if="resolvedSources.length > 0"
        class="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:thin]"
      >
        <a
          v-for="src in resolvedSources"
          :key="src.key"
          :href="src.href || undefined"
          :target="src.href ? '_blank' : undefined"
          :rel="src.href ? 'noopener noreferrer' : undefined"
          class="group flex w-[156px] flex-shrink-0 flex-col gap-1.5 rounded-lg border bg-white px-2.5 py-2 shadow-sm dark:bg-neutral-900"
          :class="src.href ? 'cursor-pointer hover:border-purple-200' : 'cursor-default border-neutral-200/80'"
          :title="src.reason || src.subtitle || src.title"
        >
          <div class="flex items-center gap-1.5">
            <div
              class="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-50 ring-1 ring-neutral-100 dark:bg-neutral-800"
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
                class="h-3.5 w-3.5 text-neutral-500"
              />
            </div>
            <EnBadge
              :variant="src.sourceType === 'webSearch' ? 'assistant' : 'tag'"
              size="xs"
            >
              {{ src.sourceType === "webSearch" ? "Web" : "FileSpace" }}
            </EnBadge>
          </div>
          <p class="line-clamp-2 text-[11px] font-semibold leading-snug">
            {{ src.title }}
          </p>
          <p
            v-if="src.reason"
            class="line-clamp-3 text-[10px] leading-snug text-neutral-600 dark:text-neutral-400"
          >
            {{ src.reason }}
          </p>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Document } from "@models/document";
import {
  extractSourceReferences,
  resolveConsultationSources,
  type ConsultationSourceReference,
} from "@utils/consultationSourceReferences";
import { buildGroundingDisplayModel } from "@utils/adkGrounding";

const props = withDefaults(
  defineProps<{
    sourceReferences?: ConsultationSourceReference[] | null;
    groundingMetadata?: unknown;
    documents: Document[];
    defaultExpanded?: boolean;
  }>(),
  {
    defaultExpanded: true,
  }
);

const expanded = ref(props.defaultExpanded ?? true);

const groundingModel = computed(() =>
  buildGroundingDisplayModel(
    props.groundingMetadata as Record<string, unknown> | null | undefined
  )
);

const resolvedSources = computed(() => {
  const refs = extractSourceReferences({
    sourceReferences: props.sourceReferences,
    groundingMetadata: props.groundingMetadata,
  });
  return resolveConsultationSources({
    references: refs,
    documents: props.documents,
  });
});

const totalCount = computed(() => {
  const chunkCount = groundingModel.value.chunks.length;
  return chunkCount > 0 ? chunkCount : resolvedSources.value.length;
});

const hasAnyContent = computed(
  () =>
    groundingModel.value.chunks.length > 0 ||
    groundingModel.value.supports.length > 0 ||
    groundingModel.value.retrievalQueries.length > 0 ||
    resolvedSources.value.length > 0
);
</script>
