<template>
  <div
    class="mx-auto flex w-full max-w-5xl flex-col items-center gap-5"
    :data-testid="testId"
  >
    <AgentBriefingPenguin
      :step="1"
      :lines-by-step="mascotLines"
      :image-src="appearance.aiAvatarUrl.value"
      :alt-text="appearance.hasCustomAiAvatar.value ? 'AI アシスタント' : mascotAlt"
      :accent="themeClasses.mascotAccent"
    />

    <section
      class="w-full rounded-xl border bg-white/95 p-4 shadow-sm sm:p-5"
      :class="themeClasses.panel"
    >
      <header v-if="title || description" class="mb-4">
        <div class="flex items-center gap-2">
          <span
            v-if="stepLabel"
            class="flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold"
            :class="themeClasses.step"
          >
            {{ stepLabel }}
          </span>
          <h2 v-if="title" class="text-base font-bold text-slate-900 sm:text-lg">
            {{ title }}
          </h2>
        </div>
        <p
          v-if="description"
          class="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm"
        >
          {{ description }}
        </p>
      </header>

      <slot />

      <footer v-if="$slots.footer" class="mt-4 border-t border-slate-100 pt-4">
        <slot name="footer" />
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AgentBriefingPenguin from "@components/AgentBriefing/AgentBriefingPenguin.vue";

type KioskTheme =
  | "consultation"
  | "writing"
  | "image"
  | "dataAnalysis"
  | "webPage";

const props = withDefaults(
  defineProps<{
    theme: KioskTheme;
    mascotMessage: string;
    mascotAlt?: string;
    title?: string;
    description?: string;
    stepLabel?: string;
    testId?: string;
  }>(),
  {
    mascotAlt: "AI アシスタント",
    title: "",
    description: "",
    stepLabel: "1",
    testId: "ai-studio-start-kiosk",
  }
);

const appearance = useAppAppearance();

const THEME_CLASSES = {
  consultation: {
    panel: "border-violet-300/80 ring-1 ring-violet-100",
    step: "bg-violet-100 text-violet-800",
    mascotAccent: "violet",
  },
  writing: {
    panel: "border-emerald-300/80 ring-1 ring-emerald-100",
    step: "bg-emerald-100 text-emerald-800",
    mascotAccent: "emerald",
  },
  image: {
    panel: "border-violet-300/80 ring-1 ring-violet-100",
    step: "bg-violet-100 text-violet-800",
    mascotAccent: "violet",
  },
  dataAnalysis: {
    panel: "border-teal-300/80 ring-1 ring-teal-100",
    step: "bg-teal-100 text-teal-800",
    mascotAccent: "emerald",
  },
  webPage: {
    panel: "border-cyan-300/80 ring-1 ring-cyan-100",
    step: "bg-cyan-100 text-cyan-800",
    mascotAccent: "sky",
  },
} as const;

const themeClasses = computed(() => THEME_CLASSES[props.theme]);
const mascotLines = computed(() => ({ 1: [props.mascotMessage] }));
</script>
