<template>
  <ModeHomePage v-if="mode" :mode="mode" />
</template>

<script lang="ts" setup>
defineOptions({
  name: "AdminWorkPage",
});

/**
 * 「仕事をこなす」モード TOP。
 * AI に依頼するカード (経営相談 / 書類記入 / 調査レポート / 画像生成) を
 * 1 ページに集約したカードグリッド。
 */
definePageMeta({
  name: "admin-work",
  layout: "admin",
  middleware: ["admin-logged-in-check"],
});

const { modes } = useNavigationModeRegistry();
const mode = computed(() => modes.find((m) => m.key === "worklog"));
</script>
