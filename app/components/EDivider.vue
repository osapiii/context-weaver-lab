<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { defineProps, withDefaults } from "vue";
//#endregion

//#region Props
/**
 * コンポーネントのProps定義
 *
 * @property {string} [label=""] - 区切り線のラベルテキスト
 * @property {string} [orientation="horizontal"] - 区切り線の向き
 * @property {string} [size="sm"] - 区切り線のサイズ
 */
export interface Props {
  label?: string;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
}

withDefaults(defineProps<Props>(), {
  label: "",
  orientation: "horizontal",
  size: "sm",
});
//#endregion
</script>

<template>
  <UDivider :label="label" :orientation="orientation" :size="size" />
</template>
