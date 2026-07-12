<template>
  <section
    class="hero-card relative bg-white rounded-2xl ring-1 ring-neutral-200 shadow-md p-5 sm:p-7"
  >
    <div class="grid grid-cols-12 gap-5 lg:gap-6 items-stretch">
      <!-- 左: ヒアリング + 入力 -->
      <div class="col-span-12 lg:col-span-9 flex flex-col min-w-0">
        <header class="mb-4">
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 ring-1 ring-primary-200 text-[10px] font-extrabold uppercase tracking-wider text-primary-700"
            >
              <UIcon
                name="material-symbols:auto-awesome"
                class="w-3 h-3"
              />
              AI 部下
            </span>
            <h2
              class="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900"
            >
              <span class="mr-1">{{ greetingEmoji }}</span>
              <span>{{ greetingText }}、今日はどうしますか?</span>
            </h2>
          </div>
          <p class="text-sm text-neutral-500 mt-2 leading-snug">
            ざっくりで OK。AI バディが受け取って、次にやれることを 3 つくらい教えてくれます。
          </p>
        </header>

        <div
          class="hero-input relative flex-1 flex flex-col rounded-xl bg-neutral-50 ring-1 ring-neutral-200 px-4 py-3 focus-within:ring-primary-400 focus-within:bg-white transition-colors"
        >
          <textarea
            ref="textareaEl"
            v-model="text"
            rows="3"
            :placeholder="placeholder"
            class="hero-textarea flex-1 resize-none bg-transparent text-base sm:text-lg leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            :disabled="store.isStreaming"
            @keydown="onKeydown"
          />

          <div
            class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-neutral-200 items-center"
          >
            <span
              class="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 flex items-center gap-1 pr-1"
            >
              <UIcon
                name="material-symbols:lightbulb-outline-rounded"
                class="w-3.5 h-3.5"
              />
              よくある相談
            </span>
            <button
              v-for="sample in samples"
              :key="sample.key"
              type="button"
              class="sample-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-white ring-1 ring-neutral-300 text-neutral-700 hover:ring-primary-400 hover:text-primary-700 hover:bg-primary-50/40 transition-colors"
              :disabled="store.isStreaming"
              @click="onSampleClick(sample)"
            >
              <UIcon :name="sample.icon" class="w-3.5 h-3.5" />
              {{ sample.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右: AI バディ + 送信 CTA -->
      <aside
        class="col-span-12 lg:col-span-3 flex lg:flex-col gap-3 items-stretch"
      >
        <div
          class="penguin-stage relative flex-1 flex items-end justify-center bg-neutral-50 rounded-xl ring-1 ring-neutral-200 py-5 overflow-hidden min-h-[160px]"
        >
          <span class="speech-bubble">{{ bubbleText }}</span>
          <div
            :class="[
              'penguin-figure',
              isLaunching ? 'jump' : 'bob',
            ]"
          >
            <NuxtImg
              :src="appearance.aiAvatarUrl.value"
              alt="AI バディ"
              class="w-24 h-24 object-contain"
            />
          </div>
          <span class="penguin-shadow" aria-hidden="true" />
        </div>

        <div class="flex flex-col gap-2 min-w-[160px] lg:min-w-0">
          <button
            type="button"
            :disabled="!canSubmit"
            :class="[
              'w-full px-4 py-3 rounded-xl text-base font-extrabold tracking-tight transition-colors shadow-sm',
              canSubmit
                ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed',
            ]"
            @click="handleSubmit"
          >
            <span class="inline-flex items-center justify-center gap-2 flex-wrap">
              <UIcon
                name="material-symbols:send-rounded"
                class="w-5 h-5"
              />
              <span>AI に依頼</span>
              <span class="inline-flex items-center gap-1">
                <UKbd
                  :value="isMac ? 'meta' : 'ctrl'"
                  size="sm"
                  variant="subtle"
                />
                <UKbd value="enter" size="sm" variant="subtle" />
              </span>
            </span>
          </button>
        </div>
      </aside>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useEnAiStudioAssistantStore } from "@stores/enAiStudioAssistant";

type Sample = {
  key: string;
  label: string;
  icon: string;
  prompt: string;
};

const store = useEnAiStudioAssistantStore();
const appearance = useAppAppearance();

const text = ref("");
const textareaEl = ref<HTMLTextAreaElement | null>(null);
const isLaunching = ref(false);

// ─── 時間帯挨拶 (時刻表示はヘッダの HeaderLiveClock 側で常駐) ──────────
// 挨拶は時間帯 (朝/昼/夕/夜) だけで決まるので、マウント時の Date だけ見れば十分.
const initialHour = new Date().getHours();
const greetingText = computed(() => {
  if (initialHour >= 5 && initialHour < 10) return "おはようございます";
  if (initialHour >= 10 && initialHour < 18) return "こんにちは";
  return "こんばんは";
});
const greetingEmoji = computed(() => {
  if (initialHour >= 5 && initialHour < 10) return "☀️";
  if (initialHour >= 10 && initialHour < 15) return "🌤️";
  if (initialHour >= 15 && initialHour < 18) return "🌇";
  return "🌙";
});

const isMac = computed(() =>
  typeof navigator !== "undefined"
    ? /Mac|iPhone|iPad/.test(navigator.platform)
    : false
);

// プレースホルダ: 数秒ごとに 3 例文を rotate
const PLACEHOLDER_EXAMPLES = [
  "例: 来月の施策計画を整理したい。目的と制約を見て、無理がないか診てほしい。",
  "例: 社内ナレッジが散らばっている。優先して整えるべき資料を洗い出したい。",
  "例: 補助金を使って AI 導入したい。何から手をつけたら良い?",
  "例: 今月のタスクが多い。優先順位を一緒に決めて。",
];
const placeholderIdx = ref(0);
const placeholder = computed(
  () => PLACEHOLDER_EXAMPLES[placeholderIdx.value % PLACEHOLDER_EXAMPLES.length]
);
let placeholderTimer: ReturnType<typeof setInterval> | null = null;

const samples = computed<Sample[]>(() => [
  {
    key: "plan",
    label: "施策計画を組み立てたい",
    icon: "material-symbols:event-note-outline-rounded",
    prompt:
      "来月の施策計画を立てたい。目的・制約・関係者を踏まえて、無理が出ない計画案を一緒に考えて。",
  },
  {
    key: "master",
    label: "ナレッジを整えたい",
    icon: "material-symbols:edit-document-outline-rounded",
    prompt:
      "社内ナレッジが最新か怪しい。どこを直すべきか、優先順を教えて。",
  },
  {
    key: "research",
    label: "テーマを調べてもらう",
    icon: "material-symbols:menu-book-outline-rounded",
    prompt:
      "AI に最新トレンドを調べてスライドにまとめさせたい。テーマはこれから決めるので、何を準備すれば良い?",
  },
  {
    key: "consult",
    label: "経営課題を相談",
    icon: "material-symbols:trending-up-rounded",
    prompt:
      "売上が伸び悩んでいる。マスタの数値と稼働実績を見ながら、ボトルネックを一緒に整理して。",
  },
]);

const canSubmit = computed(
  () => !store.isStreaming && text.value.trim().length > 0
);

const bubbleText = computed(() => {
  if (store.isStreaming) return "考えています…";
  if (canSubmit.value) return "いいね、まかせて!";
  return "ふむふむ?";
});

const onSampleClick = (sample: Sample) => {
  text.value = sample.prompt;
  void Promise.resolve().then(() => {
    if (textareaEl.value) {
      textareaEl.value.focus();
      const len = textareaEl.value.value.length;
      textareaEl.value.setSelectionRange(len, len);
    }
  });
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    handleSubmit();
  }
};

const handleSubmit = () => {
  if (!canSubmit.value) return;
  isLaunching.value = true;
  setTimeout(() => {
    store.openWithPrompt(text.value.trim(), { autoSend: true });
    isLaunching.value = false;
    text.value = "";
  }, 360);
};

onMounted(() => {
  placeholderTimer = setInterval(() => {
    placeholderIdx.value =
      (placeholderIdx.value + 1) % PLACEHOLDER_EXAMPLES.length;
  }, 4500);
});
onUnmounted(() => {
  if (placeholderTimer) clearInterval(placeholderTimer);
});
</script>

<style scoped>
.hero-card {
  /* モダン入口: 紙の付箋系と差別化するためフラットな白カード.
     微回転 / 紙質感 / マスキングテープを意図的に持たない. */
}
.hero-textarea {
  font-family:
    "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Helvetica Neue", sans-serif;
  min-height: 5.5rem;
}

/* ペンギン舞台 — neutral, 装飾無し */
.penguin-figure {
  position: relative;
  z-index: 2;
  will-change: transform;
}
.penguin-figure.bob {
  animation: penguin-bob 3.6s ease-in-out infinite;
}
@keyframes penguin-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-4px) rotate(2deg);
  }
}
.penguin-figure.jump {
  animation: penguin-jump 360ms ease-out;
}
@keyframes penguin-jump {
  0% {
    transform: translateY(0) rotate(0deg);
  }
  40% {
    transform: translateY(-26px) rotate(-6deg);
  }
  70% {
    transform: translateY(-10px) rotate(3deg);
  }
  100% {
    transform: translateY(0) rotate(0deg);
  }
}
.penguin-shadow {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: 55%;
  height: 7px;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.14) 0%,
    rgba(0, 0, 0, 0) 70%
  );
  z-index: 1;
}
.speech-bubble {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 700;
  color: #404040; /* neutral-700 */
  background: #fff;
  border: 1px solid #e5e5e5; /* neutral-200 */
  border-radius: 999px;
  padding: 4px 10px;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  z-index: 3;
}
.speech-bubble::after {
  content: "";
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  background: #fff;
  border-right: 1px solid #e5e5e5;
  border-bottom: 1px solid #e5e5e5;
  transform: translateX(-50%) rotate(45deg);
}

@media (prefers-reduced-motion: reduce) {
  .penguin-figure,
  .penguin-figure.bob,
  .penguin-figure.jump {
    animation: none !important;
    transform: none;
  }
}
</style>
