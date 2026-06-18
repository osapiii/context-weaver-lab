<template>
  <section class="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 class="text-sm font-semibold text-slate-900">Story SSOT Board</h2>
        <p class="text-xs text-slate-500">
          ライフサイクル別に、根拠・AC充足・コード差分を確認
        </p>
      </div>
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <span>表示 {{ stories.length }} 件</span>
      </div>
    </div>

    <div class="grid gap-3 p-3 xl:grid-cols-4">
      <div
        v-for="column in columns"
        :key="column.status"
        class="flex min-h-[24rem] min-w-0 flex-col rounded-lg border border-slate-200 bg-white"
      >
        <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-800">
              {{ column.label }}
            </p>
            <p class="text-[11px] text-slate-500">
              {{ column.items.length }} stories
            </p>
          </div>
          <UIcon
            :name="column.icon"
            class="h-5 w-5 shrink-0 text-slate-400"
          />
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
            class="flex min-h-32 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400"
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

const orderedStatuses: VibeControlStoryStatus[] = [
  "discovery",
  "ready_for_dev",
  "implemented",
  "released",
];

const columns = computed(() =>
  orderedStatuses.map((status) => ({
    status,
    label: VIBE_CONTROL_STATUS_LABELS[status],
    icon: statusIcons[status],
    items: props.stories.filter((story) => story.status === status),
  }))
);
</script>
