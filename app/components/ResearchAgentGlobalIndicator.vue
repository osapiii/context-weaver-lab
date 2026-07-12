<template>
  <Transition name="indicator-slide" mode="out-in">
    <button
      v-if="visible"
      type="button"
      class="indicator-chip group inline-flex h-9 max-w-[260px] items-center gap-2 rounded-full bg-white/95 px-3 text-xs font-semibold text-purple-700 shadow-[0_4px_12px_-2px_rgba(139,92,246,0.25)] ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_rgba(139,92,246,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      :class="[
        isCompleted
          ? 'ring-emerald-300 indicator-completed text-emerald-700'
          : isFailed
            ? 'ring-rose-300 text-rose-700'
            : 'ring-purple-200 indicator-running',
      ]"
      :title="title"
      @click="openSession"
    >
      <!-- ペンギン mini (完了/失敗時はアイコンに差し替え) -->
      <span class="relative flex-shrink-0">
        <ResearchAgentPenguinMini v-if="!isCompleted && !isFailed" :is-busy="isBusy" />
        <UIcon
          v-else-if="isCompleted"
          name="material-symbols:check-circle"
          class="h-6 w-6 text-emerald-500"
        />
        <UIcon
          v-else
          name="material-symbols:error"
          class="h-6 w-6 text-rose-500"
        />
      </span>

      <!-- Phase ラベル + 進捗バー + 経過時間 (中サイズ以上で表示) -->
      <span class="hidden min-w-0 flex-1 flex-col items-start gap-0.5 sm:flex">
        <span class="flex w-full items-center gap-1.5">
          <span class="truncate text-[11px] font-bold leading-none">
            {{ chipLabel }}
          </span>
          <span
            v-if="autoMode"
            class="flex-shrink-0 rounded-full bg-purple-100 px-1.5 py-px text-[9px] font-bold tabular-nums text-purple-700 ring-1 ring-purple-200"
          >
            {{ autoTurnCount }}/{{ autoMaxTurns }}
          </span>
        </span>
        <span class="flex w-full items-center gap-1.5">
          <!-- mini progress bar -->
          <span class="h-1 flex-1 overflow-hidden rounded-full bg-purple-100">
            <span
              class="block h-full rounded-full transition-all duration-500 ease-out"
              :class="
                isCompleted
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  : isFailed
                    ? 'bg-rose-400'
                    : 'bg-gradient-to-r from-purple-400 to-violet-500'
              "
              :style="{ width: `${progressPct}%` }"
            />
          </span>
          <span class="flex-shrink-0 text-[9px] tabular-nums text-neutral-500">
            {{ elapsedLabel }}
          </span>
        </span>
      </span>

      <!-- 右端の矢印 (戻る) -->
      <UIcon
        name="material-symbols:arrow-forward"
        class="h-3.5 w-3.5 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
        :class="isCompleted ? 'text-emerald-500' : isFailed ? 'text-rose-500' : 'text-purple-500'"
      />
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAiStudioStore } from "@stores/aiStudio";
import { useResearchAgentStore } from "@stores/researchAgent";
import ResearchAgentPenguinMini from "@components/ResearchAgentPenguinMini.vue";

const store = useResearchAgentStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

// ─── 表示条件 ─────────────────────────────
const isOnResearchWorkspace = computed(() => {
  if (route.name === "admin-research-agent") return true;
  if (route.name === "admin-ai-studio") {
    const aiStudio = useAiStudioStore();
    return aiStudio.jobKind === "research" && !!aiStudio.sessionId;
  }
  return false;
});
const visible = computed(
  () =>
    !!store.sessionId &&
    !isOnResearchWorkspace.value &&
    !autoDismissed.value,
);

// ─── 状態区分 ─────────────────────────────
const isBusy = computed(
  () =>
    store.isStreaming ||
    store.isAutoResponding ||
    store.autoMode ||
    (store.researchWorkflowPhase === "submitted" && !store.isCompleted),
);
const isCompleted = computed(() => store.isCompleted);
const isFailed = computed(() =>
  store.phases.some((p) => p.status === "failed"),
);

// ─── 表示用ラベル ─────────────────────────
const currentPhase = computed(() => store.currentPhase);
const chipLabel = computed(() => {
  if (isCompleted.value) return "✨ 完成しました";
  if (isFailed.value) return "失敗 詳細を見る";
  return currentPhase.value?.label ?? "準備中";
});
const title = computed(() => {
  if (isCompleted.value) return "リサーチが完了しました。クリックで開く";
  if (isFailed.value) return "途中でエラーが発生しました。クリックで開く";
  return `${currentPhase.value?.label ?? "AI 実行中"} - クリックで戻る`;
});

const autoMode = computed(() => store.autoMode);
const autoTurnCount = computed(() => store.autoTurnCount);
const autoMaxTurns = computed(() => store.autoMaxTurns);

// 進捗率: done 数 / 全 Phase 数 + running を 0.5 として加算
const progressPct = computed(() => {
  const total = store.phases.length || 1;
  let progress = 0;
  for (const p of store.phases) {
    if (p.status === "done") progress += 1;
    else if (p.status === "running") progress += 0.5;
  }
  return Math.min(100, Math.round((progress / total) * 100));
});

// ─── 経過時間 (running phase の startedAt から) ────────
const now = ref(Date.now());
let tickTimer: number | null = null;
const elapsedLabel = computed(() => {
  const startedAt = currentPhase.value?.startedAt;
  if (!startedAt || isCompleted.value || isFailed.value) return "";
  const sec = Math.max(0, Math.floor((now.value - startedAt) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${String(s).padStart(2, "0")}s`;
});

// ─── ポーリング: visible 中だけ 8 秒ごと ────────
let pollTimer: number | null = null;
const startPolling = () => {
  if (pollTimer != null) return;
  // 即時 1 回 + その後 8 秒間隔
  void store.pollSessionState();
  pollTimer = window.setInterval(() => {
    void store.pollSessionState();
  }, 8000);
};
const stopPolling = () => {
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

// ─── 完了後 60 秒で chip 自動消滅 (sessionId は維持) ────────
const autoDismissed = ref(false);
let dismissTimer: number | null = null;
const scheduleAutoDismiss = () => {
  if (dismissTimer != null) return;
  dismissTimer = window.setTimeout(() => {
    autoDismissed.value = true;
  }, 60 * 1000);
};
const clearDismiss = () => {
  if (dismissTimer != null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  autoDismissed.value = false;
};

// ─── ライフサイクル ─────────────────────────
watch(
  visible,
  (v) => {
    if (v) {
      startPolling();
      // 1 秒ごとに now を更新 (経過時間)
      if (tickTimer == null) {
        tickTimer = window.setInterval(() => (now.value = Date.now()), 1000);
      }
    } else {
      stopPolling();
      if (tickTimer != null) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
    }
  },
  { immediate: true },
);

// sessionId が切り替わったら dismiss 状態をリセット
watch(
  () => store.sessionId,
  () => clearDismiss(),
);

// 完了通知 (1 回だけ): toast 発火 + 自動消滅タイマー仕掛け
watch(
  () => store.justCompleted,
  (now) => {
    if (!now) return;
    // chip は emerald 表示に切り替わるので、Toast も併発
    toast.add({
      title: "リサーチ完了!",
      description: "スライド資料のダウンロードが可能です",
      icon: "material-symbols:check-circle",
      color: "success",
      duration: 0,
      actions: [
        {
          label: "開く",
          onClick: () => openSession(),
        },
      ],
    });
    store.consumeCompletion();
    scheduleAutoDismiss();
  },
);

onBeforeUnmount(() => {
  stopPolling();
  if (tickTimer != null) clearInterval(tickTimer);
  if (dismissTimer != null) clearTimeout(dismissTimer);
});

// ─── クリック→ research-agent に戻る ─────────
const openSession = () => {
  if (!store.sessionId) return;
  router.push({
    name: "admin-ai-studio",
    query: { kind: "research", session: store.sessionId },
  });
};
</script>

<style scoped>
/* running 中の呼吸 (リング pulse) */
.indicator-running {
  animation: indicator-breathe 2.4s ease-in-out infinite;
}
@keyframes indicator-breathe {
  0%,
  100% {
    box-shadow:
      0 4px 12px -2px rgba(168, 85, 247, 0.25),
      0 0 0 0 rgba(168, 85, 247, 0.4);
  }
  50% {
    box-shadow:
      0 5px 14px -2px rgba(168, 85, 247, 0.32),
      0 0 0 4px rgba(168, 85, 247, 0);
  }
}

/* 完了時の bounce 2 回 */
.indicator-completed {
  animation: indicator-bounce 0.6s ease-out 0s 2;
}
@keyframes indicator-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

/* slide-in-right Transition */
.indicator-slide-enter-active,
.indicator-slide-leave-active {
  transition:
    opacity 240ms ease,
    transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.indicator-slide-enter-from {
  opacity: 0;
  transform: translateX(12px) scale(0.92);
}
.indicator-slide-leave-to {
  opacity: 0;
  transform: translateX(8px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .indicator-running,
  .indicator-completed,
  .indicator-slide-enter-active,
  .indicator-slide-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
