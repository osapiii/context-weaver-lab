<template>
  <details
    class="group rounded-xl border border-slate-200 bg-white shadow-sm"
    :open="open"
    @toggle="onToggle"
  >
    <summary
      class="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm font-semibold text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden"
    >
      <span class="flex items-center gap-2">
        <UIcon :name="icon" class="h-4 w-4 text-slate-500" />
        {{ title }}
      </span>
      <span class="flex flex-wrap items-center gap-2 text-xs font-normal">
        <slot name="summary-meta" />
        <UIcon
          name="i-heroicons-chevron-down"
          class="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
        />
      </span>
    </summary>
    <div class="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
      <slot />
    </div>
  </details>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    icon?: string;
    /** 親から開閉を制御（AI フィルタ適用時に開く） */
    open?: boolean;
  }>(),
  { icon: "i-heroicons-adjustments-horizontal" }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const onToggle = (event: Event): void => {
  const el = event.target as HTMLDetailsElement;
  emit("update:open", el.open);
};
</script>
