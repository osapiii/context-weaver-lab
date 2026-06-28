<template>
  <section class="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Story list
        </p>
        <h2 class="mt-1 text-base font-bold text-slate-900">
          ユーザーストーリー一覧
        </h2>
        <p class="mt-1 text-xs leading-relaxed text-slate-500">
          生成されたStoryを検索し、状態やレビュー状況で絞り込みます。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <EnBadge variant="tag" size="xs">
          表示 {{ filteredCount }} / {{ totalCount }}
        </EnBadge>
        <EnBadge
          :color="governanceScore >= 70 ? 'success' : governanceScore > 0 ? 'warning' : 'neutral'"
          variant="soft"
          size="xs"
        >
          信頼度 {{ governanceScore }}%
        </EnBadge>
      </div>
    </div>

    <div class="grid border-b border-slate-100 sm:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="metric in quadrantMetrics"
        :key="metric.label"
        class="border-b border-slate-100 px-4 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-500">{{ metric.label }}</p>
            <p class="mt-1 text-xl font-bold tabular-nums text-slate-950">
              {{ metric.value }}
            </p>
          </div>
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            :class="metric.iconWrapClass"
          >
            <UIcon :name="metric.icon" class="h-4 w-4" />
          </span>
        </div>
        <p class="mt-2 text-xs leading-relaxed text-slate-500">
          {{ metric.caption }}
        </p>
      </article>
    </div>

    <div class="space-y-3 bg-slate-50/80 px-4 py-3">
      <div class="grid gap-3 lg:grid-cols-[minmax(14rem,1.4fr)_repeat(3,minmax(8rem,1fr))_auto]">
        <label class="block">
          <span class="text-xs font-bold text-slate-500">検索</span>
          <span class="mt-1 flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
            <UIcon name="material-symbols:search-rounded" class="h-4 w-4 text-slate-400" />
            <input
              :value="filters.query"
              type="search"
              class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
              placeholder="Story / AC / ラベル"
              @input="emitFilter('query', ($event.target as HTMLInputElement).value)"
            >
          </span>
        </label>

        <label
          v-for="select in primarySelects"
          :key="select.key"
          class="block"
        >
          <span class="text-xs font-bold text-slate-500">{{ select.label }}</span>
          <select
            :value="select.value"
            class="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            @change="emitFilter(select.key, ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="option in select.options"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <div class="flex items-end">
          <EnButton
            variant="outline"
            color="neutral"
            size="sm"
            leading-icon="material-symbols:filter-alt-off-outline"
            custom-class="h-10 whitespace-nowrap"
            @click="$emit('clear-filters')"
          >
            解除
          </EnButton>
        </div>
      </div>

      <details class="group rounded-md border border-slate-200 bg-white px-3 py-2">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-slate-600">
          <span class="inline-flex items-center gap-1.5">
            <UIcon name="material-symbols:tune-rounded" class="h-4 w-4" />
            詳細フィルター
          </span>
          <UIcon name="material-symbols:expand-more-rounded" class="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div class="mt-3 grid gap-3 md:grid-cols-3">
          <label
            v-for="select in secondarySelects"
            :key="select.key"
            class="block"
          >
            <span class="text-xs font-bold text-slate-500">{{ select.label }}</span>
            <select
              :value="select.value"
              class="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              @change="emitFilter(select.key, ($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="option in select.options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <div class="block">
            <span class="text-xs font-bold text-slate-500">
              信頼度 {{ filters.minConfidence }}+
            </span>
            <input
              :value="filters.minConfidence"
              type="range"
              min="0"
              max="100"
              step="5"
              class="mt-3 block w-full accent-emerald-600"
              @input="emitFilter('minConfidence', Number(($event.target as HTMLInputElement).value))"
            >
          </div>
        </div>
      </details>

      <div class="flex flex-wrap items-center gap-2">
        <EnBadge
          v-for="chip in activeFilterChips"
          :key="chip"
          variant="tag"
          size="xs"
        >
          {{ chip }}
        </EnBadge>
        <span
          v-if="activeFilterChips.length === 0"
          class="text-xs font-medium text-slate-400"
        >
          すべてのストーリーを表示中
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { VibeControlFilters } from "@stores/vibeControl";
import type {
  DecodedVibeControlApplication,
  DecodedVibeControlStory,
} from "@models/vibeControl";
import {
  VIBE_CONTROL_DRIFT_LABELS,
  VIBE_CONTROL_STATUS_LABELS,
} from "@models/vibeControl";

const props = defineProps<{
  application: DecodedVibeControlApplication | null;
  stories: DecodedVibeControlStory[];
  filteredCount: number;
  filters: VibeControlFilters;
  domains: string[];
  milestones: string[];
}>();

const emit = defineEmits<{
  "update-filter": [
    key: keyof VibeControlFilters,
    value: VibeControlFilters[keyof VibeControlFilters],
  ];
  "clear-filters": [];
}>();

type SelectKey = "status" | "domain" | "milestone" | "drift" | "reviewState";

const totalCount = computed(() => props.stories.length);

const coveredAcCount = computed(() =>
  props.stories.reduce(
    (sum, story) =>
      sum + story.acceptanceCriteria.filter((item) => item.state === "covered").length,
    0
  )
);

const totalAcCount = computed(() =>
  props.stories.reduce((sum, story) => sum + story.acceptanceCriteria.length, 0)
);

const mappedCodeRefCount = computed(() =>
  props.stories.reduce((sum, story) => sum + story.codeRefs.length, 0)
);

const screenAtlasCount = computed(() => props.application?.lastScan?.artifactCount ?? 0);

const implementedCount = computed(
  () =>
    props.stories.filter(
      (story) => story.status === "implemented" || story.status === "released"
    ).length
);

const governanceScore = computed(() => {
  if (props.stories.length === 0) return 0;
  const confidenceAverage =
    props.stories.reduce((sum, story) => sum + story.confidenceScore, 0) /
    props.stories.length;
  const highDriftPenalty =
    props.stories.filter((story) => story.driftLevel === "high").length * 8;
  return Math.max(0, Math.min(100, Math.round(confidenceAverage - highDriftPenalty)));
});

const quadrantMetrics = computed(() => [
  {
    label: "仕様根拠",
    value: `${coveredAcCount.value}/${totalAcCount.value}`,
    caption: "ACの根拠充足",
    icon: "material-symbols:fact-check-outline",
    iconWrapClass: "bg-sky-50 text-sky-600",
  },
  {
    label: "進行",
    value: `${implementedCount.value}/${totalCount.value}`,
    caption: "実装済み/リリース済み",
    icon: "material-symbols:conversion-path",
    iconWrapClass: "bg-emerald-50 text-emerald-600",
  },
  {
    label: "コード根拠",
    value: mappedCodeRefCount.value,
    caption: "GitHub refs",
    icon: "material-symbols:account-tree-outline",
    iconWrapClass: "bg-indigo-50 text-indigo-600",
  },
  {
    label: "画面カタログ",
    value: screenAtlasCount.value,
    caption: "画面/Variant",
    icon: "material-symbols:preview-outline",
    iconWrapClass: "bg-amber-50 text-amber-600",
  },
]);

const statusOptions = computed(() => [
  { label: "すべて", value: "all" },
  ...Object.entries(VIBE_CONTROL_STATUS_LABELS).map(([value, label]) => ({
    label,
    value,
  })),
]);

const driftOptions = computed(() => [
  { label: "すべて", value: "all" },
  ...Object.entries(VIBE_CONTROL_DRIFT_LABELS).map(([value, label]) => ({
    label,
    value,
  })),
]);

const reviewOptions = [
  { label: "すべて", value: "all" },
  { label: "根拠充足", value: "ready" },
  { label: "要レビュー", value: "needs_review" },
];

const selects = computed<Array<{
  key: SelectKey;
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
}>>(() => [
  {
    key: "status",
    label: "状態",
    value: props.filters.status,
    options: statusOptions.value,
  },
  {
    key: "domain",
    label: "領域",
    value: props.filters.domain,
    options: [
      { label: "すべて", value: "" },
      ...props.domains.map((value) => ({ label: value, value })),
    ],
  },
  {
    key: "milestone",
    label: "マイルストーン",
    value: props.filters.milestone,
    options: [
      { label: "すべて", value: "" },
      ...props.milestones.map((value) => ({ label: value, value })),
    ],
  },
  {
    key: "drift",
    label: "ズレ",
    value: props.filters.drift,
    options: driftOptions.value,
  },
  {
    key: "reviewState",
    label: "レビュー",
    value: props.filters.reviewState,
    options: reviewOptions,
  },
]);

const primarySelects = computed(() =>
  selects.value.filter((select) =>
    ["status", "domain", "reviewState"].includes(select.key)
  )
);

const secondarySelects = computed(() =>
  selects.value.filter((select) =>
    ["milestone", "drift"].includes(select.key)
  )
);

const activeFilterChips = computed(() => {
  const chips: string[] = [];
  if (props.filters.query) chips.push(`query:${props.filters.query}`);
  if (props.filters.status !== "all") {
    chips.push(VIBE_CONTROL_STATUS_LABELS[props.filters.status]);
  }
  if (props.filters.domain) chips.push(`domain:${props.filters.domain}`);
  if (props.filters.milestone) chips.push(`milestone:${props.filters.milestone}`);
  if (props.filters.drift !== "all") {
    chips.push(`drift:${VIBE_CONTROL_DRIFT_LABELS[props.filters.drift]}`);
  }
  if (props.filters.reviewState !== "all") {
    chips.push(props.filters.reviewState === "needs_review" ? "要レビュー" : "根拠充足");
  }
  if (props.filters.minConfidence > 0) {
    chips.push(`confidence:${props.filters.minConfidence}+`);
  }
  return chips;
});

function emitFilter<K extends keyof VibeControlFilters>(
  key: K,
  value: VibeControlFilters[K]
): void {
  emit("update-filter", key, value);
}
</script>
