<template>
  <section class="min-w-0 rounded-xl border border-slate-200 bg-slate-950">
    <div class="border-b border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200">
      {{ title }}
    </div>
    <pre
      v-if="hasValue"
      class="max-h-[48vh] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-5 text-slate-100"
    >{{ formattedValue }}</pre>
    <p v-else class="p-6 text-center text-sm text-slate-400">{{ emptyLabel }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    value: unknown;
    emptyLabel?: string;
  }>(),
  { emptyLabel: "データはありません" }
);

const hasValue = computed(
  () => props.value !== undefined && props.value !== null && props.value !== ""
);

const formattedValue = computed(() => {
  if (typeof props.value === "string") return props.value;
  try {
    return JSON.stringify(props.value, null, 2);
  } catch {
    return String(props.value);
  }
});
</script>
