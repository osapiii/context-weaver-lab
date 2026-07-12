<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- ヘッダ -->
    <div class="flex items-center justify-between border-b bg-white px-6 py-2">
      <div class="text-xs font-bold uppercase tracking-wider text-neutral-500">
        実行ログ
        <span class="ml-2 text-neutral-400">
          ({{ entries.length }} 件)
        </span>
      </div>
      <div class="flex items-center gap-3 text-xs text-neutral-500">
        <label class="flex items-center gap-1.5">
          <input
            v-model="showRaw"
            type="checkbox"
            class="h-3.5 w-3.5 rounded border-neutral-300"
          >
          生 payload を表示
        </label>
      </div>
    </div>

    <!-- リスト本体 -->
    <div ref="scrollEl" class="flex-1 overflow-y-auto px-6 py-4">
      <div
        v-if="!entries.length"
        class="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500"
      >
        まだ実行ログがありません。<br >
        ADK がツールを実行すると <code>state.job_log</code> に追記され、ここに表示されます。
      </div>

      <ol v-else class="space-y-2">
        <li
          v-for="(e, i) in entries"
          :key="i"
          class="flex gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm shadow-sm"
        >
          <!-- ステータスバッジ -->
          <div
            class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            :class="statusBadgeClass(e.status)"
          >
            {{ i + 1 }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium text-neutral-800">
                {{ e.phase || "-" }}
              </span>
              <span
                v-if="e.step"
                class="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600"
              >
                {{ e.step }}
              </span>
              <span
                v-if="e.tool"
                class="rounded bg-purple-50 px-1.5 py-0.5 font-mono text-[11px] text-purple-700"
              >
                {{ e.tool }}
              </span>
              <span
                v-if="e.status"
                class="ml-auto text-[11px]"
                :class="statusTextClass(e.status)"
              >
                {{ e.status }}
              </span>
            </div>
            <div
              v-if="e.message"
              class="mt-1 whitespace-pre-wrap text-xs text-neutral-700"
            >
              {{ e.message }}
            </div>
            <div
              v-if="formatTs(e.ts)"
              class="mt-1 text-[11px] text-neutral-400"
            >
              {{ formatTs(e.ts) }}
            </div>
            <pre
              v-if="showRaw"
              class="mt-2 overflow-x-auto rounded bg-neutral-50 p-2 text-[11px] text-neutral-600"
            >{{ formatJson(e) }}</pre>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useResearchAgentStore } from "@stores/researchAgent";

const store = useResearchAgentStore();
const scrollEl = ref<HTMLElement | null>(null);
const showRaw = ref(false);

const entries = computed(() => {
  if (store.jobLog.length > 0) return store.jobLog;
  return store.progressHistory;
});

watch(
  () => entries.value.length,
  async () => {
    await nextTick();
    const el = scrollEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
);

const statusBadgeClass = (status?: string) => {
  switch (status) {
    case "done":
    case "completed":
    case "success":
      return "bg-emerald-100 text-emerald-700";
    case "running":
    case "started":
    case "in_progress":
      return "bg-purple-100 text-purple-700";
    case "failed":
    case "error":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-neutral-100 text-neutral-600";
  }
};
const statusTextClass = (status?: string) => {
  switch (status) {
    case "done":
    case "completed":
    case "success":
      return "text-emerald-600";
    case "running":
    case "started":
    case "in_progress":
      return "text-purple-600";
    case "failed":
    case "error":
      return "text-rose-600";
    default:
      return "text-neutral-500";
  }
};

const formatTs = (v: unknown): string => {
  if (!v) return "";
  let d: Date | null = null;
  if (typeof v === "number") {
    // 秒/ミリ秒どちらも吸収
    d = new Date(v < 1e12 ? v * 1000 : v);
  } else if (typeof v === "string") {
    const n = Number(v);
    if (!isNaN(n)) {
      d = new Date(n < 1e12 ? n * 1000 : n);
    } else {
      d = new Date(v);
    }
  }
  if (!d || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
};

const formatJson = (v: unknown) => {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};
</script>
