<template>
  <div ref="scrollContainer" class="flex-1 overflow-y-auto px-6 py-6 space-y-4">
    <!-- 初期メッセージ (AI バディ ヒーロー)
         briefing 完了直後で最初のメッセージ到着前の一瞬は表示しない (briefing からの引継ぎ感を保つため) -->
    <div
      v-if="!store.hasMessages && !store.briefingComplete"
      class="penguin-hero relative overflow-hidden rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 via-violet-50/60 to-white px-6 py-8"
    >
      <!-- 背景の柔らかい光 -->
      <div
        class="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-purple-200/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-violet-200/30 blur-3xl"
        aria-hidden="true"
      />

      <div class="relative flex flex-col items-center gap-6">
        <ResearchAgentPenguin
          :is-streaming="store.isStreaming"
          :is-auto-responding="store.isAutoResponding"
          :auto-mode="store.autoMode"
        />

        <div class="text-center">
          <h3 class="text-lg font-bold tracking-tight text-neutral-900">
            こんにちは、リサーチ AI です
          </h3>
          <p class="mt-1 text-xs text-neutral-500">
            勉強会・経営会議・顧客向けの解説スライドを自動生成します
          </p>
        </div>

        <p
          class="max-w-xl text-center text-sm leading-relaxed text-neutral-700"
        >
          テーマだけ伝えてくれれば、AI が観点をヒアリング →
          Web リサーチ → 構成設計 → PPTX 生成までを一気通貫で進めます。
        </p>

        <!-- お題チップ -->
        <div class="flex flex-wrap items-center justify-center gap-2">
          <button
            v-for="ex in examples"
            :key="ex"
            type="button"
            class="example-chip group rounded-full border border-purple-200 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-purple-700 backdrop-blur transition hover:-translate-y-0.5 hover:border-purple-400 hover:bg-purple-50 hover:shadow-md"
            @click="$emit('use-example', ex)"
          >
            <span class="mr-1">💡</span>{{ ex }}
          </button>
        </div>
      </div>
    </div>

    <!-- メッセージ一覧 (chatItems = messages + phase divider + hideAvatar)
         TransitionGroup の直接子は **必ず 1 つの要素** (chat-item-row) にする.
         <template v-for> + 動的 v-if/v-else-if だと Vue の vnode fragment 追跡が崩れて
         "Cannot read properties of null (reading 'nextSibling')" で crash する. -->
    <TransitionGroup name="msg" tag="div" class="chat-items space-y-4">
    <div
      v-for="item in chatItems"
      :key="item.kind === 'phase-divider' ? item.id : item.message.id"
      class="chat-item-row"
    >
      <!-- ━━━ Phase 境界 divider ━━━ -->
      <div
        v-if="item.kind === 'phase-divider'"
        class="phase-divider flex items-center gap-3 py-2"
      >
        <span
          class="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300 to-purple-300"
        />
        <span
          class="rounded-full bg-gradient-to-r from-purple-400 to-violet-500 px-3 py-1 text-[11px] font-bold text-white shadow-sm shadow-purple-200"
        >
          {{ item.label }}
        </span>
        <span
          class="h-px flex-1 bg-gradient-to-r from-purple-300 via-purple-300 to-transparent"
        />
      </div>

      <!-- ユーザー発話 (AI 側 violet と対比させて青系) -->
      <div
        v-else-if="item.kind === 'message' && item.message.role === 'user'"
        class="flex justify-end"
      >
        <div
          :class="[
            'user-bubble max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm',
            item.message.isAuto
              ? 'border border-sky-300 bg-sky-50/90 text-sky-900 backdrop-blur'
              : 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-200',
          ]"
        >
          <div
            v-if="item.message.isAuto"
            class="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-sky-600"
          >
            <UIcon name="material-symbols:smart-toy" class="h-3 w-3" />
            自動進行
          </div>
          <!-- ユーザー側は短文中心 + 強い背景色のため markdown 描画はせずプレーン -->
          <div class="whitespace-pre-wrap">{{ item.message.text }}</div>
        </div>
      </div>

      <!-- エージェント発話 (空 text かつストリーミング終了したものは描画しない) -->
      <div
        v-else-if="
          item.kind === 'message' &&
          item.message.role === 'agent' &&
          (item.message.text || item.message.isStreaming)
        "
        class="flex gap-3"
      >
        <!-- avatar (連続 agent 発話なら hideAvatar=true で見えない spacer に置き換え) -->
        <div
          v-if="!item.hideAvatar"
          class="relative flex-shrink-0"
        >
          <div
            class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-purple-50 to-violet-100 ring-1 ring-purple-200"
          >
            <NuxtImg
              src="/en-ai-avatar-violet.png"
              alt="リサーチ AI バディ"
              class="h-7 w-7 object-contain"
              :class="{ 'agent-avatar-bobbing': !item.message.isStreaming, 'agent-avatar-thinking': item.message.isStreaming }"
            />
          </div>
          <span
            v-if="item.message.isStreaming"
            class="absolute -right-0.5 -top-0.5 flex h-3 w-3"
            aria-hidden="true"
          >
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
            <span class="relative inline-flex h-3 w-3 rounded-full bg-purple-500" />
          </span>
        </div>
        <div v-else class="h-9 w-9 flex-shrink-0" aria-hidden="true" />

        <!-- ストリーミング中で本文未到着: 小さな pill (バブルじゃない) -->
        <div
          v-if="item.message.isStreaming && !item.message.text"
          class="thinking-pill inline-flex items-center gap-2 self-center rounded-full bg-purple-50/90 px-3 py-1.5 text-xs font-medium italic text-purple-700 ring-1 ring-purple-200 backdrop-blur"
        >
          <span class="thinking-dots inline-flex gap-1">
            <span class="thinking-dot" />
            <span class="thinking-dot" />
            <span class="thinking-dot" />
          </span>
          考えてます…
        </div>
        <!-- 本文あり: 通常のバブル (max-w-[85%] で折り返し) -->
        <div v-else class="max-w-[85%] flex-1">
          <div
            class="agent-bubble relative rounded-2xl rounded-tl-md border border-purple-100/80 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-800"
          >
            <EnMarkdown
              v-if="item.message.text"
              :markdown-text="highlightCallouts(item.message.text)"
              variant="research"
              compact
              :enable-router-links="false"
              class="agent-md"
            />
            <!-- text 受信途中の点滅カーソル -->
            <span
              v-if="item.message.isStreaming"
              class="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-purple-500 align-middle"
            />
          </div>
        </div>
      </div>

      <!-- tool 呼び出し / 結果 (コンパクトインライン表記 / agent サブツリー風インデント) -->
      <div
        v-else-if="item.kind === 'message' && item.message.role === 'tool'"
        class="flex flex-col items-start gap-1 pl-12"
      >
        <button
          type="button"
          class="tool-chip group inline-flex max-w-[85%] items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-[11px] font-medium text-neutral-600 backdrop-blur transition hover:border-purple-200 hover:bg-white hover:text-purple-700"
          :title="item.message.toolCall?.name || 'tool'"
          @click="toggleTool(item.message.id)"
        >
          <UIcon
            v-if="item.message.isStreaming"
            name="material-symbols:progress-activity"
            class="h-3 w-3 animate-spin text-purple-500"
          />
          <UIcon
            v-else
            name="material-symbols:check-circle"
            class="h-3 w-3 text-emerald-500"
          />
          <span class="font-mono">{{ item.message.toolCall?.name || "tool" }}</span>
          <span
            v-if="item.message.isStreaming"
            class="text-[10px] italic text-neutral-400"
          >実行中</span>
          <UIcon
            :name="
              expandedTools.has(item.message.id)
                ? 'material-symbols:expand-less'
                : 'material-symbols:expand-more'
            "
            class="h-3 w-3 text-neutral-400 transition-transform group-hover:text-purple-500"
          />
        </button>
        <div
          v-if="expandedTools.has(item.message.id)"
          class="w-full max-w-[85%] rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-2 text-xs backdrop-blur"
        >
          <div v-if="item.message.toolCall?.args" class="space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-neutral-500">
              args
            </div>
            <pre
              class="overflow-x-auto rounded bg-white p-2 text-[11px]"
            >{{ formatJson(item.message.toolCall.args) }}</pre>
          </div>
          <div v-if="item.message.toolResult?.response" class="mt-2 space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-neutral-500">
              result
            </div>
            <pre
              class="max-h-40 overflow-auto rounded bg-white p-2 text-[11px]"
            >{{ formatJson(item.message.toolResult.response) }}</pre>
          </div>
        </div>
      </div>
    </div>
    </TransitionGroup>

    <!-- エラー表示 -->
    <div
      v-if="store.lastError"
      class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      ⚠️ {{ store.lastError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import {
  useResearchAgentStore,
  PHASE_LABELS,
  TOOL_PHASE_MAP,
  type ResearchAgentMessage,
  type ResearchAgentPhaseKey,
} from "@stores/researchAgent";

defineEmits<{
  (e: "use-example", text: string): void;
}>();

const store = useResearchAgentStore();

const scrollContainer = ref<HTMLElement | null>(null);
const expandedTools = ref(new Set<string>());

const toggleTool = (id: string) => {
  if (expandedTools.value.has(id)) {
    expandedTools.value.delete(id);
  } else {
    expandedTools.value.add(id);
  }
};

// ─── チャット構造化 ────────────────────────────
// 旧: store.messages を v-for で平坦表示
// 新: phase divider 挿入 / avatar 折り畳み判定 を含む chatItems を組み立てる
type ChatItem =
  | {
      kind: "phase-divider";
      phaseKey: ResearchAgentPhaseKey;
      label: string;
      id: string;
    }
  | { kind: "message"; message: ResearchAgentMessage; hideAvatar: boolean };

const chatItems = computed<ChatItem[]>(() => {
  const out: ChatItem[] = [];
  let lastPhase: ResearchAgentPhaseKey | null = null;
  // 連続 agent 発話の avatar 折り畳み用に「直前が agent (本文あり) だったか」を覚える
  let prevWasAgentWithBody = false;
  for (const m of store.messages) {
    if (m.role === "tool" && m.toolCall?.name) {
      const phaseKey = TOOL_PHASE_MAP[m.toolCall.name];
      if (phaseKey && phaseKey !== lastPhase) {
        out.push({
          kind: "phase-divider",
          phaseKey,
          label: PHASE_LABELS[phaseKey],
          id: `divider-${phaseKey}-${m.id}`,
        });
        lastPhase = phaseKey;
        prevWasAgentWithBody = false;
      }
    }
    const hasBody = !!(m.text || m.isStreaming);
    const hideAvatar =
      m.role === "agent" && hasBody && prevWasAgentWithBody;
    out.push({ kind: "message", message: m, hideAvatar });
    prevWasAgentWithBody = m.role === "agent" && hasBody;
  }
  return out;
});

// agent text 中の `fatal: N件` / `warn: N件` を視覚的に強調するため、
// MarkdownRenderer に渡す前に html span に置換する.
// markdown-it は html: true で動いているのでそのまま描画される.
const highlightCallouts = (md: string): string => {
  if (!md) return md;
  return md
    .replace(/(fatal:\s*)(\d+)(\s*件?)/g, (_full, prefix, n, suffix) => {
      const num = parseInt(n, 10);
      const cls = num > 0 ? "callout-fatal" : "callout-pass";
      const icon = num > 0 ? "⚠️" : "✅";
      return `<span class="${cls}">${icon} ${prefix}${n}${suffix}</span>`;
    })
    .replace(/(warn:\s*)(\d+)(\s*件?)/g, (_full, prefix, n, suffix) => {
      const num = parseInt(n, 10);
      if (num <= 0) return `${prefix}${n}${suffix}`;
      return `<span class="callout-warn">⚠️ ${prefix}${n}${suffix}</span>`;
    });
};

const examples = [
  "中小企業における AI 活用の導入ステップ",
  "PEST 分析の基本",
  "生成 AI が業務効率化に与える影響",
  "Z 世代向けマーケティングのトレンド 2026",
];

// メッセージ追加 / ストリーム更新時に最下部へ
watch(
  () => [store.messages.length, store.messages[store.messages.length - 1]?.text],
  async () => {
    await nextTick();
    const el = scrollContainer.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
  { deep: false },
);

const formatJson = (v: unknown): string => {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};
</script>

<style scoped>
/* メッセージ追加時の fade-in + slide-up */
.msg-enter-active {
  transition:
    opacity 320ms ease,
    transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.msg-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}
.msg-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
.msg-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* === Agent bubble: subtle purple glow === */
.agent-bubble {
  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.02),
    0 4px 12px -6px rgba(168, 85, 247, 0.18);
}

/* === fatal / warn / pass callout (markdown agent text 内に inline 描画) ===
   EnMarkdown 経由でも .callout-* class はそのまま出力されるので、
   バブル内固有の見た目 (border-left 付き) はここで上書きする. */
.agent-bubble :deep(.callout-fatal) {
  display: inline-block;
  padding: 1px 8px;
  margin: 0 2px;
  border-radius: 4px;
  background: rgb(255 241 242); /* rose-50 */
  border-left: 3px solid rgb(225 29 72); /* rose-600 */
  color: rgb(159 18 57); /* rose-800 */
  font-weight: 600;
  font-size: 0.92em;
}
.agent-bubble :deep(.callout-warn) {
  display: inline-block;
  padding: 1px 8px;
  margin: 0 2px;
  border-radius: 4px;
  background: rgb(255 251 235); /* purple-50 */
  border-left: 3px solid rgb(245 158 11); /* purple-500 */
  color: rgb(146 64 14); /* purple-800 */
  font-weight: 600;
  font-size: 0.92em;
}
.agent-bubble :deep(.callout-pass) {
  display: inline-block;
  padding: 1px 8px;
  margin: 0 2px;
  border-radius: 4px;
  background: rgb(236 253 245); /* emerald-50 */
  border-left: 3px solid rgb(16 185 129); /* emerald-500 */
  color: rgb(6 95 70); /* emerald-800 */
  font-weight: 600;
  font-size: 0.92em;
}

/* === 「考えてます…」 thinking spinner (バブル外の小 pill) === */
.thinking-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgb(245 158 11), rgb(249 115 22));
  animation: thinking-bounce 1.2s ease-in-out infinite both;
}
.thinking-dot:nth-child(1) {
  animation-delay: -0.32s;
}
.thinking-dot:nth-child(2) {
  animation-delay: -0.16s;
}
.thinking-dot:nth-child(3) {
  animation-delay: 0s;
}
@keyframes thinking-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.55);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.agent-avatar-bobbing {
  animation: avatar-bob 3.2s ease-in-out infinite;
}
@keyframes avatar-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-2px) rotate(2deg);
  }
}
.agent-avatar-thinking {
  animation: avatar-think 0.9s ease-in-out infinite;
}
@keyframes avatar-think {
  0%,
  100% {
    transform: translateY(0) scale(1) rotate(-3deg);
  }
  50% {
    transform: translateY(-2px) scale(1.05) rotate(3deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .thinking-dot,
  .agent-avatar-bobbing,
  .agent-avatar-thinking {
    animation: none;
  }
}
</style>
