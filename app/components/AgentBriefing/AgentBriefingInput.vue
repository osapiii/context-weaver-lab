<template>
  <div class="briefing-input space-y-6">
    <AgentBriefingFields
      :briefing="briefing"
      :fields="briefing.currentFields.value"
      :autofocus="true"
      @enter-advance="onEnterAdvance"
    />

    <div class="flex items-center justify-between pt-2">
      <button
        type="button"
        :disabled="briefing.step.value <= 1"
        class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
        @click="onBack"
      >
        <UIcon name="material-symbols:arrow-back" class="h-4 w-4" />
        戻る
      </button>
      <div class="flex items-center gap-2">
        <button
          type="button"
          :disabled="!canAdvance || launching"
          :class="[
            'inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 md:text-base',
            canAdvance && !launching
              ? nextBtnReadyClass
              : 'cursor-not-allowed bg-neutral-300',
          ]"
          @click="onAdvance"
        >
          {{ lastStepCtaLabel }}
          <UIcon name="material-symbols:arrow-forward" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AgentBriefingFields from "./AgentBriefingFields.vue";
import type { AgentBriefingHandle } from "@composables/agentBriefing/useAgentBriefing";

const props = defineProps<{
  briefing: AgentBriefingHandle;
  launching?: boolean;
}>();

const emit = defineEmits<{
  (e: "launch"): void;
}>();

const canAdvance = computed(() => props.briefing.isCurrentStepFilled.value);

const lastStepCtaLabel = computed((): string => {
  if (props.launching) return "開始中…";
  if (props.briefing.step.value === props.briefing.totalSteps.value) {
    return (
      props.briefing.config.lastStepAdvanceLabel ??
      (props.briefing.config.skipFinalizeScreen ? "開始" : "確認へ")
    );
  }
  return "次へ";
});

const onAdvance = () => {
  if (!canAdvance.value || props.launching) return;
  if (
    props.briefing.config.skipFinalizeScreen &&
    props.briefing.step.value === props.briefing.totalSteps.value
  ) {
    emit("launch");
    return;
  }
  props.briefing.advance();
};

const onEnterAdvance = () => {
  if (!canAdvance.value || props.launching) return;
  onAdvance();
};

const onBack = () => {
  props.briefing.back();
};

const accent = computed(() => props.briefing.config.accent ?? "purple");

const nextBtnReadyClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-200 hover:-translate-y-0.5";
    case "sky":
      return "bg-gradient-to-br from-sky-500 to-blue-500 shadow-lg shadow-sky-200 hover:-translate-y-0.5";
    case "violet":
      return "bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-200 hover:-translate-y-0.5";
    case "purple":
    default:
      return "bg-gradient-to-br from-purple-500 to-violet-500 shadow-lg shadow-purple-200 hover:-translate-y-0.5";
  }
});
</script>
