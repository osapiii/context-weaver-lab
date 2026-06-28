<template>
  <button
    type="button"
    :class="[
      'group flex w-full min-w-0 flex-col gap-3 rounded-lg border bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300',
      selected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200',
    ]"
    @click="$emit('select', story.id)"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="rounded-md border border-slate-200 bg-slate-950 px-2 py-0.5 font-mono text-xs font-bold text-white shadow-sm">
            [{{ storyTicketKey(story) }}]
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
        <p class="text-lg font-bold tabular-nums" :class="confidenceClass">
          {{ story.confidenceScore }}%
        </p>
        <p class="text-[11px] font-medium text-slate-500">confidence</p>
      </div>
    </div>

    <div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div
        class="h-full rounded-full transition-all"
        :class="confidenceBarClass"
        :style="{ width: `${story.confidenceScore}%` }"
      />
    </div>

    <p class="line-clamp-2 text-xs leading-relaxed text-slate-600">
      {{ story.summary }}
    </p>

    <div
      v-if="story.driftReason"
      class="rounded-md border px-2.5 py-2 text-[11px] leading-relaxed"
      :class="driftReasonClass"
    >
      <span class="font-bold">Drift:</span>
      {{ story.driftReason }}
    </div>

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

    <div class="grid grid-cols-4 gap-1.5 border-t border-slate-100 pt-2 text-[11px]">
      <span
        v-for="metric in metrics"
        :key="metric.label"
        class="min-w-0 rounded-md bg-slate-50 px-2 py-1.5"
      >
        <span class="block truncate font-semibold text-slate-500">
          {{ metric.label }}
        </span>
        <span class="block truncate font-bold tabular-nums text-slate-800">
          {{ metric.value }}
        </span>
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { DecodedVibeControlStory } from "@models/vibeControl";
import { VIBE_CONTROL_DRIFT_LABELS } from "@models/vibeControl";
import { storyTicketKey } from "@utils/vibeControlStoryKeys";

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

const missingAcCount = computed(
  () =>
    props.story.acceptanceCriteria.filter((item) => item.state === "missing")
      .length
);

const metrics = computed(() => [
  {
    label: "AC",
    value: `${coveredAcCount.value}/${props.story.acceptanceCriteria.length}`,
  },
  {
    label: "Gap",
    value: missingAcCount.value,
  },
  {
    label: "Evidence",
    value: props.evidenceCount,
  },
  {
    label: "Code",
    value: props.story.codeRefs.length,
  },
]);

const confidenceClass = computed(() => {
  if (props.story.confidenceScore >= 85) return "text-emerald-700";
  if (props.story.confidenceScore >= 70) return "text-sky-700";
  if (props.story.confidenceScore >= 50) return "text-amber-700";
  return "text-rose-700";
});

const confidenceBarClass = computed(() => {
  if (props.story.confidenceScore >= 85) return "bg-emerald-500";
  if (props.story.confidenceScore >= 70) return "bg-sky-500";
  if (props.story.confidenceScore >= 50) return "bg-amber-500";
  return "bg-rose-500";
});

const driftReasonClass = computed(() => {
  if (props.story.driftLevel === "high") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (props.story.driftLevel === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (props.story.driftLevel === "low") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
});
</script>
