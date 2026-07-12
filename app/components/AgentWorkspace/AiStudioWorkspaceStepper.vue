<template>
  <div
    v-if="stepperItems.length > 0"
    class="min-w-0"
    :class="
      compact
        ? 'ai-studio-workspace-stepper--compact w-fit max-w-full'
        : 'w-full'
    "
    data-testid="ai-studio-workspace-stepper"
  >
    <EnStepper
      :model-value="activeIndex"
      :items="stepperItems"
      :color="stepperColor"
      :size="compact || header ? 'xs' : 'sm'"
      orientation="horizontal"
      :custom-class="stepperCustomClass"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EnStepper from "@components/EnStepper.vue";
import { useAiStudioStore } from "@stores/aiStudio";
import {
  IMAGE_WORKSPACE_STEPS,
  WRITING_WORKSPACE_STEPS,
  imageStepToIndex,
  resolveImageWorkspaceStep,
  resolveWritingWorkspaceStep,
  writingStepToIndex,
} from "@utils/workspaceStep";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    /** ヘッダー統合向け: 説明文なし・xs */
    compact?: boolean;
    /** 独立ヘッダー向け: 全幅・説明文なし・xs */
    header?: boolean;
  }>(),
  { compact: false, header: false }
);

const store = useAiStudioStore();

const stepperColor = computed((): "success" | "warning" | "primary" => {
  if (store.activeAgent === "writing") return "success";
  if (store.activeAgent === "image") return "warning";
  return "primary";
});

const imageStep = computed(() =>
  resolveImageWorkspaceStep({
    step: store.imageWorkflowPhase,
    workflowPhase: store.imageWorkflowPhase,
  })
);

const writingStep = computed(() =>
  resolveWritingWorkspaceStep({
    step: store.writingPhase,
    phase: store.writingPhase,
    referenceStatus: store.writingReferenceState.status,
  })
);

const activeIndex = computed((): number => {
  if (store.activeAgent === "image") {
    if (!store.imageModeSelected) return 0;
    return imageStepToIndex(imageStep.value);
  }
  if (store.activeAgent === "writing") {
    return writingStepToIndex(writingStep.value);
  }
  return 0;
});

const stepperCustomClass = computed((): string => {
  const base = "pointer-events-none";
  if (!props.compact || props.header) return base;
  if (store.activeAgent === "writing") {
    return `${base} !w-auto min-w-[18rem] sm:min-w-[20rem]`;
  }
  if (store.activeAgent === "image") {
    return `${base} !w-auto min-w-[11rem] sm:min-w-[12rem]`;
  }
  return `${base} !w-auto`;
});

const stepperItems = computed(() => {
  const withDescription = !props.compact && !props.header;
  if (store.activeAgent === "image") {
    return IMAGE_WORKSPACE_STEPS.map((item) => ({
      title: item.title,
      ...(withDescription ? { description: item.description } : {}),
      icon: item.icon,
      disabled: true,
    }));
  }
  if (store.activeAgent === "writing") {
    return WRITING_WORKSPACE_STEPS.map((item) => ({
      title: item.title,
      ...(withDescription ? { description: item.description } : {}),
      icon: item.icon,
      disabled: props.disabled,
    }));
  }
  return [];
});

</script>

<style scoped>
.ai-studio-workspace-stepper--compact :deep([data-slot="description"]) {
  display: none;
}

.ai-studio-workspace-stepper--compact :deep([data-slot="title"]) {
  font-size: 0.65rem;
  line-height: 1.1;
  white-space: nowrap;
}

.ai-studio-workspace-stepper--compact :deep([data-slot="item"]) {
  min-width: max-content;
}
</style>
