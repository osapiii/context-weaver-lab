<template>
  <span
    class="inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm"
    :class="toneClass"
  >
    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm">
      <UIcon :name="icon" class="h-4 w-4" />
    </span>
    <span class="min-w-0">
      <span class="block leading-tight">{{ label }}</span>
      <span class="block truncate text-[10px] font-medium leading-tight opacity-75">
        {{ description }}
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
import type { VibeControlZappingAnalysisStatus } from "@models/vibeControl";

const props = defineProps<{
  status: VibeControlZappingAnalysisStatus;
}>();

const label = computed(() => {
  switch (props.status) {
    case "completed":
      return "解析済み";
    case "running":
      return "解析中";
    case "queued":
      return "待機中";
    case "error":
      return "要確認";
    default:
      return "未解析";
  }
});

const description = computed(() => {
  switch (props.status) {
    case "completed":
      return "ストーリー候補を利用できます";
    case "running":
      return "動画と発話を読み取り中";
    case "queued":
      return "解析ジョブを準備中";
    case "error":
      return "再実行できます";
    default:
      return "解析実行で候補を作成";
  }
});

const icon = computed(() => {
  switch (props.status) {
    case "completed":
      return "material-symbols:verified-rounded";
    case "running":
      return "material-symbols:autorenew-rounded";
    case "queued":
      return "material-symbols:pending-actions-rounded";
    case "error":
      return "material-symbols:error-outline-rounded";
    default:
      return "material-symbols:radio-button-unchecked";
  }
});

const toneClass = computed(() => {
  switch (props.status) {
    case "completed":
      return "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-900";
    case "running":
      return "border-primary-200 bg-gradient-to-r from-primary-50 to-sky-50 text-primary-900";
    case "queued":
      return "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900";
    case "error":
      return "border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50 text-rose-900";
    default:
      return "border-slate-200 bg-gradient-to-r from-white to-slate-50 text-slate-700";
  }
});
</script>
