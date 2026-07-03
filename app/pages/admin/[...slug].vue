<script lang="ts" setup>
definePageMeta({
  layout: "admin",
  middleware: ["admin-logged-in-check"],
});

await navigateTo({ name: "admin-storyvault" }, { replace: true });
</script>

<template>
  <div />
</template>
