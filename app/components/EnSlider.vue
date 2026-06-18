<template>
  <USlider
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :color="color"
    :size="size"
    :disabled="disabled"
    :class="rootClass"
    @update:model-value="(v) => $emit('update:modelValue', v ?? 0)"
  />
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通スライダー.
 *
 * USlider の全 10 箇所で `class="game-slider"` が共通指定されているのを
 * variant プリセットに集約. game feel を API レベルで強制する.
 *
 * 利用例:
 *   <!-- ゲーム調 (デフォルト) -->
 *   <EnSlider v-model="value" :min="0" :max="10" :step="1" />
 *
 *   <!-- プレーン (例: 設定画面で目立たせたくない場合) -->
 *   <EnSlider variant="plain" v-model="value" :min="0" :max="100" />
 */

type SliderVariant = "game" | "plain";
type SliderColor = "primary" | "info" | "success" | "warning" | "error" | "neutral";
type SliderSize = "xs" | "sm" | "md" | "lg" | "xl";

interface Props {
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  /** game = game-slider class 強制 (game feel). plain = 透過 */
  variant?: SliderVariant;
  color?: SliderColor;
  size?: SliderSize;
  disabled?: boolean;
  customClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  variant: "game",
  color: "primary",
  size: "md",
  disabled: false,
  customClass: "",
});

defineEmits<{
  "update:modelValue": [value: number];
}>();

const rootClass = computed<string>(() => {
  const base = props.variant === "game" ? "game-slider" : "";
  return [base, props.customClass].filter(Boolean).join(" ");
});
</script>
