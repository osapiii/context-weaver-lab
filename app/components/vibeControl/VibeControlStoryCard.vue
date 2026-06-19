<template>
  <button
    type="button"
    :class="[
      'group flex w-full min-w-0 flex-col gap-3 rounded-lg border bg-white p-3 text-left transition hover:border-primary-300 hover:shadow-sm',
      selected ? 'border-primary-400 ring-2 ring-primary-100' : 'border-slate-200',
    ]"
    @click="$emit('select', story.id)"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs font-semibold text-slate-500">
            {{ story.applicationKey }} / {{ story.storyKey }}
          </span>
          <EnBadge
            :color="driftBadge.color"
            size="xs"
            variant="soft"
          >
            {{ driftBadge.label }}
          </EnBadge>
        </div>
        <p class="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
          {{ story.title }}
        </p>
      </div>
      <div class="shrink-0 text-right">
        <p class="text-lg font-bold tabular-nums text-slate-900">
          {{ story.confidenceScore }}%
        </p>
        <p class="text-[11px] font-medium text-slate-500">confidence</p>
      </div>
    </div>

    <p class="line-clamp-2 text-xs leading-relaxed text-slate-600">
      {{ story.summary }}
    </p>

    <div class="flex flex-wrap gap-1.5">
      <EnBadge
        v-for="label in story.labels"
        :key="label"
        variant="tag"
        size="xs"
      >
        {{ label }}
      </EnBadge>
    </div>

    <div class="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
      <span class="min-w-0 truncate">
        domain: <b class="text-slate-700">{{ story.domain }}</b>
      </span>
      <span class="min-w-0 truncate">
        AC: <b class="text-slate-700">{{ coveredAcCount }}/{{ story.acceptanceCriteria.length }}</b>
      </span>
      <span class="min-w-0 truncate">
        evidence: <b class="text-slate-700">{{ evidenceCount }}</b>
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { DecodedVibeControlStory } from "@models/vibeControl";
import { VIBE_CONTROL_DRIFT_LABELS } from "@models/vibeControl";

const props = defineProps<{
  story: DecodedVibeControlStory;
  evidenceCount: number;
  selected?: boolean;
}>();

defineEmits<{
  select: [storyId: string];
}>();

const driftBadge = computed(() => {
  const label = VIBE_CONTROL_DRIFT_LABELS[props.story.driftLevel];
  const color =
    props.story.driftLevel === "high"
      ? "error"
      : props.story.driftLevel === "medium"
        ? "warning"
        : props.story.driftLevel === "low"
          ? "info"
          : "success";
  return { label, color } as const;
});

const coveredAcCount = computed(
  () =>
    props.story.acceptanceCriteria.filter((item) => item.state === "covered")
      .length
);
</script>
