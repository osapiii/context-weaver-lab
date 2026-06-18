/**
 * AI Studio の推奨プロンプトを Gemini Flash Lite で軽量生成する.
 * BYOK キー未設定時は静的フォールバックを返す.
 */
import { computed, ref, watch } from "vue";
import log from "@utils/logger";
import type { AIRevisionQuickAction } from "@components/EnAIRevisionAssistantPanel.vue";
import { useAiStudioStore } from "@stores/aiStudio";
import { useGeminiByokStore } from "@stores/gemini-byok";
import { useAiUserSettingsStore } from "@stores/ai-user-settings";
import { modeMeta } from "@constants/aiStudioModes";
import {
  fallbackQuickActions,
  parseQuickActionSuggestions,
} from "@utils/aiStudioQuickActionsFallback";

const QUICK_ACTION_MODEL = "gemini-2.5-flash-lite";
const SUGGESTION_COUNT = 4;

const QUICK_ACTION_SYSTEM_PROMPT = `\
あなたは EN AIstudio AI Studio の「おすすめの聞き方」生成機です.
ユーザーの状況に合わせ、**実際にクリックして送りたくなる** 具体的な依頼文を ${SUGGESTION_COUNT} 件提案してください.

## ルール
- label: 12〜18 文字程度の短い見出し (一覧用)
- text: 50〜140 文字の依頼文 (そのまま入力欄に入る)
- 抽象的すぎる文言は禁止 (例: 「粗利低下」「業務改善」だけは NG)
- 経営相談モードでは、可能なら社内資料・FileSpace 検索を使う依頼を 1 件以上含める
- 会話履歴がある場合は、直前の話題の **次の一手** になる提案を優先
- グローバル指示がある場合は、その人物像・役割に合った提案にする
- icon は material-symbols の suffix のみ (例: folder-open, analytics, search)

## 出力
JSON のみ. Markdown 禁止.
{
  "suggestions": [
    { "label": "...", "text": "...", "icon": "folder-open" }
  ]
}`;

const buildContextBlock = (params: {
  modeLabel: string;
  globalPrompt: string;
  fileSpaceDocCount: number;
  recentMessages: Array<{ role: string; text: string }>;
}): string => {
  const lines = [
    `現在の Agent モード: ${params.modeLabel}`,
    `FileSpace 登録資料: ${params.fileSpaceDocCount} 件`,
  ];
  if (params.globalPrompt.trim()) {
    lines.push(`ユーザーのグローバル指示:\n${params.globalPrompt.trim()}`);
  }
  if (params.recentMessages.length > 0) {
    lines.push(
      "直近の会話:",
      ...params.recentMessages.map(
        (m) => `- ${m.role === "user" ? "ユーザー" : "AI"}: ${m.text.slice(0, 200)}`
      )
    );
  } else {
    lines.push("会話履歴: まだメッセージなし (初回のおすすめ)");
  }
  return lines.join("\n");
};

export const useAiStudioQuickActions = (options?: {
  fileSpaceDocCount?: () => number;
}) => {
  const store = useAiStudioStore();
  const quickActions = ref<AIRevisionQuickAction[]>([]);
  const isLoading = ref(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let requestSeq = 0;

  const applyFallback = () => {
    quickActions.value = fallbackQuickActions(store.activeAgent);
  };

  const generate = async (): Promise<void> => {
    const agent = store.activeAgent;
    if (!agent) {
      quickActions.value = [];
      return;
    }

    const seq = ++requestSeq;
    isLoading.value = true;

    try {
      const apiKey = await useGeminiByokStore().resolveApiKey();
      if (!apiKey) {
        applyFallback();
        return;
      }

      await useAiUserSettingsStore().loadGlobalSystemPrompt();
      const globalPrompt = useAiUserSettingsStore().globalSystemPrompt;

      const recentMessages = store.messages
        .filter((m) => m.text.trim())
        .slice(-4)
        .map((m) => ({ role: m.role, text: m.text }));

      const context = buildContextBlock({
        modeLabel: modeMeta(agent).label,
        globalPrompt,
        fileSpaceDocCount: options?.fileSpaceDocCount?.() ?? 0,
        recentMessages,
      });

      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey });

      const response = await client.models.generateContent({
        model: QUICK_ACTION_MODEL,
        contents: [
          {
            role: "user",
            parts: [{ text: `${QUICK_ACTION_SYSTEM_PROMPT}\n\n${context}` }],
          },
        ],
        config: {
          temperature: 0.7,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    text: { type: "string" },
                    icon: { type: "string" },
                  },
                  required: ["label", "text"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      });

      if (seq !== requestSeq) return;

      const parsed = parseQuickActionSuggestions(
        JSON.parse(response.text ?? "{}"),
        SUGGESTION_COUNT
      );
      quickActions.value =
        parsed.length > 0 ? parsed : fallbackQuickActions(agent);
    } catch (error) {
      log("WARN", "[useAiStudioQuickActions] generation failed", error);
      if (seq === requestSeq) applyFallback();
    } finally {
      if (seq === requestSeq) isLoading.value = false;
    }
  };

  const scheduleGenerate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void generate();
    }, 400);
  };

  watch(
    () =>
      [
        store.activeAgent,
        store.sessionId,
        store.messages.length,
        store.isStreaming,
      ] as const,
    ([agent, , , streaming]) => {
      if (!agent) {
        quickActions.value = [];
        return;
      }
      if (streaming) return;
      applyFallback();
      scheduleGenerate();
    },
    { immediate: true }
  );

  return {
    quickActions: computed(() => quickActions.value),
    isLoadingQuickActions: computed(() => isLoading.value),
    refreshQuickActions: generate,
  };
};
