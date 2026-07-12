<template>
  <div :class="containerClass">
    <span :class="labelClass">
      {{ label }}
    </span>
  </div>
</template>

<script lang="ts" setup>
import type { PropType } from "vue";

const props = defineProps({
  /**
   * ラベルのテキスト
   */
  label: {
    type: String,
    required: true,
  },
  /**
   * サイズ: large / middle / small
   */
  size: {
    type: String as PropType<"large" | "middle" | "small">,
    default: "middle",
  },
  /**
   * ラベルの色（テキストカラー）
   */
  color: {
    type: String as PropType<
      "default" | "warning" | "neutral" | "success" | "error"
    >,
    default: "default",
  },
  /**
   * マージンボトムのサイズ（見出しとして使う場合は 'large' を指定）
   */
  marginBottom: {
    type: String as PropType<"none" | "small" | "medium" | "large">,
    default: "small",
  },
});

/**
 * サイズと色に応じたラベルのクラスを返す
 */
const labelClass = computed(() => {
  const baseClasses = "font-bold";
  const colorClasses = getColorClasses();
  const sizeClasses = getSizeClasses();
  
  return `${baseClasses} ${colorClasses} ${sizeClasses}`;
});

/**
 * 色に応じたクラスを返す
 */
const getColorClasses = () => {
  switch (props.color) {
    case "warning":
      return "text-warning-600";
    case "neutral":
      return "text-neutral-700";
    case "success":
      return "text-success-600";
    case "error":
      return "text-error-600";
    case "default":
    default:
      return "text-slate-800";
  }
};

/**
 * サイズに応じたクラスを返す
 */
const getSizeClasses = () => {
  switch (props.size) {
    case "large":
      return "text-lg";
    case "middle":
      return "text-sm";
    case "small":
      return "text-xs";
    default:
      return "text-sm";
  }
};

/**
 * コンテナのクラスを返す
 */
const containerClass = computed(() => {
  const baseClass = "flex justify-start";
  switch (props.marginBottom) {
    case "none":
      return baseClass;
    case "small":
      return `${baseClass} mb-1`;
    case "medium":
      return `${baseClass} mb-2`;
    case "large":
      return `${baseClass} mb-4`;
    default:
      return `${baseClass} mb-1`;
  }
});
</script>
