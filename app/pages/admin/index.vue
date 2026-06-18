<template>
  <MobileHomePage v-if="isMobile" />
  <div v-else class="space-y-8">
    <HomeAssistantHero />
    <HomeSystemBoard />
  </div>
</template>

<script lang="ts" setup>
/**
 * Home (ログイン後のトップ着地点)。
 */
definePageMeta({
  name: "admin",
  layout: "admin",
  middleware: ["admin-logged-in-check"],
  adminPageStack: false,
});

const { isMobile } = useIsMobile();

// 端末に応じて layout を切替 (モバイルでは PC 用 admin layout は不要)。
watchEffect(() => {
  setPageLayout(isMobile.value ? "mobile" : "admin");
});
</script>
