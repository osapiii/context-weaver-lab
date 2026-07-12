<template>
  <AiStudioStartKioskShell
    theme="image"
    mascot-message="どんな作り方にする？&#10;まずは方法を選んでね"
    mascot-alt="画像生成 AI"
    title="作成方法"
    description="0から作るか、お手本画像の構成を活かすかを選択してください。"
    test-id="image-creation-start-kiosk"
  >
    <AiStudioKioskChoicePanel
      title="作成方法を選んでください"
      :options="options"
      :model-value="modelValue"
      :disabled="disabled"
      :show-header="false"
      theme="image"
      aria-label="画像の作成方法"
      test-id="image-creation-mode-picker"
      option-test-id-prefix="image-creation-mode"
      @update:model-value="onModeChange"
    />
  </AiStudioStartKioskShell>
</template>

<script setup lang="ts">
import AiStudioKioskChoicePanel from "@components/AiStudio/AiStudioKioskChoicePanel.vue";
import AiStudioStartKioskShell from "@components/AiStudio/AiStudioStartKioskShell.vue";
import {
  IMAGE_CREATION_MODE_OPTIONS,
  type ImageCreationMode,
} from "@utils/imageReference";

defineProps<{
  modelValue: ImageCreationMode | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ImageCreationMode];
}>();

const options = IMAGE_CREATION_MODE_OPTIONS;

const onModeChange = (value: string): void => {
  emit("update:modelValue", value as ImageCreationMode);
};
</script>
