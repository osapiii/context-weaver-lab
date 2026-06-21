<template>
  <section class="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 class="text-sm font-bold text-slate-900">Story SSOT Pipeline</h2>
        <p class="text-xs text-slate-500">
          ライフサイクル別に、仕様・進行・コード・QA根拠を確認
        </p>
      </div>
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <EnBadge variant="tag" size="xs">表示 {{ stories.length }} 件</EnBadge>
      </div>
    </div>

    <div class="grid gap-3 p-3 2xl:grid-cols-4">
      <div
        v-for="column in columns"
        :key="column.status"
        class="flex min-h-[28rem] min-w-0 flex-col rounded-lg border border-slate-200 bg-white"
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
          <VibeControlStoryCard
            v-for="story in column.items"
            :key="story.id"
            :story="story"
            :evidence-count="evidenceCountByStory[story.id] ?? 0"
            :selected="story.id === selectedStoryId"
            @select="$emit('select-story', $event)"
          />
          <div
            v-if="column.items.length === 0"
            class="flex min-h-32 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400"
          >
            条件に一致するストーリーはありません
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  DecodedVibeControlStory,
  VibeControlStoryStatus,
} from "@models/vibeControl";
import { VIBE_CONTROL_STATUS_LABELS } from "@models/vibeControl";

const props = defineProps<{
  stories: DecodedVibeControlStory[];
  evidenceCountByStory: Record<string, number>;
  selectedStoryId: string;
}>();

defineEmits<{
  "select-story": [storyId: string];
}>();

const statusIcons: Record<VibeControlStoryStatus, string> = {
  discovery: "material-symbols:explore-outline",
  ready_for_dev: "material-symbols:fact-check-outline",
  implemented: "material-symbols:code-blocks-outline",
  released: "material-symbols:rocket-launch-outline",
};

const statusIconWrapClass: Record<VibeControlStoryStatus, string> = {
  discovery: "bg-sky-50 text-sky-600",
  ready_for_dev: "bg-amber-50 text-amber-600",
  implemented: "bg-emerald-50 text-emerald-600",
  released: "bg-indigo-50 text-indigo-600",
};

const orderedStatuses: VibeControlStoryStatus[] = [
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
      label: VIBE_CONTROL_STATUS_LABELS[status],
      icon: statusIcons[status],
      iconWrapClass: statusIconWrapClass[status],
      averageConfidence,
      items,
    };
  })
);
</script>
