<template>
  <div class="h-screen w-screen overflow-hidden">
    <!-- 余白なし、完全全画面 -->
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * Fullscreen Layout
 *
 * 動画エディタ、画像エディタなど、完全な全画面表示が必要な場合に使用
 *
 * 使用例:
 * definePageMeta({
 *   layout: 'fullscreen'
 * })
 *
 * 注意:
 * - ヘッダー・サイドバーが不要な場合のみ使用
 * - 原則として例外は最小限に留める
 */
</script>

<style scoped></style>
