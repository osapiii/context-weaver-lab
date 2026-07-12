<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { defineProps, withDefaults, defineModel } from "vue";
//#endregion

//#region State
/**
 * レンジスライダーの値
 */
const rangeValue = defineModel<number>("rangeValue");
//#endregion

//#region Props
/**
 * コンポーネントのProps定義
 *
 * @property {string} [size="md"] - レンジスライダーのサイズ
 * @property {string} [color="primary"] - レンジスライダーの色
 */
export interface Props {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: string;
}

withDefaults(defineProps<Props>(), {
  size: "md",
  color: "primary",
});
//#endregion
</script>

<template>
  <URange v-model="rangeValue" :size="size" />
</template>
