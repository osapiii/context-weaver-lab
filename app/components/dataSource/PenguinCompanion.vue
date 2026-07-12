<template>
  <div class="penguin-companion flex flex-col items-center gap-3 select-none">
    <!-- 吹き出し (上) -->
    <div class="relative w-full max-w-[220px]">
      <Transition name="bubble" mode="out-in">
        <div
          :key="currentLine"
          class="speech-bubble relative bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 ring-1 ring-emerald-100 dark:ring-emerald-900/40 shadow-[0_4px_16px_-4px_rgba(16,185,129,0.16)]"
        >
          <p class="text-[13px] leading-relaxed text-gray-800 dark:text-gray-100 text-center">
            {{ currentLine }}
          </p>
          <!-- 三角の tail (下向き) -->
          <span class="bubble-tail" aria-hidden="true" />
        </div>
      </Transition>
    </div>

    <!-- AI バディ本体 (下、ふわふわ揺れる) -->
    <div class="penguin-body relative">
      <!-- 影 (地面に落ちる楕円) -->
      <div class="penguin-shadow" aria-hidden="true" />
      <NuxtImg
        :src="companionImageSrc"
        alt="StoryVault コンパニオン"
        class="penguin-img w-32 h-32 object-contain relative z-10"
        :class="{ 'penguin-bobbing': !isUploading, 'penguin-eating': isUploading }"
      />
    </div>

    <!-- 会話スタート CTA -->
    <EnButton
      variant="hero"
      color="primary"
      size="md"
      leading-icon="i-heroicons-chat-bubble-left-right"
      @click="$emit('start-conversation')"
    >
      会話スタート
    </EnButton>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import EnButton from "@components/EnButton.vue";

const props = withDefaults(
  defineProps<{
    documentCount: number;
    isDragging: boolean;
    isUploading: boolean;
    /** AI に索引済みの件数 (= 本当に「覚えた」もの)。未指定なら documentCount を使う */
    indexedCount?: number;
  }>(),
  { indexedCount: undefined }
);

defineEmits<{
  /** AI バディ下の「会話スタート」ボタンが押された */
  (e: "start-conversation"): void;
}>();

// === セリフ集 ===
// 状態に応じて切替。idle 時は randomLines を 6 秒ごと回転。
// 「覚えた」のソースは indexedCount を優先 (画像など対象外を含まない)
const masteredCount = computed(() =>
  props.indexedCount != null ? props.indexedCount : props.documentCount
);

const companionImageSrc = computed(() =>
  props.isUploading ? "/storyvault-hamster-running.gif" : "/storyvault-hamster-idle.png"
);

const idleLines = computed<string[]>(() => {
  const c = masteredCount.value;
  if (c === 0) {
    return [
      "まだ何も知らないよ〜\n何か教えて!",
      "お腹すいた…\nファイルくれー",
      "学ぶ準備バッチリ!",
      "どんと来い、なんでも覚えるよ",
    ];
  }
  return [
    `今 ${c} 件 覚えてるよ`,
    "もっと教えてもいいよ?",
    `${c} 件マスターした`,
    "賢くなってきた気がする",
    "次は何を覚えようかな",
  ];
});

const draggingLine = "そのまま離して〜!";
const uploadingLine = "もぐもぐ… 覚えてる最中!";
const justDroppedLine = "ありがとう!ちゃんと覚えたよ!";

const justDropped = ref(false);
const idleIndex = ref(0);

const currentLine = computed(() => {
  if (justDropped.value) return justDroppedLine;
  if (props.isUploading) return uploadingLine;
  if (props.isDragging) return draggingLine;
  const lines = idleLines.value;
  return lines[idleIndex.value % lines.length] ?? lines[0];
});

// idle セリフを 5.5 秒ごとに切替
let intervalId: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  intervalId = setInterval(() => {
    if (!props.isDragging && !props.isUploading && !justDropped.value) {
      idleIndex.value = (idleIndex.value + 1) % idleLines.value.length;
    }
  }, 5500);
});
onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId);
});

// upload 完了 (isUploading が true → false に変化) を検知して "ありがとう" を一時表示
watch(
  () => props.isUploading,
  (now, prev) => {
    if (prev === true && now === false) {
      justDropped.value = true;
      setTimeout(() => {
        justDropped.value = false;
      }, 3200);
    }
  }
);
</script>

<style scoped>
/* === 吹き出し === */
.speech-bubble {
  /* 軽い 3D 感 */
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
:global(.dark) .bubble-tail {
  border-top-color: rgb(31 41 55); /* gray-800 */
}

/* === ペンギン === */
.penguin-img {
  /* GPU 合成で滑らかに */
  will-change: transform;
}

/* idle 時: ふわふわ上下 */
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

/* upload 中: もぐもぐ (細かく揺れる) */
.penguin-eating {
  animation: penguin-eat 0.6s ease-in-out infinite;
}
@keyframes penguin-eat {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-3px) scale(1.04);
  }
}

/* 影 */
.penguin-shadow {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 12px;
  background: radial-gradient(
    ellipse,
    rgba(16,185,129, 0.16) 0%,
    transparent 70%
  );
  border-radius: 50%;
  filter: blur(4px);
  animation: shadow-pulse 3.6s ease-in-out infinite;
}
@keyframes shadow-pulse {
  0%,
  100% {
    width: 80px;
    opacity: 0.7;
  }
  50% {
    width: 64px;
    opacity: 0.4;
  }
}

/* === 吹き出しの transition === */
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
  .penguin-eating,
  .penguin-shadow,
  .bubble-enter-active,
  .bubble-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
