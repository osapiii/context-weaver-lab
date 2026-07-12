<template>
  <div
    class="live-chip inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 ring-1 ring-slate-700 text-xs font-bold text-slate-100 whitespace-nowrap shrink-0 backdrop-blur-sm"
    :title="liveDateLong"
    aria-live="polite"
    aria-label="現在時刻"
  >
    <span class="relative inline-flex">
      <span class="block w-2 h-2 rounded-full bg-emerald-400" />
      <span
        class="absolute inset-0 rounded-full bg-emerald-400 animate-ping"
        aria-hidden="true"
      />
    </span>
    <span class="tabular-nums">{{ liveDate }}</span>
    <span class="text-slate-500">·</span>
    <span class="tabular-nums">{{ liveTime }}</span>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from "vue";

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;
const pad2 = (n: number): string => String(n).padStart(2, "0");

const now = ref<Date>(new Date());
let clockTimer: ReturnType<typeof setInterval> | null = null;
let alignTimer: ReturnType<typeof setTimeout> | null = null;

const liveDate = computed(() => {
  const d = now.value;
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY_JP[d.getDay()]})`;
});
const liveTime = computed(() => {
  const d = now.value;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
});
const liveDateLong = computed(() => {
  const d = now.value;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY_JP[d.getDay()]}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
});

onMounted(() => {
  // 次の分境界に合わせて初回 align してから 60s 周期で tick
  const ms = new Date();
  const msToNextMinute =
    (60 - ms.getSeconds()) * 1000 - ms.getMilliseconds();
  alignTimer = setTimeout(() => {
    now.value = new Date();
    clockTimer = setInterval(() => {
      now.value = new Date();
    }, 60_000);
  }, Math.max(50, msToNextMinute));
});
onUnmounted(() => {
  if (alignTimer) clearTimeout(alignTimer);
  if (clockTimer) clearInterval(clockTimer);
});
</script>
