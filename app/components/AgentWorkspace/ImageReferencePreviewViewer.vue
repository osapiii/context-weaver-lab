<template>
  <div
    class="flex min-h-0 flex-col rounded-2xl border border-violet-200/80 bg-white shadow-sm ring-1 ring-violet-100/80"
    data-testid="image-reference-preview-viewer"
  >
    <div
      class="flex items-center justify-between gap-2 border-b border-violet-100/80 px-3 py-2.5 sm:px-4"
    >
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-900 sm:text-sm">
          お手本画像
        </p>
        <p class="mt-0.5 text-[10px] text-slate-500 sm:text-[11px]">
          {{ references.length }} 枚 — レイアウトの元になる画像です
        </p>
      </div>
      <EnButton
        variant="ghost"
        size="xs"
        class="shrink-0"
        data-testid="image-reference-preview-edit"
        @click="emit('edit')"
      >
        変更
      </EnButton>
    </div>

    <div
      class="relative flex min-h-[12rem] flex-1 items-center justify-center bg-slate-100/90 p-3 sm:min-h-[16rem] sm:p-4"
      data-testid="image-reference-preview-stage"
    >
      <img
        v-if="activePreviewUrl"
        :src="activePreviewUrl"
        :alt="activeReference?.name ?? 'お手本画像'"
        class="max-h-[min(52vh,26rem)] w-full object-contain"
        data-testid="image-reference-preview-image"
      >
      <div
        v-else
        class="flex flex-col items-center gap-2 text-slate-400"
      >
        <UIcon
          name="material-symbols:image-outline"
          class="h-10 w-10"
          aria-hidden="true"
        />
        <span class="text-xs">プレビューを読み込み中…</span>
      </div>
    </div>

    <div
      v-if="references.length > 1"
      class="flex gap-2 overflow-x-auto border-t border-violet-100/80 px-3 py-2.5 sm:px-4"
      role="tablist"
      aria-label="お手本画像の切り替え"
    >
      <button
        v-for="ref in references"
        :key="ref.id"
        type="button"
        role="tab"
        :aria-selected="ref.id === activeId"
        class="h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-50 transition"
        :class="
          ref.id === activeId
            ? 'border-violet-400 ring-2 ring-violet-200/80'
            : 'border-slate-200 hover:border-violet-300'
        "
        :data-testid="`image-reference-preview-thumb-${ref.id}`"
        @click="activeId = ref.id"
      >
        <img
          v-if="previewUrl(ref)"
          :src="previewUrl(ref)"
          :alt="ref.name"
          class="h-full w-full object-cover"
        >
        <div
          v-else
          class="flex h-full w-full items-center justify-center text-slate-400"
        >
          <UIcon name="material-symbols:image-outline" class="h-5 w-5" />
        </div>
      </button>
    </div>

    <p
      v-if="activeReference"
      class="truncate border-t border-violet-100/60 px-3 py-2 text-[10px] text-slate-500 sm:px-4 sm:text-[11px]"
      :title="activeReference.name"
    >
      {{ activeReference.name }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EnButton from "@components/EnButton.vue";
import { useImageReferenceThumbUrls } from "@composables/useImageReferenceThumbUrls";
import type { ImageReference } from "@utils/imageReference";

const props = defineProps<{
  references: ImageReference[];
}>();

const emit = defineEmits<{
  edit: [];
}>();

const activeId = ref<string | null>(null);

watch(
  () => props.references,
  (refs) => {
    if (refs.length === 0) {
      activeId.value = null;
      return;
    }
    if (!refs.some((ref) => ref.id === activeId.value)) {
      activeId.value = refs[0]?.id ?? null;
    }
  },
  { immediate: true, deep: true }
);

const { thumbUrls } = useImageReferenceThumbUrls({
  references: () => props.references,
});

const previewUrl = (ref: ImageReference): string | undefined =>
  thumbUrls.value[ref.id];

const activeReference = computed(() =>
  props.references.find((ref) => ref.id === activeId.value)
);

const activePreviewUrl = computed(() => {
  const ref = activeReference.value;
  return ref ? previewUrl(ref) : undefined;
});
</script>
