<template>
  <div v-if="categories.length > 0" class="mt-1.5 space-y-1">
    <ul class="flex flex-wrap gap-1">
      <li
        v-for="cat in categories"
        :key="cat.id"
        class="inline-flex items-center gap-1 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] leading-tight ring-1 ring-inset ring-violet-200/60 dark:bg-black/10 dark:ring-violet-800/40"
      >
        <UIcon :name="cat.icon" class="h-3 w-3 flex-shrink-0 opacity-80" />
        <span class="font-medium">{{ cat.label }}</span>
        <span class="tabular-nums font-bold">{{ cat.count }}</span>
      </li>
    </ul>
    <p v-if="footnote" class="text-[10px] leading-snug opacity-85">
      {{ footnote }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { KnowledgeWelcomeCategoryRow } from "@utils/knowledgeWelcomeSummary";

defineProps<{
  categories: KnowledgeWelcomeCategoryRow[];
  footnote?: string;
}>();
</script>
