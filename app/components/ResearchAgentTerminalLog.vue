<template>
  <div
    class="research-terminal-log w-full overflow-hidden rounded-xl border border-neutral-800/80 shadow-inner"
    data-testid="research-agent-terminal-log"
  >
    <div class="flex items-center gap-2 border-b border-neutral-700/80 bg-[#2d2d2d] px-3 py-2">
      <div class="flex gap-1.5" aria-hidden="true">
        <span class="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span class="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span class="h-2.5 w-2.5 rounded-full bg-[#28ca42]" />
      </div>
      <span class="ml-1 text-[11px] font-medium text-neutral-400">
        実行ログ
      </span>
      <span
        v-if="entries.length"
        class="ml-auto text-[10px] tabular-nums text-neutral-500"
      >
        {{ entries.length }} 行
      </span>
    </div>
    <div
      ref="scrollEl"
      class="max-h-56 min-h-[10rem] overflow-y-auto bg-[#111827] px-3 py-2.5 font-mono text-[11px] leading-relaxed sm:max-h-64"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <p
        v-if="!entries.length"
        class="py-6 text-center text-neutral-500"
      >
        ログを待機中… ADK が処理を進めるとここに追記されます
      </p>
      <div
        v-for="(line, index) in entries"
        :key="`${line.timestamp}-${index}`"
        class="flex gap-2 py-0.5"
      >
        <span class="shrink-0 text-neutral-500">{{ line.timestamp }}</span>
        <span
          class="min-w-0 flex-1 whitespace-pre-wrap break-words"
          :class="lineClass(line.type)"
        >
          <span
            v-if="line.tag"
            class="mr-1 text-sky-400/90"
          >[{{ line.tag }}]</span>{{ line.message }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useResearchAgentStore, type ResearchJobLogEntry } from "@stores/researchAgent";

const store = useResearchAgentStore();
const scrollEl = ref<HTMLElement | null>(null);

type TerminalLine = {
  timestamp: string;
  message: string;
  type: "info" | "warn" | "error" | "debug";
  tag?: string;
};

const toTerminalLine = (entry: ResearchJobLogEntry): TerminalLine => {
  const level = String(entry.level ?? "info").toLowerCase();
  const type =
    level === "error"
      ? "error"
      : level === "warn" || level === "warning"
        ? "warn"
        : level === "debug"
          ? "debug"
          : "info";
  const ts =
    typeof entry.ts === "string" && entry.ts.trim()
      ? entry.ts.trim()
      : formatUnix(entry.ts_unix);
  const tag =
    typeof entry.tag === "string" && entry.tag.trim()
      ? entry.tag.trim()
      : undefined;
  const message =
    typeof entry.message === "string" && entry.message.trim()
      ? entry.message.trim()
      : typeof entry.note === "string"
        ? entry.note
        : JSON.stringify(entry);
  return { timestamp: ts, message, type, tag };
};

const formatUnix = (value: unknown): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--:--:--";
  const d = new Date(value < 1e12 ? value * 1000 : value);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const entries = computed((): TerminalLine[] => {
  const jobLines = store.jobLog.map(toTerminalLine);
  if (jobLines.length > 0) return jobLines;
  return store.progressHistory.map((entry) => {
    const status = String(entry.status ?? "info").toLowerCase();
    const type =
      status === "failed" || status === "error"
        ? "error"
        : status === "warn"
          ? "warn"
          : "info";
    const message =
      typeof entry.note === "string" && entry.note.trim()
        ? entry.note
        : typeof entry.message === "string"
          ? entry.message
          : [entry.phase, entry.step, entry.status].filter(Boolean).join(" · ");
    return {
      timestamp: formatUnix(entry.ts_unix ?? entry.ts),
      message,
      type,
      tag:
        typeof entry.phase === "string" ? entry.phase : undefined,
    };
  });
});

const lineClass = (type: TerminalLine["type"]): string => {
  switch (type) {
    case "error":
      return "text-rose-400";
    case "warn":
      return "text-purple-300";
    case "debug":
      return "text-neutral-500";
    default:
      return "text-emerald-300";
  }
};

watch(
  () => entries.value.length,
  async () => {
    await nextTick();
    const el = scrollEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
);
</script>
