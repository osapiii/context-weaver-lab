<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-slate-900">Agent Run Log</h2>
        <p class="mt-1 text-xs text-slate-500">
          SSOT生成の根拠探索と差分判定を追跡
        </p>
      </div>
      <UIcon
        name="material-symbols:terminal"
        class="h-5 w-5 text-slate-400"
      />
    </div>
    <div class="mt-3 space-y-2">
      <div
        v-for="(line, index) in logs"
        :key="`${index}-${line}`"
        class="flex gap-2 rounded-md bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
      >
        <span class="text-emerald-300">{{ String(index + 1).padStart(2, "0") }}</span>
        <span>{{ line }}</span>
      </div>
      <div
        v-if="logs.length === 0"
        class="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400"
      >
        まだ生成ログはありません。
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  logs: string[];
}>();
</script>
