<template>
  <div
    v-if="enabled"
    class="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/80 to-white px-3 py-2.5"
  >
    <div
      v-if="isLoading"
      class="flex items-center gap-2 text-xs font-medium text-sky-700"
    >
      <UIcon
        name="material-symbols:auto-awesome"
        class="h-4 w-4 animate-pulse"
      />
      AI が候補を考えています…
    </div>
    <div v-else-if="suggestions.length > 0" class="space-y-2">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-sky-600">
        AI のおすすめ
      </p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="(suggestion, index) in suggestions"
          :key="`${suggestion}-${index}`"
          type="button"
          class="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-200 bg-white px-3 py-1 text-left text-xs font-medium text-sky-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
          @click="$emit('pick', suggestion)"
        >
          <UIcon
            name="material-symbols:add-circle-outline"
            class="h-3.5 w-3.5 flex-shrink-0 text-sky-500"
          />
          <span class="truncate">{{ suggestion }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  enabled: boolean;
  isLoading: boolean;
  suggestions: string[];
}>();

defineEmits<{
  (e: "pick", value: string): void;
}>();
</script>
