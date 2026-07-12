<template>
  <div
    ref="scrollContainer"
    class="h-full min-h-0 overflow-y-auto"
  >
    <!-- 空状態 -->
    <div
      v-if="!store.hasMessages"
      class="flex min-h-full flex-col items-center justify-center px-3 py-4"
    >
      <div
        class="w-full max-w-lg rounded-lg border border-neutral-200 bg-gradient-to-br from-white via-sky-50/30 to-violet-50/20 px-4 py-4"
      >
        <div class="flex items-start gap-3 text-left">
          <div
            :class="[
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
              emptyIconBg,
            ]"
          >
            <UIcon :name="emptyIcon" :class="['h-5 w-5', emptyIconColor]" />
          </div>
          <div class="min-w-0">
            <h3 class="text-sm font-bold text-neutral-800">
              {{ emptyTitle }}
            </h3>
            <p class="mt-0.5 text-xs leading-relaxed text-neutral-500">
              {{ emptyDescription }}
            </p>
          </div>
        </div>
      </div>

      <p class="mt-4 mb-2 text-[11px] font-semibold text-neutral-400">
        例から始める
      </p>
      <div class="flex w-full max-w-lg flex-wrap justify-center gap-1.5">
        <button
          v-for="(chip, i) in suggestionChips"
          :key="i"
          type="button"
          class="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-left text-[11px] text-neutral-700 transition hover:border-sky-300 hover:bg-sky-50/50"
          @click="emit('use-suggestion', chip)"
        >
          {{ chip }}
        </button>
      </div>
    </div>

    <!-- メッセージ一覧 -->
    <div
      v-else
      class="space-y-2.5 px-3 py-3"
    >
      <div
        v-for="m in store.messages"
        :key="m.id"
        class="flex"
        :class="m.role === 'user' ? 'justify-end' : 'gap-2'"
      >
        <div
          v-if="m.role === 'user'"
          class="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-violet-50 px-3.5 py-2 text-[13px] text-neutral-900 shadow-[0_1px_2px_rgba(124,58,237,0.06)] ring-1 ring-violet-100/80"
        >
          {{ m.text }}
        </div>

        <template v-else>
          <div
            :class="[
              'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ring-1',
              avatarStyle(m.agent),
            ]"
          >
            <UIcon
              :name="agentIcon(m.agent)"
              :class="['h-4 w-4', agentIconColor(m.agent)]"
            />
          </div>

          <div
            v-if="m.isStreaming && !m.text"
            class="inline-flex items-center gap-2 self-center rounded-full bg-sky-50/90 px-3 py-1.5 text-xs font-medium italic text-sky-700 ring-1 ring-sky-200"
          >
            考えてます…
          </div>
          <div
            v-else
            class="max-w-[85%] min-w-0 flex-1 rounded-2xl bg-white px-3.5 py-2 text-[13px] leading-relaxed text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-900/[0.06]"
          >
            <EnMarkdown
              v-if="m.text"
              :markdown-text="m.text"
              variant="ai"
              compact
              :enable-router-links="false"
              class="agent-md"
            />
            <div
              v-if="m.artifacts?.length"
              class="mt-2 space-y-2"
            >
              <template
                v-for="(artifact, artifactIndex) in m.artifacts"
                :key="`${m.id}-artifact-${artifactIndex}`"
              >
                <div
                  v-if="artifact.kind === 'image'"
                  class="overflow-hidden rounded-lg border border-violet-100 bg-violet-50/40 p-2"
                >
                  <AdkArtifactImage
                    :artifact-id="artifact.artifactId"
                    :url="artifact.url"
                    :adk-filename="artifact.adkFilename"
                    :artifact-version="artifact.artifactVersion"
                    :alt="'生成画像'"
                    class="max-h-80 w-full rounded-md object-contain bg-white"
                  />
                  <p
                    v-if="artifact.prompt"
                    class="mt-1 line-clamp-2 text-[10px] text-neutral-500"
                  >
                    {{ artifact.prompt }}
                  </p>
                </div>
              </template>
            </div>
            <span
              v-if="m.isStreaming"
              class="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-sky-500 align-middle"
            />
          </div>
        </template>
      </div>

      <div
        v-if="store.lastError"
        class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
      >
        ⚠️ {{ store.lastError }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useAiStudioStore } from "@stores/aiStudio";
import type { AdkAgentMode } from "@composables/useAgentSseClient";
import AdkArtifactImage from "@components/AgentWorkspace/AdkArtifactImage.vue";

const store = useAiStudioStore();
const scrollContainer = ref<HTMLElement | null>(null);

const emit = defineEmits<{
  (e: "use-suggestion", text: string): void;
}>();

const SUGGESTIONS: Record<string, string[]> = {
  consultation: [
    "粗利が落ちている原因を一緒に整理したい",
    "業務効率の改善をどこから手をつけるべきか",
    "来月の利益見通しの前提を整理したい",
  ],
  writing: [
    "顧客への謝罪メールの下書きを作りたい",
    "社内通知文を丁寧なトーンで書いて",
    "議事録の要点をまとめて",
  ],
  sheet: [
    "売上データのピボット表を整理したい",
    "一覧データにアラート列を追加したい",
    "月次集計シートの数式を確認したい",
  ],
  image: [
    "サービス紹介用の OGP 画像を生成したい",
    "製品パッケージのモックアップ画像",
    "社内資料用のシンプルなイラスト",
  ],
  default: [
    "来月の利益見通しを考えたい",
    "顧客へのメールを書いて",
    "売上データを整理したい",
  ],
};

const suggestionChips = computed(() => {
  const key = store.activeAgent ?? "default";
  return SUGGESTIONS[key] ?? SUGGESTIONS.default;
});

const emptyTitle = computed(() => {
  switch (store.activeAgent) {
    case "writing":
      return "文書生成 Agent と話しましょう";
    case "sheet":
      return "スプレッドシート Agent と話しましょう";
    case "image":
      return "画像生成 Agent と話しましょう";
    case "consultation":
      return "経営相談 Agent と話しましょう";
    default:
      return "コンシェルジュが最適な Agent を選びます";
  }
});

const emptyDescription = computed(() => {
  switch (store.activeAgent) {
    case "writing":
      return "メール・議事録・通知文など、コピペで使える文章を作ります";
    case "sheet":
      return "Google スプレッドシートの URL を貼り付けてから依頼してください";
    case "image":
      return "OGP・アイコン・資料挿絵などを Imagen で生成します";
    case "consultation":
      return "経営判断や数値変動の壁打ち相手になります (組織ナレッジ参照可)";
    default:
      return "「文章を書いて」「分析して」「画像作って」など、自然に話しかけてください";
  }
});

const emptyIcon = computed(() => {
  switch (store.activeAgent) {
    case "writing":
      return "material-symbols:edit-document";
    case "sheet":
      return "material-symbols:grid-on";
    case "image":
      return "material-symbols:image";
    case "consultation":
      return "material-symbols:psychology";
    default:
      return "material-symbols:auto-awesome";
  }
});

const emptyIconColor = computed(() => {
  switch (store.activeAgent) {
    case "writing":
      return "text-emerald-600";
    case "sheet":
      return "text-blue-600";
    case "image":
      return "text-violet-600";
    case "consultation":
      return "text-sky-600";
    default:
      return "text-neutral-500";
  }
});

const emptyIconBg = computed(() => {
  switch (store.activeAgent) {
    case "writing":
      return "bg-emerald-50";
    case "sheet":
      return "bg-blue-50";
    case "image":
      return "bg-violet-50";
    case "consultation":
      return "bg-sky-50";
    default:
      return "bg-neutral-100";
  }
});

const agentIcon = (agent: AdkAgentMode | undefined): string => {
  switch (agent) {
    case "writing":
      return "material-symbols:edit-document";
    case "sheet":
      return "material-symbols:grid-on";
    case "image":
      return "material-symbols:image";
    case "consultation":
      return "material-symbols:psychology";
    default:
      return "material-symbols:smart-toy";
  }
};

const agentIconColor = (agent: AdkAgentMode | undefined): string => {
  switch (agent) {
    case "writing":
      return "text-emerald-600";
    case "sheet":
      return "text-blue-600";
    case "image":
      return "text-violet-600";
    case "consultation":
      return "text-sky-600";
    default:
      return "text-neutral-500";
  }
};

const avatarStyle = (agent: AdkAgentMode | undefined): string => {
  switch (agent) {
    case "writing":
      return "bg-emerald-50 ring-emerald-200";
    case "sheet":
      return "bg-blue-50 ring-blue-200";
    case "image":
      return "bg-violet-50 ring-violet-200";
    case "consultation":
      return "bg-sky-50 ring-sky-200";
    default:
      return "bg-neutral-50 ring-neutral-200";
  }
};

watch(
  () => store.messages.length,
  async () => {
    await nextTick();
    const el = scrollContainer.value;
    if (el) el.scrollTop = el.scrollHeight;
  }
);

watch(
  () => store.messages[store.messages.length - 1]?.text,
  async () => {
    await nextTick();
    const el = scrollContainer.value;
    if (el) el.scrollTop = el.scrollHeight;
  }
);
</script>
