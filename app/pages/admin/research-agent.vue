<template>
  <div />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

definePageMeta({
  layout: "admin",
  adminPageContainer: "flush",
  adminPageFillHeight: true,
  adminPageStack: false,
});

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const query: Record<string, string> = { kind: "research" };
  const session = route.query.session;
  if (typeof session === "string" && session.trim()) {
    query.session = session.trim();
  }
  await router.replace({
    name: "admin-ai-studio",
    query,
  });
});
</script>
