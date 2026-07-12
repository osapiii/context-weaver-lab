<template>
  <div class="slides-penguin flex flex-col items-center gap-3 select-none">
    <!-- 吹き出し -->
    <div class="relative w-full max-w-[280px]">
      <Transition name="bubble" mode="out-in">
        <div
          :key="currentLine"
          class="speech-bubble relative bg-white rounded-2xl px-4 py-3 ring-1 ring-purple-200 shadow-[0_6px_20px_-6px_rgba(139,92,246,0.28)]"
        >
          <p
            class="whitespace-pre-line text-center text-[13px] font-medium leading-relaxed text-neutral-800"
          >
            {{ currentLine }}
          </p>
          <span class="bubble-tail" aria-hidden="true" />
        </div>
      </Transition>
    </div>

    <!-- マスコット本体 -->
    <div class="penguin-body relative">
      <!-- 地面の影 -->
      <div class="penguin-shadow" aria-hidden="true" />
      <NuxtImg
        src="/en-ai-avatar-violet.png"
        alt="リサーチ AI バディ"
        class="penguin-img relative z-10 h-28 w-28 object-contain"
        :class="{
          'penguin-bobbing': !isBusy,
          'penguin-thinking': isBusy,
        }"
      />
      <!-- きらめき (sparkle badge: 既存 AI Chat と同じテイスト) -->
      <div
        class="absolute right-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-purple-400 shadow-sm"
        :class="{ 'animate-pulse': !isBusy, 'animate-spin-slow': isBusy }"
      >
        <UIcon
          :name="isBusy ? 'i-heroicons-magnifying-glass' : 'i-heroicons-sparkles'"
          class="h-3 w-3 text-white"
        />
      </div>

      <!-- 思考中スパークル -->
      <template v-if="isBusy">
        <span class="thinking-dot d1" aria-hidden="true" />
        <span class="thinking-dot d2" aria-hidden="true" />
        <span class="thinking-dot d3" aria-hidden="true" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    isStreaming?: boolean;
    isAutoResponding?: boolean;
    autoMode?: boolean;
  }>(),
  {
    isStreaming: false,
    isAutoResponding: false,
    autoMode: false,
  },
);

const isBusy = computed(() => props.isStreaming || props.isAutoResponding);

const idleLines = [
  "テーマだけ教えて〜!\n全力でリサーチするよ",
  "勉強会? 経営会議?\nどんな資料でもおまかせ!",
  "Web をぐるぐる探検して\nスライドにまとめるよ",
  "ふむふむ、\n何を調べようかな…",
  "PEST 分析でも市場調査でも\nなんでも来い!",
];

const streamingLines = [
  "もぐもぐ…\n情報を集めてる!",
  "Web をパタパタ探索中…",
  "うーん、これは面白い…",
  "ちょっと待ってね、\n考え中!",
];

const autoLines = [
  "自動モード、フル稼働!",
  "ぐいぐい進めるよ〜",
  "次のフェーズに行くよ!",
];

const idleIndex = ref(0);
const streamingIndex = ref(0);
const autoIndex = ref(0);

const currentLine = computed(() => {
  if (props.isAutoResponding) {
    return autoLines[autoIndex.value % autoLines.length];
  }
  if (props.isStreaming) {
    return streamingLines[streamingIndex.value % streamingLines.length];
  }
  return idleLines[idleIndex.value % idleLines.length];
});

let intervalId: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  intervalId = setInterval(() => {
    if (props.isAutoResponding) autoIndex.value += 1;
    else if (props.isStreaming) streamingIndex.value += 1;
    else idleIndex.value += 1;
  }, 4500);
});
onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId);
});
</script>

<style scoped>
/* 吹き出し */
.speech-bubble {
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.02));
}
.bubble-tail {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid white;
}

/* ペンギン */
.penguin-img {
  will-change: transform;
}
.penguin-bobbing {
  animation: penguin-bob 3.6s ease-in-out infinite;
}
@keyframes penguin-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-1.5deg);
  }
  50% {
    transform: translateY(-6px) rotate(1.5deg);
  }
}
.penguin-thinking {
  animation: penguin-think 1.1s ease-in-out infinite;
}
@keyframes penguin-think {
  0%,
  100% {
    transform: translateY(0) scale(1) rotate(-2deg);
  }
  50% {
    transform: translateY(-4px) scale(1.03) rotate(2deg);
  }
}

/* 影 */
.penguin-shadow {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 72px;
  height: 10px;
  background: radial-gradient(
    ellipse,
    rgba(168, 85, 247, 0.22) 0%,
    transparent 70%
  );
  border-radius: 50%;
  filter: blur(4px);
  animation: shadow-pulse 3.6s ease-in-out infinite;
}
@keyframes shadow-pulse {
  0%,
  100% {
    width: 72px;
    opacity: 0.7;
  }
  50% {
    width: 56px;
    opacity: 0.4;
  }
}

/* sparkle badge のゆっくり回転 */
.animate-spin-slow {
  animation: spin-slow 2.4s linear infinite;
}
@keyframes spin-slow {
  to {
    transform: rotate(360deg);
  }
}

/* 思考中のドット (頭上の ... 表現) */
.thinking-dot {
  position: absolute;
  top: -6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(251 191 36); /* purple-400 */
  opacity: 0;
  animation: thinking-pop 1.8s ease-in-out infinite;
  z-index: 15;
}
.d1 {
  left: calc(50% - 16px);
  animation-delay: 0s;
}
.d2 {
  left: calc(50% - 3px);
  animation-delay: 0.25s;
}
.d3 {
  left: calc(50% + 10px);
  animation-delay: 0.5s;
}
@keyframes thinking-pop {
  0%,
  100% {
    opacity: 0;
    transform: translateY(2px) scale(0.6);
  }
  30%,
  60% {
    opacity: 1;
    transform: translateY(-4px) scale(1);
  }
}

/* 吹き出し transition */
.bubble-enter-active,
.bubble-leave-active {
  transition:
    opacity 280ms ease,
    transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.bubble-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.92);
}
.bubble-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .penguin-bobbing,
  .penguin-thinking,
  .penguin-shadow,
  .animate-spin-slow,
  .thinking-dot,
  .bubble-enter-active,
  .bubble-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
