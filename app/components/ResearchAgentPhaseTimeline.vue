<template>
  <div
    class="phase-stepper-wrap relative"
    :class="compact ? 'phase-stepper-wrap--compact' : ''"
  >
    <EnStepper
      v-model="currentStepIndex"
      :items="stepperItems"
      color="warning"
      :size="compact ? 'xs' : 'sm'"
      orientation="horizontal"
      :linear="true"
      :ui="{
        root: compact ? 'w-auto max-w-full' : 'w-full',
        header: 'gap-1',
        separator: 'phase-separator mx-1',
        title: compact ? 'text-[10px] font-semibold' : 'text-xs font-semibold',
        description: 'text-[10px] text-neutral-500',
      }"
      custom-class="phase-stepper pointer-events-none"
    >
      <template #indicator="{ item, index }">
        <div class="indicator-wrap relative flex flex-col items-center">
          <!-- 経過時間バッジ (running のみ): indicator の真上に常時表示 -->
          <span
            v-if="!compact && isRunning(index)"
            class="elapsed-badge absolute -top-7 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums shadow-md shadow-purple-200"
            aria-live="polite"
          >
            <span class="h-1 w-1 animate-pulse rounded-full bg-white" />
            {{ elapsedFromNow(store.phases[index].startedAt ?? 0) }}
          </span>

          <div
            class="indicator-inner relative flex h-7 w-7 items-center justify-center rounded-full"
            :class="indicatorClass(item, index)"
          >
            <!-- Sonar 二重リング (running のみ): 多重の脈動で「動いてる」感を強化 -->
            <template v-if="isRunning(index)">
              <span
                class="absolute inset-0 animate-sonar-1 rounded-full ring-2 ring-purple-400"
                aria-hidden="true"
              />
              <span
                class="absolute inset-0 animate-sonar-2 rounded-full ring-2 ring-purple-500"
                aria-hidden="true"
              />
              <span
                class="absolute inset-0 rounded-full bg-purple-400 opacity-30 animate-ping"
                aria-hidden="true"
              />
            </template>

            <UIcon
              v-if="isDone(index)"
              name="material-symbols:check"
              class="relative z-10 h-4 w-4"
            />
            <UIcon
              v-else-if="isFailed(index)"
              name="material-symbols:close"
              class="relative z-10 h-4 w-4"
            />
            <UIcon
              v-else-if="item.icon"
              :name="item.icon as string"
              class="relative z-10 h-4 w-4"
              :class="{ 'animate-icon-pulse': isRunning(index) }"
            />
            <span v-else class="relative z-10 text-[11px] font-bold">
              {{ index + 1 }}
            </span>
          </div>
        </div>
      </template>
    </EnStepper>

    <!-- サブステータスバー: 強調版 (banner-like + アイコン + 太字) -->
    <div
      v-if="!compact && runningPhase"
      class="running-banner mt-4 mx-auto inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-purple-200 bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50 px-4 py-1.5 text-xs text-purple-800 shadow-sm shadow-purple-100"
      role="status"
      aria-live="polite"
    >
      <!-- 脈動ドット -->
      <span class="relative inline-flex h-2 w-2 flex-shrink-0">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-500 opacity-75"
        />
        <span class="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
      </span>
      <span class="font-bold">AI が実行中</span>
      <span class="text-purple-400">·</span>
      <span class="font-semibold">{{ runningPhase.label }}</span>
      <span class="text-purple-400">·</span>
      <span class="tabular-nums font-mono">
        {{ elapsedFromNow(runningPhase.startedAt ?? 0) }}
      </span>
      <template v-if="currentToolHint">
        <span class="text-purple-400">·</span>
        <span class="italic">{{ currentToolHint }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useResearchAgentStore } from "@stores/researchAgent";

const { compact } = withDefaults(
  defineProps<{
    /** ヘッダー統合向け: 経過バッジ・実行バナーを省略 */
    compact?: boolean;
  }>(),
  { compact: false },
);

const store = useResearchAgentStore();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

// 2026-05 大胆刷新: 新 phase キーに対応
const phaseIcon = (key: string): string => {
  switch (key) {
    case "phase1_hearing":
      return "material-symbols:hearing";
    case "phase1_8_research":
      return "material-symbols:travel-explore";
    case "phase2_svg":
      return "material-symbols:design-services";
    case "phase3_html":
      return "material-symbols:auto-stories";
    default:
      return "material-symbols:circle";
  }
};

const stepperItems = computed(() =>
  store.phases.map((p) => ({
    value: p.key,
    title: p.label,
    icon: phaseIcon(p.key),
  })),
);

const currentStepIndex = computed({
  get() {
    const runningIdx = store.phases.findIndex((p) => p.status === "running");
    if (runningIdx >= 0) return runningIdx;
    const doneCount = store.phases.filter((p) => p.status === "done").length;
    return doneCount;
  },
  set() {
    /* read-only display: ignore writes */
  },
});

const runningPhase = computed(() =>
  store.phases.find((p) => p.status === "running"),
);

const currentToolHint = computed(() => {
  const last = [...store.messages]
    .reverse()
    .find((m) => m.role === "tool" && m.isStreaming);
  return last?.toolCall?.name ? `${last.toolCall.name} 実行中` : "";
});

const isDone = (index: number) => store.phases[index]?.status === "done";
const isRunning = (index: number) => store.phases[index]?.status === "running";
const isFailed = (index: number) => store.phases[index]?.status === "failed";

const indicatorClass = (_item: unknown, index: number) => {
  if (isDone(index))
    return "bg-gradient-to-br from-purple-400 to-violet-500 text-white ring-2 ring-purple-200";
  if (isRunning(index))
    return "bg-gradient-to-br from-purple-500 to-violet-500 text-white ring-2 ring-purple-300 scale-125";
  if (isFailed(index))
    return "bg-rose-100 text-rose-600 ring-2 ring-rose-200";
  return "bg-white text-neutral-400 ring-2 ring-neutral-200";
};

const elapsedFromNow = (startedAt: number) => {
  if (!startedAt) return "0s";
  const ms = now.value - startedAt;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m${rem.toString().padStart(2, "0")}s`;
};
</script>

<style scoped>
/* UStepper の内側 indicator を上書きするため、リセット */
.phase-stepper :deep(.indicator),
.phase-stepper :deep([class*="indicator"]) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* indicator wrapper: 余白を確保して上のバッジが見切れない */
.indicator-wrap {
  padding-top: 12px;
}

.phase-stepper-wrap--compact .indicator-wrap {
  padding-top: 0;
}

.phase-stepper-wrap--compact :deep([data-slot="description"]) {
  display: none;
}

/* === icon の弱めの脈動 === */
@keyframes icon-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}
.animate-icon-pulse {
  animation: icon-pulse 1.6s ease-in-out infinite;
}

/* === Sonar 二重リング: running indicator の周りに脈動波が広がる === */
@keyframes sonar-expand {
  0% {
    transform: scale(1);
    opacity: 0.85;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}
.animate-sonar-1 {
  animation: sonar-expand 1.8s ease-out infinite;
}
.animate-sonar-2 {
  animation: sonar-expand 1.8s ease-out 0.6s infinite;
}

/* === 経過時間バッジ: 軽く上下バウンス === */
@keyframes elapsed-bob {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-2px);
  }
}
.elapsed-badge {
  animation: elapsed-bob 2.2s ease-in-out infinite;
}

/* === 実行中バナーの背景シマー === */
.running-banner {
  background-size: 200% 100%;
  animation: banner-shimmer 3.5s ease-in-out infinite;
}
@keyframes banner-shimmer {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

/* === separator に進行感を出す === */
.phase-stepper :deep(.phase-separator) {
  position: relative;
  overflow: hidden;
}
.phase-stepper :deep(.phase-separator)::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(168, 85, 247, 0.45) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: separator-flow 2.2s linear infinite;
  pointer-events: none;
}
@keyframes separator-flow {
  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-icon-pulse,
  .animate-sonar-1,
  .animate-sonar-2,
  .elapsed-badge,
  .running-banner {
    animation: none;
  }
  .phase-stepper :deep(.phase-separator)::after {
    animation: none;
    background: rgba(168, 85, 247, 0.2);
    transform: none;
  }
}
</style>
