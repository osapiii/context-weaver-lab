<script lang="ts" setup>
definePageMeta({
  name: "admin",
  layout: "admin",
  middleware: ["admin-logged-in-check"],
  adminPageStack: false,
});

await navigateTo({ name: "admin-storyvault" }, { replace: true });
</script>

<template>
  <div />
</template>
