<script setup lang="ts">
/**
 * ルートエントリ。IA 再構成後の AI ハブ `/admin` へ直行する。
 * 認証 / Space 解決は admin レイアウト配下の middleware が担う。
 */
const router = useRouter();
router.push({ name: "admin" });
</script>

<template>
  <div />
</template>
