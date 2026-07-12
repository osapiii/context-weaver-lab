<template>
  <div
    class="text-slate-800 border border-slate-200 p-2 rounded-lg w-fit"
    :class="{
      'font-bold': fontBold,
      'text-xl': biggerFont,
      'text-md': !biggerFont,
    }"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { defineProps } from "vue";
//#endregion Imports - 外部ライブラリ

//#region Props
/**
 * コンポーネントのプロパティ
 */
const props = defineProps<{
  /**
   * フォントを太字にするかどうか
   * @default false
   */
  fontBold?: boolean;
  /**
   * フォントサイズを大きくするかどうか
   * @default false
   */
  biggerFont?: boolean;
}>();
//#endregion Props
</script>
