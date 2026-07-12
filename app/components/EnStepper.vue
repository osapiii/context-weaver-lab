<template>
  <UStepper
    :model-value="modelValue"
    :items="items"
    :color="color"
    :size="size"
    :orientation="orientation"
    :class="['w-full', customClass]"
    @update:model-value="(v) => $emit('update:modelValue', Number(v ?? 0))"
  >
    <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps" />
    </template>
  </UStepper>
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通ステッパー.
 *
 * UStepper の繰り返し設定 (`color="primary"` + `class="w-full"` + size) を
 * 集約した薄ラッパー. EnModal / EnButton / EnBadge / EnCard と
 * 同じ wrapper パターン.
 *
 * 利用例:
 *   <EnStepper
 *     v-model="activeStep"
 *     :items="stepperItems"
 *     size="xl"
 *   />
 *
 *   <!-- データ取り込み系 (warning 系の色を使うフロー) -->
 *   <EnStepper
 *     v-model="activeStep"
 *     :items="stepperItems"
 *     color="warning"
 *     size="sm"
 *     orientation="horizontal"
 *   />
 */

interface StepperItem {
  title?: string;
  description?: string;
  icon?: string;
  slot?: string;
  // UStepper の items の他フィールドは透過
  [key: string]: unknown;
}

type StepperColor =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "neutral";
type StepperSize = "xs" | "sm" | "md" | "lg" | "xl";
type StepperOrientation = "horizontal" | "vertical";

interface Props {
  modelValue: number;
  items: StepperItem[];
  color?: StepperColor;
  size?: StepperSize;
  orientation?: StepperOrientation;
  /** w-full は内部固定. layout 系の追加 class のみ受け付ける */
  customClass?: string;
}

withDefaults(defineProps<Props>(), {
  color: "primary",
  size: "md",
  orientation: "horizontal",
  customClass: "",
});

defineEmits<{
  "update:modelValue": [value: number];
}>();
</script>
