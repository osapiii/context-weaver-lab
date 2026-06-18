<template>
  <UButton
    color="neutral"
    variant="ghost"
    :size="size"
    icon="i-heroicons-chat-bubble-left-ellipsis"
    title="行の内容を引用して質問できます"
    aria-label="行の内容を引用して質問できます"
    tabindex="-1"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: "xs" | "sm" | "md" | "lg" | "xl";
  }>(),
  {
    size: "xs",
  }
);
</script>
