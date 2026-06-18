<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { defineProps, withDefaults } from "vue";
//#endregion

//#region Props
/**
 * コンポーネントのProps定義
 *
 * @property {string | undefined} imageUrl - 表示する画像のURL
 * @property {string} [width="100%"] - 画像の幅
 */
export interface Props {
  imageUrl: string | undefined;
  width?: string;
}

withDefaults(defineProps<Props>(), {
  width: "100%",
});
//#endregion
</script>

<template>
  <template v-if="imageUrl != undefined">
    <NuxtImg :src="imageUrl" alt="hero" :width="width" />
  </template>
  <template v-if="imageUrl == undefined">
    <NuxtImg src="/noImage.jpg" alt="hero" :width="width" fit="true" />
  </template>
</template>
