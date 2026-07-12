<template>
  <div
    class="flex min-w-0 flex-shrink-0 items-center gap-1"
    :title="selectedOption?.description"
  >
    <UIcon
      name="material-symbols:neurology-outline"
      class="h-3.5 w-3.5 flex-shrink-0 text-violet-600"
      aria-hidden="true"
    />
    <EnSelectMenu
      :model-value="modelValue"
      :items="CONSULTATION_LLM_MODEL_OPTIONS"
      value-key="value"
      label-key="label"
      size="xs"
      placeholder="モデル"
      :search-input="false"
      :disabled="disabled"
      custom-class="!w-[7.5rem] min-w-[7.5rem]"
      :ui="{
        base: 'text-[10px] font-semibold',
        trailingIcon: 'size-3.5',
      }"
      @update:model-value="onUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EnSelectMenu from "@components/EnSelectMenu.vue";
import {
  CONSULTATION_LLM_MODEL_OPTIONS,
  type ConsultationLlmModelOption,
} from "@constants/consultationLlmModels";
import type { LlmModelSelection } from "@models/llmModelSelection";
import { LlmModelSelectionSchema } from "@models/llmModelSelection";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const modelValue = defineModel<LlmModelSelection>({ required: true });

const selectedOption = computed((): ConsultationLlmModelOption | undefined =>
  CONSULTATION_LLM_MODEL_OPTIONS.find((o) => o.value === modelValue.value)
);

const onUpdate = (value: unknown): void => {
  const parsed = LlmModelSelectionSchema.safeParse(value);
  if (parsed.success) {
    modelValue.value = parsed.data;
  }
};
</script>
