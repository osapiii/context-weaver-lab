<template>
  <EnBadge :leading-icon="icon" :color="color" :variant="variant">
    <slot />
  </EnBadge>
</template>

<script setup lang="ts">
export interface Props {
  variant?: "solid" | "outline" | "soft" | "subtle";
  color?:
    | "primary"
    | "warning"
    | "success"
    | "info"
    | "error"
    | "background"
    | "violet";
  icon?: string;
}

withDefaults(defineProps<Props>(), {
  color: "primary",
  variant: "solid",
  icon: undefined, // アイコンは必要に応じてprops経由で指定
});
</script>
