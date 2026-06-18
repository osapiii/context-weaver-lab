<template>
  <section class="rounded-lg border border-slate-200 bg-white px-4 py-3">
    <div class="mb-2 flex items-center gap-2">
      <UIcon name="material-symbols:fact-check-outline" class="h-5 w-5 text-slate-500" />
      <h3 class="text-sm font-semibold text-slate-900">{{ title }}</h3>
    </div>

    <p v-if="messages.length === 0" class="text-sm text-slate-500">
      CSV を選択すると検証結果が表示されます。
    </p>

    <ul v-else class="space-y-1.5">
      <li
        v-for="(message, index) in messages"
        :key="index"
        class="flex items-start gap-2 text-sm"
        :class="message.ok ? 'text-emerald-700' : 'text-red-700'"
      >
        <UIcon
          :name="message.ok ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'"
          class="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>{{ message.message }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
type ValidationMessage = {
  ok: boolean;
  message: string;
};

withDefaults(
  defineProps<{
    title?: string;
    messages: ValidationMessage[];
  }>(),
  {
    title: "検証結果",
  }
);
</script>
