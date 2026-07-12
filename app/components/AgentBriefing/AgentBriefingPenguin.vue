<template>
  <div class="briefing-penguin flex flex-col items-center gap-3 select-none">
    <!-- 吹き出し: step に応じてセリフを切替 -->
    <div class="relative w-full max-w-[280px]">
      <Transition name="bubble" mode="out-in">
        <div
          :key="currentLine"
          class="speech-bubble relative rounded-2xl bg-white px-4 py-2.5 ring-1"
          :class="accentClasses.bubble"
        >
          <p
            class="whitespace-pre-line text-center text-[13px] font-semibold leading-snug text-neutral-800"
            aria-live="polite"
          >
            {{ currentLine }}
          </p>
          <span class="bubble-tail" aria-hidden="true" />
        </div>
      </Transition>
    </div>

    <!-- マスコット本体 (脇役サイズ) -->
    <div
      class="penguin-body relative"
      :style="{ '--penguin-shadow-color': accentClasses.shadow }"
    >
      <div class="penguin-shadow" aria-hidden="true" />
      <NuxtImg
        :src="imageSrc"
        :alt="altText"
        class="penguin-img relative z-10 h-36 w-36 object-contain"
        :class="[isJumping ? 'penguin-jumping' : 'penguin-bobbing']"
        :style="{ filter: `drop-shadow(0 6px 12px ${accentClasses.shadow})` }"
      />

      <!-- きらめき badge -->
      <div
        class="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full shadow-md"
        :class="accentClasses.sparkle"
      >
        <UIcon
          name="i-heroicons-sparkles"
          class="h-3.5 w-3.5 animate-pulse text-white"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 汎用 briefing マスコット.
 *
 * BriefingFlowConfig.mascot.linesByStep に渡したセリフ群を、step ごとに
 * 5 秒間隔でローテーション表示する. step が変わるたびにセリフは index 0 に戻る.
 * 親が `triggerJump()` を呼ぶと小ジャンプアニメする (defineExpose).
 *
 * 元は SlidesAgentBriefingPenguin.vue (PR #76 で削除) を、特定ジョブ非依存に
 * 汎用化したもの。デフォルト画像は ENOSTECH Violet アバター。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

type PenguinAccent = "purple" | "emerald" | "sky" | "violet";

const props = withDefaults(
  defineProps<{
    /** 現在の step (1-indexed). linesByStep のキーと整合させる. */
    step: number;
    /** step ごとのセリフ配列. キーは step 番号. */
    linesByStep: Record<number, string[]>;
    /** マスコット画像 URL (public 配下の絶対パス). */
    imageSrc?: string;
    /** alt テキスト. */
    altText?: string;
    /** 吹き出し・きらめき・影のアクセント色. */
    accent?: PenguinAccent;
  }>(),
  {
    imageSrc: "/en-ai-avatar-violet.png",
    altText: "AI バディ",
    accent: "purple",
  }
);

const ACCENT_CLASSES = {
  purple: {
    bubble:
      "ring-purple-200 shadow-[0_6px_20px_-8px_rgba(139,92,246,0.35)]",
    sparkle: "bg-purple-400",
    shadow: "rgba(168, 85, 247, 0.18)",
  },
  emerald: {
    bubble:
      "ring-emerald-200 shadow-[0_6px_20px_-8px_rgba(16,185,129,0.35)]",
    sparkle: "bg-emerald-500",
    shadow: "rgba(16, 185, 129, 0.18)",
  },
  sky: {
    bubble:
      "ring-sky-200 shadow-[0_6px_20px_-8px_rgba(14,165,233,0.35)]",
    sparkle: "bg-sky-500",
    shadow: "rgba(14, 165, 233, 0.18)",
  },
  violet: {
    bubble:
      "ring-violet-200 shadow-[0_6px_20px_-8px_rgba(139,92,246,0.35)]",
    sparkle: "bg-violet-500",
    shadow: "rgba(139, 92, 246, 0.18)",
  },
} as const;

const accentClasses = computed(() => ACCENT_CLASSES[props.accent]);

const lineIndex = ref(0);

const currentLine = computed(() => {
  const lines = props.linesByStep[props.step];
  if (!lines || lines.length === 0) return "";
  return lines[lineIndex.value % lines.length];
});

// セリフを 5 秒ごとにローテーション
let rotationId: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  rotationId = setInterval(() => {
    lineIndex.value += 1;
  }, 5000);
});
onBeforeUnmount(() => {
  if (rotationId) clearInterval(rotationId);
});

// step が変わったらセリフを 0 番目から
watch(
  () => props.step,
  () => {
    lineIndex.value = 0;
  }
);

// 親から triggerJump() を呼ぶと小ジャンプ
const isJumping = ref(false);
const triggerJump = () => {
  if (isJumping.value) return;
  isJumping.value = true;
  setTimeout(() => {
    isJumping.value = false;
  }, 600);
};

defineExpose({ triggerJump });
</script>

<style scoped>
.speech-bubble {
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.02));
}
.bubble-tail {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 12px solid white;
}

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
    transform: translateY(-10px) rotate(1.5deg);
  }
}

.penguin-jumping {
  animation: penguin-jump 650ms cubic-bezier(0.34, 1.56, 0.64, 1) 1;
}
@keyframes penguin-jump {
  0% {
    transform: translateY(0) scale(1, 1);
  }
  20% {
    transform: translateY(-28px) scale(0.95, 1.08);
  }
  50% {
    transform: translateY(-44px) scale(1.05, 0.95);
  }
  80% {
    transform: translateY(-12px) scale(1, 1);
  }
  100% {
    transform: translateY(0) scale(1, 1);
  }
}

.penguin-shadow {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 96px;
  height: 12px;
  background: radial-gradient(
    ellipse,
    var(--penguin-shadow-color) 0%,
    transparent 70%
  );
  border-radius: 50%;
  filter: blur(5px);
  animation: shadow-pulse 3.6s ease-in-out infinite;
}
@keyframes shadow-pulse {
  0%,
  100% {
    width: 96px;
    opacity: 0.7;
  }
  50% {
    width: 70px;
    opacity: 0.4;
  }
}

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
  .penguin-jumping,
  .penguin-shadow,
  .bubble-enter-active,
  .bubble-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
