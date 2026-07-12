<template>
  <div class="agent-briefing flex h-full min-h-0 flex-col">
    <!-- 進捗バー & 「全部自分で書く」逃げ道 -->
    <div
      v-if="!isFinalize"
      :class="[
        'flex flex-shrink-0 items-center justify-between border-b px-5 py-2.5',
        headerBgClass,
      ]"
    >
      <button
        v-if="showSkip"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900"
        @click="onSkip"
      >
        <UIcon name="material-symbols:edit-note" class="h-3.5 w-3.5" />
        {{ briefing.config.skipLabel ?? "全部自分で書く" }}
      </button>
      <span v-else aria-hidden="true" />

      <div
        class="flex items-center gap-2"
        :aria-label="`ステップ ${briefing.step.value} / ${briefing.totalSteps.value}`"
      >
        <span class="text-[11px] font-medium text-neutral-500">
          Step {{ briefing.step.value }} / {{ briefing.totalSteps.value }}
        </span>
        <div class="flex items-center gap-1">
          <span
            v-for="i in briefing.totalSteps.value"
            :key="i"
            :class="[
              'h-2 w-2 rounded-full transition-all',
              i < briefing.step.value
                ? dotDoneClass
                : i === briefing.step.value
                  ? `${dotActiveClass} scale-125`
                  : 'bg-neutral-200',
            ]"
          />
        </div>
      </div>
    </div>

    <!-- 本体: Step 1〜N の入力, または finalize -->
    <div class="flex min-h-0 flex-1">
      <template v-if="!isFinalize">
        <!-- stacked: ステップカード縦並び (リサーチ等) -->
        <section
          v-if="isStackedLayout"
          class="flex min-h-0 flex-1 flex-col items-center justify-start gap-5 overflow-y-auto px-5 pt-6 pb-8"
        >
          <AgentBriefingPenguin
            v-if="briefing.config.mascot"
            :step="briefing.step.value"
            :lines-by-step="briefing.config.mascot.linesByStep"
            :image-src="briefing.config.mascot.imageSrc"
            :alt-text="briefing.config.mascot.altText"
            :accent="briefing.config.accent"
          />
          <div class="mx-auto w-[70%] min-w-0 max-w-5xl space-y-4">
            <AgentBriefingStepStack
              :briefing="briefing"
              :launching="launching"
              @launch="onLaunch"
            />
            <slot name="attachments" />
          </div>
        </section>
        <!-- split: 左入力 + 右ヒアリングボード (既定) -->
        <template v-else>
          <section
            class="flex min-h-0 flex-[3] flex-col items-center justify-start gap-5 overflow-y-auto border-r border-neutral-100 px-5 pt-6 pb-8"
          >
            <AgentBriefingPenguin
              v-if="briefing.config.mascot"
              :step="briefing.step.value"
              :lines-by-step="briefing.config.mascot.linesByStep"
              :image-src="briefing.config.mascot.imageSrc"
              :alt-text="briefing.config.mascot.altText"
              :accent="briefing.config.accent"
            />
            <div class="mx-auto w-[70%] min-w-0 max-w-5xl">
              <AgentBriefingInput
                :briefing="briefing"
                :launching="launching"
                @launch="onLaunch"
              />
            </div>
          </section>
          <aside
            class="hidden lg:flex min-h-0 flex-[2] flex-col gap-3 overflow-y-auto p-4"
          >
            <AgentBriefingStickyBoard
              :briefing="briefing"
              class="w-full"
            />
            <slot name="attachments" />
          </aside>
        </template>
      </template>
      <AgentBriefingFinalize
        v-else
        :briefing="briefing"
        class="flex-1"
        @confirm="onConfirm"
        @restart="$emit('restart')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import AgentBriefingInput from "./AgentBriefingInput.vue";
import AgentBriefingPenguin from "./AgentBriefingPenguin.vue";
import AgentBriefingStickyBoard from "./AgentBriefingStickyBoard.vue";
import AgentBriefingStepStack from "./AgentBriefingStepStack.vue";
import AgentBriefingFinalize from "./AgentBriefingFinalize.vue";
import type { AgentBriefingHandle } from "@composables/agentBriefing/useAgentBriefing";

const props = withDefaults(
  defineProps<{
    briefing: AgentBriefingHandle;
    /** Show the "全部自分で書く" escape hatch. */
    showSkip?: boolean;
    /** 最終ステップからの即起動中 */
    launching?: boolean;
  }>(),
  {
    showSkip: true,
    launching: false,
  },
);

const emit = defineEmits<{
  (e: "finalize", prompt: string): void;
  (e: "skip" | "restart"): void;
}>();

onMounted(() => {
  props.briefing.hydrate();
});

const isFinalize = computed(
  () => props.briefing.step.value > props.briefing.totalSteps.value
);

const isStackedLayout = computed(
  () => props.briefing.config.layout === "stacked"
);

const onConfirm = (prompt: string) => {
  emit("finalize", prompt);
};

const onSkip = () => {
  props.briefing.skip();
  emit("skip");
};

const onLaunch = () => {
  const prompt = props.briefing.finalize();
  emit("finalize", prompt);
};

const accent = computed(() => props.briefing.config.accent ?? "purple");

const headerBgClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "border-emerald-100 bg-emerald-50/40";
    case "sky":
      return "border-sky-100 bg-sky-50/40";
    case "violet":
      return "border-violet-100 bg-violet-50/40";
    case "purple":
    default:
      return "border-purple-100 bg-purple-50/40";
  }
});

const dotDoneClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "bg-emerald-500";
    case "sky":
      return "bg-sky-500";
    case "violet":
      return "bg-violet-500";
    case "purple":
    default:
      return "bg-purple-500";
  }
});

const dotActiveClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]";
    case "sky":
      return "bg-sky-400 shadow-[0_0_0_3px_rgba(14,165,233,0.18)]";
    case "violet":
      return "bg-violet-400 shadow-[0_0_0_3px_rgba(139,92,246,0.18)]";
    case "purple":
    default:
      return "bg-purple-400 shadow-[0_0_0_3px_rgba(139,92,246,0.18)]";
  }
});
</script>
