<template>
  <div class="flex h-full flex-col bg-white">
    <!-- ヘッダー (操作ガイド専用なのでシンプル固定) -->
    <div
      class="flex items-center justify-between px-5 py-3 border-b border-sky-200 bg-gradient-to-b from-sky-50 to-white"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div
          class="relative rounded-xl p-2 shadow-md flex-shrink-0 bg-gradient-to-br from-sky-500 to-blue-600"
        >
          <UIcon
            name="material-symbols:menu-book-rounded"
            class="w-5 h-5 text-white"
          />
        </div>
        <div class="min-w-0">
          <span class="text-base font-bold text-gray-900 tracking-tight">
            操作ガイド
          </span>
          <span class="block text-[11px] font-normal text-gray-500">
            EN AIstudio の使い方・場所を AI が案内します
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="hidden sm:flex items-center gap-1 text-[10px] text-gray-400">
          <UKbd class="text-[10px]">Esc</UKbd>
          <span>で閉じる</span>
        </div>
      </div>
    </div>

    <!-- ページコンテキスト chip (常時) -->
    <AssistantContextChip />

    <!-- メッセージリスト -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto px-6 py-4 space-y-4"
    >
      <!-- ===== WELCOME (履歴なし) — 操作ガイド専用. シンプルに質問例だけ ===== -->
      <div v-if="!store.hasMessages" class="space-y-3 pt-1">
        <p class="text-xs text-slate-500 leading-relaxed">
          マスタ・画面・設定など「どこで何する?」を直接ご質問ください.
        </p>
        <!-- ページ案内 CTA があれば優先表示 -->
        <button
          v-if="pageTourPrompt"
          type="button"
          class="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-left text-[12px] font-semibold text-sky-700 hover:bg-sky-50 transition-colors"
          @click="submitWithMode(pageTourPrompt, 'guide')"
        >
          📖 {{ pageTourLabel }} の操作ガイドを開始
        </button>
        <!-- サンプル質問 -->
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="sample in guideSamples"
            :key="sample"
            type="button"
            class="inline-block rounded-full border border-sky-300 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50 transition-colors"
            @click="submitWithMode(sample, 'guide')"
          >
            {{ sample }}
          </button>
        </div>
      </div>

      <!-- ===== メッセージ ===== -->
      <div
        v-for="msg in store.messages"
        :key="msg.id"
        :class="[
          'flex',
          msg.role === 'user' ? 'justify-end' : 'justify-start',
        ]"
      >
        <div
          v-if="msg.role === 'user'"
          class="max-w-[85%] rounded-2xl bg-slate-800 px-4 py-3 text-white shadow-sm"
        >
          <div class="whitespace-pre-wrap break-words text-sm">
            {{ msg.text }}
          </div>
        </div>
        <div v-else class="flex max-w-[85%] flex-col gap-2">
          <div
            :class="[
              'rounded-2xl px-4 py-3 shadow-sm',
              assistantBubbleClass(msg.mode),
            ]"
          >
            <EnMarkdown
              class="assistant-msg"
              :markdown-text="msg.text"
              :variant="msg.mode === 'guide' ? 'help' : 'ai'"
              compact
            />
            <span
              v-if="msg.isStreaming"
              :class="[
                'inline-block w-2 h-4 -mb-0.5 animate-pulse',
                streamingCursorClass(msg.mode),
              ]"
              aria-hidden="true"
            />
            <!-- writing モード: 全文コピーボタン -->
            <div
              v-if="!msg.isStreaming && msg.mode === 'writing' && msg.text"
              class="mt-2 flex justify-end"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                @click="copyText(msg.text, msg.id)"
              >
                <UIcon
                  :name="
                    copiedMessageId === msg.id
                      ? 'material-symbols:check-circle'
                      : 'material-symbols:content-copy-outline'
                  "
                  class="w-3 h-3"
                />
                {{ copiedMessageId === msg.id ? 'コピー済み' : '全文コピー' }}
              </button>
            </div>
            <!-- ADK artifacts (image / text_block / sheet_op) -->
            <div
              v-if="msg.artifacts && msg.artifacts.length > 0"
              class="mt-3 space-y-2"
            >
              <template v-for="(a, i) in msg.artifacts" :key="`${msg.id}-a-${i}`">
                <!-- image -->
                <div
                  v-if="a.kind === 'image'"
                  class="rounded-xl border border-rose-200 bg-rose-50/40 p-2"
                >
                  <img
                    :src="a.url"
                    :alt="a.prompt ?? '生成画像'"
                    class="w-full rounded-lg object-contain max-h-80 bg-white"
                  />
                  <div class="mt-2 flex items-center justify-between gap-2">
                    <span
                      v-if="a.prompt"
                      class="text-[10px] text-rose-800/80 truncate"
                      :title="a.prompt"
                    >
                      🎨 {{ a.prompt }}
                    </span>
                    <a
                      :href="a.url"
                      target="_blank"
                      rel="noopener"
                      class="flex-shrink-0 inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      <UIcon name="material-symbols:download" class="w-3 h-3" />
                      ダウンロード
                    </a>
                  </div>
                </div>
                <!-- text_block (コピー単位の生成文章) -->
                <div
                  v-else-if="a.kind === 'text_block'"
                  class="rounded-xl border border-emerald-300 bg-emerald-50/40 p-3"
                >
                  <div
                    v-if="a.title"
                    class="mb-1 text-[11px] font-extrabold text-emerald-900"
                  >
                    📝 {{ a.title }}
                  </div>
                  <pre
                    class="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-slate-800 font-sans"
                  >{{ a.body }}</pre>
                  <div class="mt-2 flex justify-end">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50"
                      @click="copyText(a.body, `${msg.id}-a-${i}`)"
                    >
                      <UIcon
                        :name="
                          copiedMessageId === `${msg.id}-a-${i}`
                            ? 'material-symbols:check-circle'
                            : 'material-symbols:content-copy-outline'
                        "
                        class="w-3 h-3"
                      />
                      {{
                        copiedMessageId === `${msg.id}-a-${i}`
                          ? 'コピー済み'
                          : 'コピー'
                      }}
                    </button>
                  </div>
                </div>
                <!-- sheet_op (シート操作の結果) -->
                <div
                  v-else-if="a.kind === 'sheet_op'"
                  class="flex items-start gap-2 rounded-xl border border-teal-300 bg-teal-50/40 p-2.5"
                >
                  <UIcon
                    :name="
                      a.status === 'applied'
                        ? 'material-symbols:check-circle'
                        : a.status === 'failed'
                          ? 'material-symbols:error-outline'
                          : 'material-symbols:edit-note'
                    "
                    :class="[
                      'w-4 h-4 mt-0.5 flex-shrink-0',
                      a.status === 'failed'
                        ? 'text-rose-600'
                        : 'text-teal-700',
                    ]"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="text-[11px] font-extrabold text-teal-900">
                      {{
                        a.status === "applied"
                          ? "適用済"
                          : a.status === "failed"
                            ? "失敗"
                            : "提案"
                      }}
                      <span
                        v-if="a.range"
                        class="ml-1 font-mono text-[10px] text-teal-700"
                      >
                        {{ a.range }}
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-700 leading-snug">
                      {{ a.summary }}
                    </p>
                  </div>
                </div>
              </template>
            </div>
            <div
              v-if="
                !msg.isStreaming &&
                msg.mode === 'guide' &&
                msg.autoNavigation
              "
              class="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3"
            >
              <div class="flex items-start gap-2">
                <UIcon
                  name="material-symbols:assistant-navigation-outline"
                  class="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-[11px] font-bold text-blue-900">
                    この画面を開きますか?
                  </p>
                  <p class="mt-0.5 truncate text-[12px] font-semibold text-slate-800">
                    {{ msg.autoNavigation.label }}
                  </p>
                  <p class="mt-1 text-[10px] text-blue-700">
                    YES と送っても移動できます
                  </p>
                </div>
              </div>
              <div class="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-white/70 hover:text-slate-700"
                  @click="dismissAutoNavigation(msg.id)"
                >
                  あとで
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700"
                  @click="executeAutoNavigation(msg.autoNavigation)"
                >
                  <UIcon
                    name="material-symbols:arrow-outward-rounded"
                    class="h-3.5 w-3.5"
                  />
                  開く
                </button>
              </div>
            </div>
          </div>
          <ConsultationSourceReferencePanel
            v-if="
              !msg.isStreaming &&
              (msg.sourceReferences?.length || msg.groundingMetadata)
            "
            :source-references="msg.sourceReferences"
            :grounding-metadata="msg.groundingMetadata"
            :documents="fileSpaceDocuments"
          />
        </div>
      </div>

      <!-- ストリーミング初期インジケータ -->
      <div v-if="showThinkingIndicator" class="flex justify-start">
        <div
          class="rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm"
        >
          <div :class="['flex items-center gap-2', thinkingTextClass]">
            <span class="flex gap-1">
              <span
                :class="['w-2 h-2 rounded-full animate-bounce', thinkingDotClass]"
              />
              <span
                :class="['w-2 h-2 rounded-full animate-bounce', thinkingDotClass]"
                style="animation-delay: 0.15s"
              />
              <span
                :class="['w-2 h-2 rounded-full animate-bounce', thinkingDotClass]"
                style="animation-delay: 0.3s"
              />
            </span>
            <span class="text-xs font-semibold">考えています...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 入力エリア: 大きめ textarea + 右側に縦並びアクション (📎 添付 / ▶ 送信) -->
    <div class="border-t border-slate-200 bg-white px-4 py-3">
      <!-- sheet モードの URL ゲート / 設定済み表示 -->
      <div
        v-if="store.sessionMode === 'sheet'"
        :class="[
          'mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold',
          store.sheetSpreadsheetId
            ? 'border border-teal-300 bg-teal-50 text-teal-800'
            : 'border border-rose-300 bg-rose-50 text-rose-800',
        ]"
      >
        <UIcon
          :name="
            store.sheetSpreadsheetId
              ? 'material-symbols:link'
              : 'material-symbols:warning-outline'
          "
          class="w-4 h-4 flex-shrink-0"
        />
        <template v-if="store.sheetSpreadsheetId">
          <span class="truncate flex-1" :title="store.sheetSpreadsheetUrl ?? ''">
            操作対象シート:
            <span class="font-mono">{{ store.sheetSpreadsheetId }}</span>
          </span>
          <a
            v-if="store.sheetSpreadsheetUrl"
            :href="store.sheetSpreadsheetUrl"
            target="_blank"
            rel="noopener"
            class="text-teal-700 hover:underline"
          >
            開く
          </a>
          <button
            type="button"
            class="rounded border border-teal-300 bg-white px-1.5 py-0.5 text-[10px] hover:bg-teal-100"
            @click="resetSheetUrl"
          >
            別のシート
          </button>
        </template>
        <template v-else>
          <span class="flex-1">
            まず Google スプレッドシートの URL を貼ってください
            (<span class="font-mono">docs.google.com/spreadsheets/d/...</span>)
          </span>
        </template>
      </div>
      <div class="flex items-stretch gap-2">
        <!-- @vue-ignore Nuxt UI textarea forwards keydown at runtime, but its generated prop type omits it. -->
        <UTextarea
          ref="textareaRef"
          v-model="input"
          :rows="4"
          :maxrows="10"
          autoresize
          autofocus
          :placeholder="formPlaceholder"
          size="lg"
          class="flex-1 en-aistudio-input-textarea"
          :disabled="store.isStreaming"
          @keydown.enter="onEnter"
        />
        <!-- 右側アクション縦並び (textarea と等高) -->
        <div class="flex flex-col gap-2 w-24 flex-shrink-0">
          <UButton
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-heroicons-paper-clip"
            :disabled="true"
            block
            class="flex-1 justify-center"
            title="ファイル添付は次のバージョンで対応します"
          >
            添付
          </UButton>
          <UButton
            :color="sendButtonColor"
            variant="solid"
            size="lg"
            icon="i-heroicons-paper-airplane"
            :loading="store.isStreaming"
            :disabled="!canSubmit"
            block
            class="flex-1 justify-center font-bold"
            @click="submit(input)"
          >
            送信
          </UButton>
        </div>
      </div>
      <div
        class="mt-2 flex items-center justify-between text-[11px] text-slate-400"
      >
        <span>Enter で送信 / Shift+Enter で改行</span>
        <button
          v-if="store.hasMessages"
          type="button"
          class="font-semibold text-slate-500 hover:text-slate-700"
          @click="store.resetGuideTurn()"
        >
          会話をクリア
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
/**
 * EN AIstudio 操作ガイド・チャットパネル本体。
 *
 * 役割: EN AIstudio の使い方・場所を AI が案内する **操作ガイド専用** のチャット.
 * (経営相談 / 文書生成 / 画像生成 / リサーチ は AIスタジオで起動するため、
 *  このパネルからは扱わない / ナビ動線も持たない)
 *
 * Welcome 状態: 質問例 chip と (任意で) 現在ページのツアー開始ボタンだけ.
 * セッションは FAB クリック / Cmd+K で毎回リセットして 0 から開始する設計
 * (`store.openFreshGuide()`).
 *
 * mode-aware color (MODE_COLORS) は message bubble / 思考インジケータ /
 * 送信ボタンで引き続き利用するが、ヘッダーは操作ガイド固定 (sky/blue) で
 * 切替なし.
 */

const store = useEnAiStudioAssistantStore();
const route = useRoute();
const router = useRouter();
// (アバター画像は廃止: 操作ガイドはアイコンのみで質問に集中する設計)
const { findModeByRouteName } = useNavigationModeRegistry();
const fileSpaceStore = useGeminiFileSpaceOperatorStore();

// 経営相談の grounding citation を解決するための Document 一覧。
// store.defaultFileSpaceId が確定したら fileSpaceStore から取得する。
const fileSpaceDocuments = computed(() => fileSpaceStore.documents);

const input = ref("");
const scrollContainer = ref<HTMLElement | null>(null);
const textareaRef = ref<{ inputRef?: HTMLTextAreaElement | null } | null>(null);

const guideSamples = [
  "ナレッジが空のときは何をすればいい?",
  "AI に PDF を読ませたい",
  "シート連携を設定したい",
];


const copiedMessageId = ref<string | null>(null);
const copyText = async (text: string, id: string) => {
  try {
    await navigator.clipboard.writeText(text);
    copiedMessageId.value = id;
    setTimeout(() => {
      if (copiedMessageId.value === id) copiedMessageId.value = null;
    }, 1800);
  } catch {
    // 失敗時は何もしない (Tooltip 表示などはオーバースペック)
  }
};

const pageContext = computed(() => {
  const routeName = typeof route.name === "string" ? route.name : "";
  if (!routeName) return null;
  const mode = findModeByRouteName(routeName);
  if (!mode) return null;
  for (const group of mode.groups) {
    const card = group.cards.find((c) => c.routeName === routeName);
    if (card) return { label: card.label, mode };
  }
  if (mode.homeRouteName === routeName) {
    return { label: `${mode.label} モード`, mode };
  }
  return { label: mode.label, mode };
});

const pageTourLabel = computed(() => pageContext.value?.label ?? "");
const pageTourPrompt = computed(() => {
  if (!pageContext.value) return null;
  return `現在のページ「${pageContext.value.label}」の使い方を、3 ステップ程度で教えてください。`;
});

const canSubmit = computed(() => {
  if (store.isStreaming) return false;
  const trimmed = input.value.trim();
  if (trimmed.length === 0) return false;
  // sheet モードで URL 未登録時は、入力本文に URL が含まれている時だけ送信可
  if (store.needsSheetUrl) {
    return /https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]{20,}/.test(
      trimmed
    );
  }
  return true;
});

/** sheet モードで「別のシート」をクリックした時: URL state をリセット */
const resetSheetUrl = () => {
  if (store.isStreaming) return;
  store.sheetSpreadsheetId = null;
  store.sheetSpreadsheetUrl = null;
};

const showThinkingIndicator = computed(() => {
  if (!store.isStreaming) return false;
  const last = store.messages[store.messages.length - 1];
  return !last || last.role !== "assistant" || last.text.length === 0;
});

const formPlaceholder = computed(() => {
  if (store.needsSheetUrl) {
    return "📊 まず編集したい Google スプレッドシートの URL を貼ってください (docs.google.com/spreadsheets/d/...)";
  }
  switch (store.sessionMode) {
    case "guide":
      return "📘 EN AIstudio の使い方・場所を質問してください (例: ナレッジはどこから登録する?)";
    case "consultation":
      return "🟠 経営相談モード: AI 部下 が業務の壁打ち相手になります";
    case "writing":
      return "📝 文章生成モード: 作りたい文章の用途・読み手・トーンを教えてください";
    case "sheet":
      return "📊 シート編集モード: 例: 「A1 に '売上' と書いて」「2 行目に新しい商品を追加して」";
    case "image":
      return "🎨 画像生成モード: 作りたい画像の内容・スタイル・サイズを教えてください";
    default:
      return "迷ったらここに一言。AI 部下 が自動でモードを選びます";
  }
});

// === Mode-aware colors ===

type ModeColorToken = {
  headerBg: string;
  iconBg: string;
  title: string;
  subtitle: string;
  chipLabel: string;
  chip: string;
  chipDot: string;
  bubble: string;
  cursor: string;
  thinkingDot: string;
  thinkingText: string;
  sendButton:
    | "primary"
    | "neutral"
    | "info"
    | "warning"
    | "success"
    | "error"
    | "secondary";
};

const MODE_COLORS: Record<
  "guide" | "consultation" | "writing" | "sheet" | "image",
  ModeColorToken
> = {
  guide: {
    headerBg: "bg-gradient-to-b from-sky-50 to-white border-sky-200",
    iconBg: "bg-gradient-to-br from-sky-500 to-blue-600",
    title: "AI 部下 — 操作ガイドモード",
    subtitle: "EN AIstudio の使い方・場所を案内します",
    chipLabel: "📘 操作ガイド",
    chip: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
    chipDot: "bg-sky-500",
    bubble: "bg-white border border-sky-200 text-slate-800",
    cursor: "bg-sky-500",
    thinkingDot: "bg-sky-500",
    thinkingText: "text-sky-600",
    sendButton: "info",
  },
  consultation: {
    headerBg: "bg-gradient-to-b from-purple-50 to-white border-purple-200",
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
    title: "AI 部下 — 経営相談モード",
    subtitle: "業務・経営判断の壁打ち相手をします",
    chipLabel: "🟠 経営相談",
    chip: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
    chipDot: "bg-purple-500",
    bubble: "bg-white border border-purple-200 text-slate-800",
    cursor: "bg-purple-500",
    thinkingDot: "bg-purple-500",
    thinkingText: "text-purple-600",
    sendButton: "warning",
  },
  writing: {
    headerBg: "bg-gradient-to-b from-emerald-50 to-white border-emerald-200",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    title: "AI 部下 — 文章生成モード",
    subtitle: "コピペで使える文章成果物を作ります",
    chipLabel: "📝 文章生成",
    chip: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    chipDot: "bg-emerald-500",
    bubble: "bg-white border border-emerald-200 text-slate-800",
    cursor: "bg-emerald-500",
    thinkingDot: "bg-emerald-500",
    thinkingText: "text-emerald-600",
    sendButton: "success",
  },
  sheet: {
    headerBg: "bg-gradient-to-b from-teal-50 to-white border-teal-200",
    iconBg: "bg-gradient-to-br from-teal-500 to-cyan-600",
    title: "AI 部下 — シート編集モード",
    subtitle: "Google スプレッドシートに口頭で指示できます",
    chipLabel: "📊 シート編集",
    chip: "bg-teal-100 text-teal-700 ring-1 ring-teal-200",
    chipDot: "bg-teal-500",
    bubble: "bg-white border border-teal-200 text-slate-800",
    cursor: "bg-teal-500",
    thinkingDot: "bg-teal-500",
    thinkingText: "text-teal-600",
    sendButton: "primary",
  },
  image: {
    headerBg: "bg-gradient-to-b from-rose-50 to-white border-rose-200",
    iconBg: "bg-gradient-to-br from-rose-500 to-pink-600",
    title: "AI 部下 — 画像生成モード",
    subtitle: "Imagen で画像を生成します",
    chipLabel: "🎨 画像生成",
    chip: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    chipDot: "bg-rose-500",
    bubble: "bg-white border border-rose-200 text-slate-800",
    cursor: "bg-rose-500",
    thinkingDot: "bg-rose-500",
    thinkingText: "text-rose-600",
    sendButton: "error",
  },
};

const NEUTRAL_COLORS: ModeColorToken = {
  headerBg: "bg-gradient-to-b from-slate-50 to-white border-slate-200",
  iconBg: "bg-gradient-to-br from-slate-500 to-slate-700",
  title: "AI 部下",
  subtitle: "AI 部下 がモードを判断して答えます",
  chipLabel: "⚪️ 待機",
  chip: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  chipDot: "bg-slate-400",
  bubble: "bg-white border border-slate-200 text-slate-800",
  cursor: "bg-slate-500",
  thinkingDot: "bg-slate-400",
  thinkingText: "text-slate-500",
  sendButton: "neutral",
};

const currentModeColor = computed<ModeColorToken>(() =>
  store.sessionMode ? MODE_COLORS[store.sessionMode] : NEUTRAL_COLORS
);

// Header は操作ガイド専用なので mode 別カラーの header 系 computed は廃止 (hard-coded sky).
// mode 別カラーは引き続き message bubble / 思考インジケータ / 送信ボタン色で利用する.
const thinkingDotClass = computed(() => currentModeColor.value.thinkingDot);
const thinkingTextClass = computed(() => currentModeColor.value.thinkingText);
const sendButtonColor = computed(() => currentModeColor.value.sendButton);

const assistantBubbleClass = (
  mode: "guide" | "consultation" | "writing" | "sheet" | "image" | undefined
): string => (mode ? MODE_COLORS[mode].bubble : NEUTRAL_COLORS.bubble);

const streamingCursorClass = (
  mode: "guide" | "consultation" | "writing" | "sheet" | "image" | undefined
): string => (mode ? MODE_COLORS[mode].cursor : NEUTRAL_COLORS.cursor);

// === Submit / focus / scroll ===

type AutoNavigation =
  NonNullable<(typeof store.messages)[number]["autoNavigation"]>;

const isNavigationAffirmation = (text: string): boolean => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return [
    "yes",
    "y",
    "ok",
    "go",
    "open",
    "はい",
    "うん",
    "お願い",
    "お願いします",
    "移動",
    "移動して",
    "開いて",
    "開く",
    "そこに行く",
  ].includes(normalized);
};

const executeAutoNavigation = async (
  navigation: AutoNavigation | null | undefined
) => {
  if (!navigation) return;

  if (navigation.kind === "route") {
    await router.push({ name: navigation.routeName });
    store.pendingAutoNavigation = null;
    store.close();
    return;
  }

  switch (navigation.launcherKey) {
    case "business-consultation":
      store.clear();
      store.open();
      return;
    case "writing":
    case "sheet":
    case "image":
      store.clear();
      store.presetMode(navigation.launcherKey);
      store.open();
      return;
  }
};

const dismissAutoNavigation = (messageId: string) => {
  const message = store.messages.find((m) => m.id === messageId);
  if (message?.autoNavigation === store.pendingAutoNavigation) {
    store.pendingAutoNavigation = null;
  }
  if (message) {
    message.autoNavigation = null;
  }
  store.persistHistory();
};

const submit = async (prompt: string) => {
  const trimmed = prompt.trim();
  if (!trimmed || store.isStreaming) return;
  input.value = "";
  if (
    store.sessionMode === "guide" &&
    store.pendingAutoNavigation &&
    isNavigationAffirmation(trimmed)
  ) {
    await executeAutoNavigation(store.pendingAutoNavigation);
    return;
  }
  await store.send(trimmed);
  await scrollToBottom();
};

/** カード内 chip / CTA: mode をプリセット + 即送信 */
const submitWithMode = async (
  prompt: string,
  mode: "guide" | "consultation" | "writing" | "sheet" | "image"
) => {
  if (store.isStreaming) return;
  store.presetMode(mode);
  await submit(prompt);
};

const onEnter = (event: KeyboardEvent) => {
  if (event.shiftKey) return;
  event.preventDefault();
  submit(input.value);
};

const scrollToBottom = async () => {
  await nextTick();
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

/**
 * textarea にフォーカス. USlideover は Transition で開くため、
 * 一度の nextTick では DOM が間に合わないことがある.
 * requestAnimationFrame を数回挟んで、ref が解決するまでリトライする.
 */
const focusTextarea = async () => {
  const tryFocus = (): boolean => {
    const el =
      (textareaRef.value as unknown as { inputRef?: HTMLTextAreaElement })
        ?.inputRef ??
      (textareaRef.value as unknown as HTMLTextAreaElement | null);
    if (el && typeof (el as HTMLTextAreaElement).focus === "function") {
      (el as HTMLTextAreaElement).focus();
      return true;
    }
    return false;
  };

  await nextTick();
  if (tryFocus()) return;

  // Slideover の transition (~300ms) 待ち. 4 回 ×80ms までリトライ.
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (tryFocus()) return;
  }
};

watch(
  () => store.messages.length,
  () => {
    void scrollToBottom();
  }
);

// パネル open watcher: pendingPrompt があれば textarea にセット + 自動 submit
// USlideover はパネル open=true で初めてマウントするので immediate: true 必須。
watch(
  () => store.isOpen,
  (open) => {
    if (!open) return;
    // この FAB は操作ガイド (guide) 専用. mode 未確定なら自動的に固定し、
    // intent 分類による経営相談 / writing / sheet / image への分岐を抑制する.
    // (他の AI 業務は /admin/ai-studio から起動する設計)
    if (store.sessionMode === null) {
      store.presetMode("guide");
    }
    void focusTextarea();
    if (!store.pendingPrompt) return;
    const prompt = store.pendingPrompt;
    const autoSend = store.pendingAutoSend;
    input.value = prompt;
    store.consumePendingPrompt();
    if (autoSend) {
      void nextTick(() => {
        void submit(prompt);
      });
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.assistant-msg :deep(a) {
  text-decoration: none;
}
.assistant-msg :deep(ul) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
  list-style: disc;
}
.assistant-msg :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
  list-style: decimal;
}
.assistant-msg :deep(li) {
  margin: 0.15rem 0;
}
.assistant-msg :deep(p) {
  margin: 0.4rem 0;
}
.assistant-msg :deep(strong) {
  font-weight: 700;
}
.assistant-msg :deep(code) {
  background: rgb(241 245 249);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  font-size: 0.85em;
}

/* === ロールカードのペンギン舞台 === */
.penguin-stage {
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 14px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
}
.violet-stage {
  background: linear-gradient(180deg, #fff7ed 0%, #fed7aa 100%);
}
.blue-stage {
  background: linear-gradient(180deg, #f0f9ff 0%, #bae6fd 100%);
}
.penguin-img {
  width: 52px;
  height: 52px;
  object-fit: contain;
  will-change: transform;
}
/**
 * 仮の青ペンギン: hue-rotate で青系に寄せ、彩度を下げて違和感を抑える.
 * デザイナーが正式な PNG を作ったら、別アセットに差し替え可能.
 */
.blue-penguin {
  filter: hue-rotate(190deg) saturate(0.75) brightness(0.95);
}

/* ペンギンが軽く揺れる (game feel) */
.penguin-bob {
  animation: penguin-bob 3.6s ease-in-out infinite;
}
@keyframes penguin-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-3px) rotate(2deg);
  }
}

/* 案内ペンギンの小道具: クリップボードが右下に被さる */
.penguin-prop {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  color: #0369a1; /* sky-700 */
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
  z-index: 2;
}

/* カード hover lift と active press */
.role-card {
  transition:
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 220ms ease,
    border-color 220ms ease;
}
.role-card:active {
  transform: translateY(0) scale(0.98);
}
.role-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .penguin-bob,
  .role-card {
    animation: none !important;
    transition: none;
  }
  .role-card:hover {
    transform: none;
  }
}
</style>
