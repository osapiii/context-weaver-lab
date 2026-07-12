<template>
  <div
    class="writing-studio-workflow-center mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-3 py-4 sm:max-w-3xl sm:px-4"
    data-testid="writing-studio-workflow-center"
  >
    <div class="relative w-fit max-w-full">
      <div
        class="speech-bubble relative w-fit max-w-full rounded-2xl bg-white px-4 py-3 shadow-[0_6px_20px_-8px_rgba(16,185,129,0.22)] ring-1"
        :class="
          phase === 'failed'
            ? 'ring-rose-200'
            : phase === 'complete'
              ? 'ring-emerald-200'
              : 'ring-emerald-200/90'
        "
      >
        <p
          class="whitespace-pre-line text-center text-sm font-semibold leading-snug"
          :class="
            phase === 'failed'
              ? 'text-rose-800'
              : phase === 'complete'
                ? 'text-emerald-900'
                : 'text-emerald-950'
          "
          aria-live="polite"
        >
          {{ headline }}
        </p>
        <p
          v-if="subline"
          class="mt-1.5 text-center text-xs leading-relaxed text-slate-600"
        >
          {{ subline }}
        </p>
        <span class="bubble-tail" aria-hidden="true" />
      </div>
    </div>

    <div class="penguin-body relative">
      <div class="penguin-shadow" aria-hidden="true" />
      <NuxtImg
        :src="appearance.aiAvatarUrl.value"
        :alt="
          appearance.hasCustomAiAvatar.value
            ? 'AI アシスタント'
            : '書類記入 AI バディ'
        "
        class="penguin-img relative z-10 h-32 w-32 object-contain sm:h-36 sm:w-36"
        :class="phase === 'working' ? 'penguin-thinking' : 'penguin-bobbing'"
      />
      <div
        class="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-sm"
        :class="{ 'animate-pulse': phase !== 'working' }"
      >
        <UIcon
          :name="
            phase === 'working'
              ? 'material-symbols:progress-activity'
              : phase === 'complete'
                ? 'i-heroicons-check'
                : 'i-heroicons-exclamation-triangle'
          "
          class="h-3.5 w-3.5 text-white"
          :class="{ 'animate-spin': phase === 'working' }"
        />
      </div>
      <template v-if="phase === 'working'">
        <span class="thinking-dot d1" aria-hidden="true" />
        <span class="thinking-dot d2" aria-hidden="true" />
        <span class="thinking-dot d3" aria-hidden="true" />
      </template>
    </div>

    <div
      v-if="phase === 'working'"
      class="w-full rounded-xl border border-emerald-200/90 bg-white px-4 py-3.5 shadow-sm"
      data-testid="writing-studio-loading-bar"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-start gap-3">
        <UIcon
          name="material-symbols:progress-activity"
          class="mt-0.5 h-7 w-7 shrink-0 animate-spin text-emerald-500"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-slate-900">
            {{ loadingTitle }}
          </p>
          <p class="mt-0.5 text-xs leading-relaxed text-slate-600">
            {{ loadingSubline }}
          </p>
        </div>
      </div>
    </div>

    <ul
      v-if="activities.length > 0"
      class="w-full space-y-1.5 rounded-xl border border-emerald-100 bg-white/80 px-3 py-2.5 text-left shadow-sm"
      data-testid="writing-studio-workflow-activities"
    >
      <li
        v-for="act in activities"
        :key="act.id"
        class="flex items-center gap-2 text-[11px] text-slate-600"
      >
        <UIcon
          v-if="act.status === 'running'"
          name="material-symbols:progress-activity"
          class="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-500"
        />
        <UIcon
          v-else-if="act.status === 'failed'"
          name="material-symbols:error-outline"
          class="h-3.5 w-3.5 shrink-0 text-rose-500"
        />
        <UIcon
          v-else
          name="material-symbols:check-circle"
          class="h-3.5 w-3.5 shrink-0 text-emerald-500"
        />
        <span>{{ formatAdkToolActivityDisplay(act.name, act.status) }}</span>
      </li>
    </ul>

    <div
      v-if="phase === 'complete'"
      class="w-full space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-4 text-left text-sm leading-relaxed text-slate-700 sm:px-5"
      data-testid="writing-studio-workflow-result"
    >
      <EnMarkdown
        v-if="resultBodyMarkdown"
        :markdown-text="resultBodyMarkdown"
        variant="default"
        compact
        class="text-left text-[13px] text-slate-800 sm:text-sm"
      />
      <p
        v-if="resultBodyMarkdown"
        class="text-center text-xs font-medium text-emerald-900 sm:text-sm"
      >
        下の入力結果から各項目をコピーできます
      </p>
    </div>

    <div
      v-if="phase === 'failed' && resultText"
      class="w-full rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3 text-left text-sm text-rose-800"
      data-testid="writing-studio-workflow-error"
    >
      {{ resultText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EnMarkdown from "@components/EnMarkdown.vue";
import {
  formatAdkToolActivityDisplay,
  type AgentSseActivity,
} from "@utils/adkToolActivities";

const appearance = useAppAppearance();

const props = withDefaults(
  defineProps<{
    phase: "working" | "complete" | "failed";
    workflowAction?: "extract_schema" | "generate_document" | null;
    statusText?: string;
    resultText?: string;
    resultBodyMarkdown?: string;
    activities?: AgentSseActivity[];
  }>(),
  {
    workflowAction: null,
    statusText: undefined,
    resultText: undefined,
    resultBodyMarkdown: undefined,
    activities: () => [],
  }
);

const loadingTitle = computed((): string => {
  if (props.workflowAction === "extract_schema") {
    return "フォーマットを抽出しています…";
  }
  if (props.workflowAction === "generate_document") {
    return "文章を生成しています…";
  }
  return props.statusText ?? "処理しています…";
});

const loadingSubline = computed((): string => {
  if (props.workflowAction === "extract_schema") {
    return "参考資料から入力項目を読み取っています。完了までしばらくお待ちください。";
  }
  if (props.workflowAction === "generate_document") {
    return "社内ナレッジを検索しながら各項目を自動入力しています。完了までしばらくお待ちください。";
  }
  return "完了までしばらくお待ちください。";
});

const headline = computed((): string => {
  if (props.phase === "working") return loadingTitle.value;
  if (props.phase === "complete") return "生成が完了しました";
  return "処理に失敗しました";
});

const subline = computed((): string | undefined => {
  if (props.phase === "working") return loadingSubline.value;
  if (props.phase === "complete") {
    return "入力結果を確認し、必要に応じてコピーしてください";
  }
  if (props.phase === "failed") {
    return "内容を確認して、もう一度お試しください";
  }
  return undefined;
});
</script>

<style scoped>
.speech-bubble {
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.02));
}

.bubble-tail {
  position: absolute;
  left: 50%;
  bottom: -10px;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 12px solid white;
}

.penguin-img {
  will-change: transform;
}

.penguin-bobbing {
  animation: penguin-bob 3.6s ease-in-out infinite;
}

.penguin-thinking {
  animation: penguin-think 2.4s ease-in-out infinite;
}

@keyframes penguin-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-1.5deg);
  }
  50% {
    transform: translateY(-8px) rotate(1.5deg);
  }
}

@keyframes penguin-think {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-4px) scale(1.02);
  }
}

.penguin-shadow {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 96px;
  height: 12px;
  background: radial-gradient(
    ellipse,
    rgba(16, 185, 129, 0.28) 0%,
    transparent 70%
  );
  border-radius: 50%;
  filter: blur(4px);
}

.thinking-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
  opacity: 0.85;
  animation: dot-float 1.8s ease-in-out infinite;
}

.thinking-dot.d1 {
  top: 8px;
  right: -4px;
  animation-delay: 0s;
}

.thinking-dot.d2 {
  top: 20px;
  right: -14px;
  animation-delay: 0.25s;
}

.thinking-dot.d3 {
  top: 32px;
  right: -6px;
  animation-delay: 0.5s;
}

@keyframes dot-float {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-6px);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .penguin-img,
  .thinking-dot {
    animation: none;
  }
}
</style>
