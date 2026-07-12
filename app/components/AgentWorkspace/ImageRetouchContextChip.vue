<template>
  <EnBadge
    variant="soft"
    color="neutral"
    size="sm"
    custom-class="inline-flex w-fit max-w-full items-center gap-2 py-1 pl-1 pr-2.5"
    :data-testid="dataTestId"
    :title="chipTitle"
  >
    <div
      class="flex shrink-0 items-center gap-0.5"
      data-testid="image-retouch-context-thumbs"
      :aria-label="thumbAriaLabel"
    >
      <div
        class="h-9 w-9 overflow-hidden rounded-md border border-slate-200/90 bg-slate-100"
        data-testid="image-retouch-primary-thumb"
      >
        <img
          v-if="thumbUrls.primary"
          :src="thumbUrls.primary"
          alt="編集対象画像"
          class="h-full w-full object-cover"
        >
        <div
          v-else
          class="flex h-full w-full items-center justify-center text-slate-400"
        >
          <UIcon
            name="material-symbols:image-outline"
            class="h-4 w-4"
            aria-hidden="true"
          />
        </div>
      </div>
      <div
        v-for="region in regionThumbs"
        :key="region.id"
        class="h-7 w-7 overflow-hidden rounded border border-purple-200/90 bg-purple-50"
        :data-testid="`image-retouch-region-thumb-${region.id}`"
      >
        <img
          v-if="region.url"
          :src="region.url"
          :alt="`範囲 ${region.index}`"
          class="h-full w-full object-cover"
        >
        <div
          v-else
          class="flex h-full w-full items-center justify-center text-purple-500/70"
        >
          <UIcon
            name="material-symbols:crop-free"
            class="h-3 w-3"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
    <span class="min-w-0 text-xs font-medium text-slate-700">
      {{ summaryLabel }}
    </span>
    <button
      v-if="showEdit"
      type="button"
      class="shrink-0 text-xs font-semibold text-neutral-600 underline-offset-2 hover:text-neutral-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="editDisabled"
      data-testid="image-retouch-context-edit"
      @click="emit('edit')"
    >
      変更
    </button>
  </EnBadge>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EnBadge from "@components/EnBadge.vue";
import { useImageRetouchThumbUrls } from "@composables/useImageRetouchThumbUrls";
import type { ImageRetouchMessageContext } from "@utils/imageStudioState";

const props = withDefaults(
  defineProps<{
    context: ImageRetouchMessageContext;
    sessionId?: string | null;
    showEdit?: boolean;
    editDisabled?: boolean;
    dataTestId?: string;
  }>(),
  {
    sessionId: null,
    showEdit: false,
    editDisabled: false,
    dataTestId: "image-retouch-context-chip",
  }
);

const emit = defineEmits<{
  edit: [];
}>();

const { thumbUrls } = useImageRetouchThumbUrls({
  context: () => props.context,
  sessionId: () => props.sessionId,
});

const regionThumbs = computed(() =>
  props.context.regions.slice(0, 3).map((region, index) => ({
    id: region.id,
    index: index + 1,
    url: thumbUrls.value.regions[region.id] ?? null,
  }))
);

const summaryLabel = computed(() => {
  const regionCount = props.context.regions.length;
  if (regionCount > 0) {
    return `編集対象 1 枚 · 範囲 ${regionCount} 件`;
  }
  return "編集対象 1 枚";
});

const thumbAriaLabel = computed(() => {
  const n = props.context.regions.length;
  return n > 0
    ? `編集対象画像と範囲クロップ ${Math.min(n, 3)} 件`
    : "編集対象画像 1 枚";
});

const chipTitle = computed(
  () =>
    "この画像（と範囲ヒント）が修正 API に渡されます。レイアウト・未変更の文字は維持されます。"
);
</script>
