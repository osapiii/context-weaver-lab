<template>
  <AiStudioModeSegmentBar
    :model-value="modelValue ?? ''"
    :items="modeOptions"
    :disabled="disabled"
    density="compact"
    label-mode="label"
    :show-counts="false"
    class="w-full min-w-0 flex-1"
    aria-label="ワークスペースモード"
    @update:model-value="onModeChange"
  />
</template>

<script setup lang="ts">
import {
  AI_STUDIO_HUB_JOB_META,
  AI_STUDIO_HUB_VISIBLE_JOB_KINDS,
} from "@constants/aiStudioHub";
import type { AiStudioJobKind } from "@stores/aiStudio";
import AiStudioModeSegmentBar from "@components/AiStudio/AiStudioModeSegmentBar.vue";

const props = withDefaults(
  defineProps<{
    modelValue: AiStudioJobKind;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  "update:modelValue": [value: Exclude<AiStudioJobKind, null>];
}>();

const modeOptions = AI_STUDIO_HUB_VISIBLE_JOB_KINDS.map((value) => ({
  value,
  label: AI_STUDIO_HUB_JOB_META[value].label,
  shortLabel: AI_STUDIO_HUB_JOB_META[value].shortLabel,
  icon: AI_STUDIO_HUB_JOB_META[value].icon,
}));

const onModeChange = (value: string): void => {
  if (props.disabled) return;
  emit("update:modelValue", value as Exclude<AiStudioJobKind, null>);
};
</script>
