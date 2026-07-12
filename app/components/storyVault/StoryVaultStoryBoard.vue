<template>
  <section class="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 class="text-sm font-bold text-slate-900">Storyボード</h2>
        <p class="text-xs text-slate-500">
          状態ごとにStoryを確認します
        </p>
      </div>
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <EnBadge variant="tag" size="xs">表示 {{ stories.length }} 件</EnBadge>
      </div>
    </div>

    <div
      v-if="stories.length === 0"
      class="flex min-h-48 flex-col items-center justify-center bg-slate-50 px-4 py-10 text-center"
    >
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-300 ring-1 ring-slate-200">
        <UIcon name="material-symbols:article-outline" class="h-6 w-6" />
      </span>
      <p class="mt-3 text-sm font-bold text-slate-800">
        まだユーザーストーリーがありません
      </p>
      <p class="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
        Capabilityと根拠がそろったら、上の「Story候補を生成」から一覧を作成できます。
      </p>
    </div>

    <div
      v-else
      class="grid gap-3 bg-slate-50/70 p-3 xl:grid-cols-2 2xl:grid-cols-4"
    >
      <div
        v-for="column in columns"
        :key="column.status"
        class="flex min-h-[18rem] min-w-0 flex-col rounded-lg border border-slate-200 bg-white"
      >
        <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-slate-800">
              {{ column.label }}
            </p>
            <p class="text-[11px] text-slate-500">
              {{ column.items.length }} stories / avg {{ column.averageConfidence }}%
            </p>
          </div>
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            :class="column.iconWrapClass"
          >
            <UIcon :name="column.icon" class="h-4 w-4" />
          </span>
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          <StoryVaultStoryCard
            v-for="story in column.items"
            :key="story.id"
            :story="story"
            :evidence-count="evidenceCountByStory[story.id] ?? 0"
            :selected="story.id === selectedStoryId"
            @select="$emit('select-story', $event)"
          />
          <div
            v-if="column.items.length === 0"
            class="flex min-h-24 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-xs text-slate-400"
          >
            この状態のStoryはありません
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  DecodedStoryVaultStory,
  StoryVaultStoryStatus,
} from "@models/storyVault";
import { STORYVAULT_STATUS_LABELS } from "@models/storyVault";

const props = defineProps<{
  stories: DecodedStoryVaultStory[];
  evidenceCountByStory: Record<string, number>;
  selectedStoryId: string;
}>();

defineEmits<{
  "select-story": [storyId: string];
}>();

const statusIcons: Record<StoryVaultStoryStatus, string> = {
  discovery: "material-symbols:explore-outline",
  ready_for_dev: "material-symbols:fact-check-outline",
  implemented: "material-symbols:code-blocks-outline",
  released: "material-symbols:rocket-launch-outline",
};

const statusIconWrapClass: Record<StoryVaultStoryStatus, string> = {
  discovery: "bg-sky-50 text-sky-600",
  ready_for_dev: "bg-amber-50 text-amber-600",
  implemented: "bg-emerald-50 text-emerald-600",
  released: "bg-indigo-50 text-indigo-600",
};

const orderedStatuses: StoryVaultStoryStatus[] = [
  "discovery",
  "ready_for_dev",
  "implemented",
  "released",
];

const columns = computed(() =>
  orderedStatuses.map((status) => {
    const items = props.stories.filter((story) => story.status === status);
    const averageConfidence =
      items.length === 0
        ? 0
        : Math.round(
            items.reduce((sum, story) => sum + story.confidenceScore, 0) /
              items.length
          );
    return {
      status,
      label: STORYVAULT_STATUS_LABELS[status],
      icon: statusIcons[status],
      iconWrapClass: statusIconWrapClass[status],
      averageConfidence,
      items,
    };
  })
);
</script>
