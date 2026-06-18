<template>
  <div
    class="research-studio-workflow-center mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-3 py-4 sm:max-w-3xl sm:px-4"
    data-testid="research-studio-workflow-center"
  >
    <div
      v-if="notificationEmail"
      class="w-full rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-center text-sm text-sky-900"
    >
      <p class="font-semibold">リサーチを受け付けました</p>
      <p class="mt-1 text-xs leading-relaxed text-sky-800/90">
        完了したら <strong>{{ notificationEmail }}</strong> にメールでお知らせします。
        この画面を閉じても問題ありません。
      </p>
    </div>

    <div class="relative w-fit max-w-full">
      <div
        class="speech-bubble relative w-fit max-w-full rounded-2xl bg-white px-4 py-3 ring-1 shadow-[0_6px_20px_-8px_rgba(71,85,105,0.24)]"
        :class="
          phase === 'failed'
            ? 'ring-rose-200'
            : phase === 'complete'
              ? 'ring-emerald-200'
              : 'ring-slate-300'
        "
      >
        <p
          class="whitespace-pre-line text-center text-sm font-semibold leading-snug"
          :class="
            phase === 'failed'
              ? 'text-rose-800'
              : phase === 'complete'
                ? 'text-emerald-900'
                : 'text-neutral-800'
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
        alt="リサーチ AI"
        class="penguin-img relative z-10 h-32 w-32 object-contain sm:h-36 sm:w-36"
        :class="phase === 'working' ? 'penguin-thinking' : 'penguin-bobbing'"
      />
    </div>

    <ResearchAgentTerminalLog
      v-if="phase === 'working'"
      class="w-full"
    />

    <div
      v-if="phase === 'failed'"
      class="w-full rounded-xl border border-rose-100 bg-rose-50/80 px-4 py-4 text-center text-sm text-rose-900"
    >
      <p class="font-semibold">リサーチ生成でエラーが発生しました</p>
      <p
        v-if="store.lastError"
        class="mt-2 whitespace-pre-wrap text-left text-xs leading-relaxed text-rose-800"
      >
        {{ store.lastError }}
      </p>
    </div>

    <div
      v-if="phase === 'complete'"
      class="w-full rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-4 text-center text-sm text-emerald-900"
    >
      <p class="font-semibold">リサーチレポートが完成しました</p>
      <p class="mt-1 text-xs text-emerald-800/90">
        右の <span class="font-bold">ファイル出力</span> から research.html をプレビューできます。
      </p>
    </div>

    <div
      v-if="notificationEmail && phase === 'working'"
      class="flex w-full flex-col gap-2 sm:flex-row sm:justify-center"
    >
      <EnButton
        variant="solid"
        color="primary"
        size="sm"
        leading-icon="material-symbols:home"
        data-testid="research-submitted-back-hub"
        @click="emit('back-to-hub')"
      >
        AIスタジオ一覧に戻る
      </EnButton>
      <EnButton
        variant="outline"
        color="neutral"
        size="sm"
        leading-icon="material-symbols:add"
        data-testid="research-submitted-new"
        @click="emit('new-research')"
      >
        別のリサーチを依頼
      </EnButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ResearchAgentTerminalLog from "@components/ResearchAgentTerminalLog.vue";
import EnButton from "@components/EnButton.vue";
import { useResearchAgentStore } from "@stores/researchAgent";

const props = defineProps<{
  phase: "working" | "complete" | "failed";
  notificationEmail?: string;
}>();

const emit = defineEmits<{
  (e: "back-to-hub" | "new-research"): void;
}>();

const appearance = useAppAppearance();
const store = useResearchAgentStore();

const latestLogMessage = computed((): string | null => {
  const lastJob = store.jobLog.at(-1);
  if (lastJob && typeof lastJob.message === "string" && lastJob.message.trim()) {
    return lastJob.message.trim();
  }
  const lastProgress = store.progressHistory.at(-1);
  if (lastProgress) {
    if (typeof lastProgress.note === "string" && lastProgress.note.trim()) {
      return lastProgress.note.trim();
    }
    if (typeof lastProgress.message === "string" && lastProgress.message.trim()) {
      return lastProgress.message.trim();
    }
  }
  return null;
});

const headline = computed((): string => {
  if (props.phase === "complete") return "リサーチ完了！";
  if (props.phase === "failed") return "エラーが発生しました";
  if (latestLogMessage.value) return latestLogMessage.value;
  if (props.notificationEmail) return "バックグラウンドでレポートを生成中…";
  return "リサーチを生成しています…";
});

const subline = computed((): string | undefined => {
  if (props.phase !== "working") return undefined;
  return "組織ナレッジと Web 情報を統合してレポートを組み立てています。";
});
</script>

<style scoped>
.penguin-body {
  position: relative;
}
.penguin-shadow {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 72px;
  height: 10px;
  background: radial-gradient(
    ellipse,
    rgba(168, 85, 247, 0.28) 0%,
    transparent 70%
  );
  border-radius: 50%;
  filter: blur(4px);
}
.penguin-bobbing {
  animation: bob 2.4s ease-in-out infinite;
}
.penguin-thinking {
  animation: bob 1.2s ease-in-out infinite;
}
@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
.speech-bubble .bubble-tail {
  position: absolute;
  left: 50%;
  bottom: -6px;
  margin-left: -6px;
  width: 12px;
  height: 12px;
  rotate: 45deg;
  background: white;
}
</style>
