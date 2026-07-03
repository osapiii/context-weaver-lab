<template>
  <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
              <UIcon name="material-symbols:terminal" class="h-4 w-4 text-slate-500" />
              {{ title }}
            </h4>
            <p class="mt-1 text-sm leading-6 text-slate-600">
              {{ description }}
            </p>
          </div>
          <EnBadge color="neutral" variant="soft">
            Firebase AI
          </EnBadge>
        </div>
      </div>

      <div ref="messageListRef" class="h-[520px] overflow-y-auto bg-slate-50/60 p-4">
        <div class="space-y-3">
          <div
            v-for="message in messages"
            :key="message.id"
            class="flex"
            :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm"
              :class="message.role === 'user'
                ? 'bg-slate-950 text-white'
                : 'border border-slate-200 bg-white text-slate-800'"
            >
              <EnMarkdown
                v-if="message.role === 'assistant'"
                :markdown-text="message.text"
                variant="ai"
                compact
                :enable-router-links="false"
              />
              <p v-else class="whitespace-pre-wrap">
                {{ message.text }}
              </p>
            </div>
          </div>
          <div v-if="isSending" class="flex justify-start">
            <div class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <span class="h-2 w-2 animate-pulse rounded-full bg-slate-500" />
              MCP JSONを参照中
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-slate-200 bg-white p-3">
        <div class="mb-2 flex flex-wrap gap-2">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            type="button"
            class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
            @click="draft = suggestion"
          >
            {{ suggestion }}
          </button>
        </div>
        <form class="flex gap-2" @submit.prevent="sendMessage">
          <input
            v-model="draft"
            type="text"
            class="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            placeholder="この動画レポートについて質問"
            :disabled="isSending"
          >
          <EnButton
            variant="ai"
            size="sm"
            leading-icon="material-symbols:send-outline"
            :loading="isSending"
            :global-loading="false"
            :disabled="!draft.trim()"
            type="submit"
          >
            送信
          </EnButton>
        </form>
      </div>
    </div>

    <aside class="space-y-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h5 class="flex items-center gap-2 text-sm font-bold text-slate-950">
          <UIcon name="material-symbols:data-object" class="h-4 w-4 text-slate-500" />
          AIに渡す文脈
        </h5>
        <dl class="mt-3 space-y-2 text-xs">
          <div>
            <dt class="font-semibold text-slate-500">形式</dt>
            <dd class="mt-1 font-mono text-slate-900">MCP JSON response</dd>
          </div>
          <div>
            <dt class="font-semibold text-slate-500">applicationId</dt>
            <dd class="mt-1 break-all font-mono text-slate-900">{{ application?.id || video?.applicationId || "-" }}</dd>
          </div>
          <div>
            <dt class="font-semibold text-slate-500">対象</dt>
            <dd class="mt-1 break-all font-mono text-slate-900">{{ contextLabel }}</dd>
          </div>
          <div>
            <dt class="font-semibold text-slate-500">モデル</dt>
            <dd class="mt-1 font-mono text-slate-900">gemini-2.5-flash-lite</dd>
          </div>
        </dl>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h5 class="flex items-center gap-2 text-sm font-bold text-slate-950">
            <UIcon name="material-symbols:data-object" class="h-4 w-4 text-slate-500" />
            返却プレビュー
          </h5>
          <EnBadge color="neutral" variant="soft">{{ contextLineCount }} lines</EnBadge>
        </div>
        <textarea
          :value="contextJson"
          readonly
          class="h-[360px] w-full resize-none rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100"
        />
      </div>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type {
  DecodedStoryVaultApplication,
  DecodedStoryVaultOperationVideo,
} from "@models/storyVault";

type McpTestMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const props = defineProps<{
  application: DecodedStoryVaultApplication | null;
  video?: DecodedStoryVaultOperationVideo | null;
  contextJson: string;
  title?: string;
  description?: string;
  contextLabel?: string;
}>();

const messageListRef = ref<HTMLElement | null>(null);
const draft = ref("");
const isSending = ref(false);
const messages = ref<McpTestMessage[]>([
  {
    id: "welcome",
    role: "assistant",
    text:
      "この動画のMCPレスポンス相当JSONだけを文脈として会話できます。AIエディターへ渡す前に、動画・ストーリー候補・関連コンテキストが十分に伝わるかを確認できます。",
  },
]);

const suggestions = [
  "概要を教えて",
  "紐づくストーリー候補を要約して",
  "関連ナレッジとPRを確認したい",
];

const title = computed(() => props.title || "MCPテストチャット");
const description = computed(
  () =>
    props.description ||
    "MCPレスポンス相当のJSONだけを文脈として渡し、この対象について会話できます"
);
const contextLabel = computed(
  () => props.contextLabel || props.video?.id || "selected-context"
);

const contextLineCount = computed(() =>
  props.contextJson ? props.contextJson.split("\n").length : 0
);

async function sendMessage(): Promise<void> {
  const text = draft.value.trim();
  if (!text || isSending.value) return;
  draft.value = "";
  messages.value.push({
    id: `user-${Date.now()}`,
    role: "user",
    text,
  });
  isSending.value = true;
  await nextTick();
  scrollToBottom();
  try {
    const reply = await askFirebaseAi(text);
    messages.value.push({
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text: reply,
    });
  } catch (error) {
    messages.value.push({
      id: `assistant-error-${Date.now()}`,
      role: "assistant",
      text:
        error instanceof Error
          ? `Firebase AIでの応答生成に失敗しました。\n\n${error.message}`
          : "Firebase AIでの応答生成に失敗しました。",
    });
  } finally {
    isSending.value = false;
    void nextTick(scrollToBottom);
  }
}

async function askFirebaseAi(question: string): Promise<string> {
  const [{ getApp }, { getAI, getGenerativeModel, VertexAIBackend }] =
    await Promise.all([import("firebase/app"), import("firebase/ai")]);
  const ai = getAI(getApp(), { backend: new VertexAIBackend("us-central1") });
  const model = getGenerativeModel(ai, {
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200,
    },
  });
  const result = await model.generateContent([
    [
      "あなたはStoryVaultのMCPテストチャットです。",
      "以下のMCPレスポンスJSONだけを根拠に、日本語で簡潔に回答してください。",
      "JSONにない内容は推測せず、わからないと伝えてください。",
      "実装指示ではなく、コンテキスト確認の会話として答えてください。",
      "",
      "## MCP JSON Response",
      props.contextJson.slice(0, 60000),
      "",
      "## User Question",
      question,
    ].join("\n"),
  ]);
  const text = result.response.text().trim();
  return text || "MCP JSONから回答を生成できませんでした。";
}

function scrollToBottom(): void {
  const el = messageListRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

watch(
  () => props.contextJson,
  () => {
    messages.value = [
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        text:
          "この動画のMCPレスポンス相当JSONだけを文脈として会話できます。AIエディターへ渡す前に、動画・ストーリー候補・関連コンテキストが十分に伝わるかを確認できます。",
      },
    ];
    draft.value = "";
  }
);
</script>
