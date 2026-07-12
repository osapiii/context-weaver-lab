<template>
  <div class="briefing-step-stack">
    <AgentBriefingStepCard
      :key="activeStepCard.step"
      :index="activeStepCard.index"
      :title="activeStepCard.title"
      :subtitle="activeStepCard.subtitle"
      :fields="activeStepCard.fields"
      :briefing="briefing"
      :state="activeStepCard.state"
      @enter-advance="onEnterAdvance"
    >
      <template v-if="showContextReference" #header-meta>
        <div
          class="max-w-[min(58vw,560px)] rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 shadow-sm"
          :title="contextReferenceValue"
        >
          <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            {{ contextReferenceLabel }}
          </p>
          <p class="mt-0.5 text-xs font-bold leading-snug text-neutral-900">
            {{ contextReferenceValue }}
          </p>
        </div>
      </template>

      <template #footer>
        <div
          :class="
            showBackButton
              ? 'flex items-center justify-between gap-3'
              : 'flex items-center justify-end'
          "
        >
          <button
            v-if="showBackButton"
            type="button"
            class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
            @click="onBack"
          >
            <UIcon name="material-symbols:arrow-back" class="h-4 w-4" />
            戻る
          </button>
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
      </template>
    </AgentBriefingStepCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AgentBriefingStepCard from "./AgentBriefingStepCard.vue";
import type { AgentBriefingHandle } from "@composables/agentBriefing/useAgentBriefing";
import type { BriefingFieldDef } from "@composables/agentBriefing/types";

const props = defineProps<{
  briefing: AgentBriefingHandle;
  launching?: boolean;
}>();

const emit = defineEmits<{
  (e: "launch"): void;
}>();

interface StepCardVm {
  step: number;
  index: number;
  title: string;
  subtitle?: string;
  fields: BriefingFieldDef[];
  state: "upcoming" | "active" | "completed";
}

const resolveStepTitle = (fields: BriefingFieldDef[]): string => {
  const withGroup = fields.find((f) => f.stickyGroupLabel);
  if (withGroup?.stickyGroupLabel) return withGroup.stickyGroupLabel;
  return fields[0]?.stickyLabel ?? fields[0]?.heading ?? `Step`;
};

const resolveStepSubtitle = (fields: BriefingFieldDef[]): string | undefined => {
  if (fields.length !== 1) return undefined;
  return fields[0]?.heading;
};

const stepCards = computed<StepCardVm[]>(() => {
  const cards: StepCardVm[] = [];
  for (let step = 1; step <= props.briefing.totalSteps.value; step += 1) {
    const fields = props.briefing.fieldsByStep.value[step] ?? [];
    const current = props.briefing.step.value;
    const state: StepCardVm["state"] =
      step < current ? "completed" : step === current ? "active" : "upcoming";

    cards.push({
      step,
      index: step,
      title: resolveStepTitle(fields),
      subtitle: resolveStepSubtitle(fields),
      fields,
      state,
    });
  }
  return cards;
});

const activeStepCard = computed<StepCardVm>(() => {
  const active =
    stepCards.value.find((card) => card.step === props.briefing.step.value) ??
    stepCards.value.at(-1);
  if (active) return active;
  return {
    step: 1,
    index: 1,
    title: "Step",
    subtitle: undefined,
    fields: [],
    state: "active",
  };
});

const showBackButton = computed(() => props.briefing.step.value > 1);

const contextReferenceField = computed(() => {
  const firstStepFields = props.briefing.fieldsByStep.value[1] ?? [];
  return (
    firstStepFields.find((field) => field.kind === "text") ??
    firstStepFields[0] ??
    null
  );
});

const contextReferenceLabel = computed(() => {
  const field = contextReferenceField.value;
  return field?.stickyLabel || field?.heading || "参照";
});

const contextReferenceValue = computed(() => {
  const field = contextReferenceField.value;
  if (!field) return "";
  const raw = props.briefing.draft[field.key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    return raw.filter((value) => typeof value === "string").join(" / ");
  }
  return "";
});

const showContextReference = computed(
  () => props.briefing.step.value > 1 && contextReferenceValue.value.length > 0
);

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

const onBack = () => {
  props.briefing.back();
};

const onEnterAdvance = () => {
  if (!canAdvance.value || props.launching) return;
  onAdvance();
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
