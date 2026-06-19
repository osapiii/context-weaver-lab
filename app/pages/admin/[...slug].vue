<script lang="ts" setup>
definePageMeta({
  layout: "admin",
  middleware: ["admin-logged-in-check"],
});

await navigateTo({ name: "admin-vibe-control" }, { replace: true });
</script>

<template>
  <div />
</template>
