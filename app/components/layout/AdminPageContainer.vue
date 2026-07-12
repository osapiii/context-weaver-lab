<template>
  <div :class="shellClass">
    <div :class="innerClass">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AdminPageContainerVariant } from "@composables/useAdminViewport";
import {
  ADMIN_PAGE_CONTENT_CLASS,
  ADMIN_PAGE_MARGIN_CLASS,
  ADMIN_PAGE_STACK_CLASS,
  ADMIN_VIEWPORT_FILL_CLASS,
} from "@composables/useAdminViewport";

const props = withDefaults(
  defineProps<{
    variant?: AdminPageContainerVariant;
    /** チャット / Workspace など main 高さいっぱいに使う */
    fillHeight?: boolean;
    /** default 時に space-y-6 を付ける */
    stack?: boolean;
    contentClass?: string;
    shellClass?: string;
  }>(),
  {
    variant: "default",
    fillHeight: false,
    stack: true,
    contentClass: "",
    shellClass: "",
  }
);

const shellClass = computed(() => {
  const fillShell = props.fillHeight
    ? `${ADMIN_VIEWPORT_FILL_CLASS} min-h-0 flex-1`
    : "";

  if (props.variant === "flush") {
    return [fillShell, ADMIN_PAGE_CONTENT_CLASS, props.shellClass]
      .filter(Boolean)
      .join(" ");
  }

  return [fillShell, ADMIN_PAGE_MARGIN_CLASS, props.shellClass]
    .filter(Boolean)
    .join(" ");
});

const innerClass = computed(() => {
  const stack =
    props.stack && props.variant !== "flush" ? ADMIN_PAGE_STACK_CLASS : "";

  return [
    ADMIN_PAGE_CONTENT_CLASS,
    props.fillHeight ? "flex min-h-0 flex-1 flex-col" : "",
    stack,
    props.contentClass,
  ]
    .filter(Boolean)
    .join(" ");
});
</script>
