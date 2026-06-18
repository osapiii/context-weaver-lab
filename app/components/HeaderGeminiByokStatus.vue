<template>
  <NuxtLink
    :to="{ name: 'admin-api-keys' }"
    class="hidden md:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border"
    :class="linkClass"
    :title="title"
  >
    <span
      class="w-1.5 h-1.5 rounded-full flex-shrink-0"
      :class="dotClass"
    />
    <UIcon
      name="material-symbols:key-vertical-rounded"
      class="w-3.5 h-3.5 flex-shrink-0"
    />
    <span class="whitespace-nowrap">{{ geminiByok.statusShortLabel }}</span>
  </NuxtLink>
</template>

<script lang="ts" setup>
import { useGeminiByokStore } from "@stores/gemini-byok";

const geminiByok = useGeminiByokStore();

onMounted(() => {
  void geminiByok.loadUserApiKey();
});

const linkClass = computed(() => {
  if (geminiByok.isLoading) {
    return "border-slate-600 bg-slate-800/80 text-slate-300 hover:bg-slate-700";
  }
  if (geminiByok.hasApiKey) {
    return "border-emerald-700/60 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50";
  }
  return "border-purple-700/50 bg-purple-950/30 text-purple-200 hover:bg-purple-900/40";
});

const dotClass = computed(() => {
  if (geminiByok.isLoading) return "bg-slate-400 animate-pulse";
  if (geminiByok.hasApiKey) return "bg-emerald-400";
  return "bg-purple-400 animate-pulse";
});

const title = computed(() => {
  if (geminiByok.isLoading) {
    return "Gemini API キー (BYOK) の登録状態を確認中…";
  }
  if (geminiByok.hasApiKey) {
    return "Gemini API キー登録済み — AI 機能が利用できます";
  }
  return "Gemini API キー未登録 — 設定 → AI 連携 で登録してください";
});
</script>
