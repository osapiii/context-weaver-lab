<template>
  <section class="space-y-3">
    <div
      class="grid gap-3"
      :class="compact ? 'lg:grid-cols-3' : 'md:grid-cols-3'"
    >
      <article
        v-for="card in cards"
        :key="card.key"
        class="relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm"
        :class="[
          compact ? 'min-h-[116px]' : 'min-h-[150px]',
          card.borderClass,
        ]"
      >
        <div
          class="pointer-events-none absolute inset-x-0 top-0 h-1"
          :class="card.accentClass"
        />
        <div class="flex items-start gap-3">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            :class="card.iconWrapClass"
          >
            <UIcon :name="card.icon" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <p class="text-xs font-black tracking-wide text-slate-500">
                {{ card.label }}
              </p>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
                :class="card.pillClass"
              >
                {{ card.englishLabel }}
              </span>
            </div>
            <p
              class="mt-2 font-bold leading-relaxed text-slate-950"
              :class="compact ? 'line-clamp-3 text-sm' : 'text-base'"
            >
              {{ card.value }}
            </p>
          </div>
        </div>
      </article>
    </div>

  </section>
</template>

<script setup lang="ts">
import type {
  DecodedStoryVaultClip,
  StoryVaultZappingAnalysisStoryCandidate,
} from "@models/storyVault";

type StoryValueCard = {
  key: string;
  label: string;
  englishLabel: string;
  value: string;
  icon: string;
  accentClass: string;
  borderClass: string;
  iconWrapClass: string;
  pillClass: string;
};

const props = defineProps<{
  story: StoryVaultZappingAnalysisStoryCandidate;
  video?: DecodedStoryVaultClip | null;
  compact?: boolean;
}>();

const compact = computed(() => props.compact ?? false);

const cards = computed<StoryValueCard[]>(() => [
  {
    key: "role",
    label: "誰が",
    englishLabel: "Who",
    value: props.story.role?.value || props.story.asA || "未生成",
    icon: "material-symbols:person-check-outline",
    accentClass: "bg-sky-500",
    borderClass: "border-sky-100",
    iconWrapClass: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
    pillClass: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  },
  {
    key: "goal",
    label: "何をしたいか",
    englishLabel: "What",
    value: props.story.goal || props.story.iWant || "未生成",
    icon: "material-symbols:flag-outline",
    accentClass: "bg-teal-500",
    borderClass: "border-teal-100",
    iconWrapClass: "bg-teal-50 text-teal-700 ring-1 ring-teal-100",
    pillClass: "bg-teal-50 text-teal-700 ring-1 ring-teal-100",
  },
  {
    key: "benefit",
    label: "何がうれしいか",
    englishLabel: "Why",
    value:
      props.story.benefit ||
      props.story.soThat ||
      props.story.summary ||
      "未生成",
    icon: "material-symbols:verified-outline",
    accentClass: "bg-amber-500",
    borderClass: "border-amber-100",
    iconWrapClass: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    pillClass: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  },
]);

</script>
