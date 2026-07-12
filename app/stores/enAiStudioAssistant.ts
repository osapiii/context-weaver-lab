import { defineStore } from "pinia";
import { GoogleGenAI } from "@google/genai";
import log from "@utils/logger";
import {
  useEnAiStudioAssistantContext,
  parseIntentToken,
  parseGoogleSheetUrl,
  isAdkMode,
  type EnAiStudioSessionMode,
  type AdkMode,
} from "@composables/useEnAiStudioAssistantContext";
import {
  defaultLlmModelSelectionForAdkMode,
  resolveGeminiApiModelName,
} from "@models/llmModelSelection";
import type { AttachmentRef } from "@composables/agentAttachments/types";
import type { ConsultationSourceReference } from "@utils/consultationSourceReferences";
import { groundingToSourceReferences } from "@utils/adkGrounding";
import type { AdkGroundingMetadata } from "@utils/adkGrounding";
import type { AgentSseHistoryTurn } from "@composables/useAgentSseClient";
import {
  createAdkInvokeRequest,
  isAdkInvokeViaRequestDocEnabled,
  watchAdkInvokeRequest,
} from "@composables/useAdkInvokeRequest";
import {
  createAdkInvokeRequestLog,
  finalizeAdkInvokeRequestLog,
} from "@utils/adkInvokeRequestLog";
import { buildAdkInvokeInput } from "@utils/adkInvokeInputBuilder";
import {
  askEnAiStudioGuide,
  extractGuideAutoNavigation,
  type EnAiStudioGuideAutoNavigation,
} from "@utils/guideAssistantCallable";
import {
  subscribeActiveAdkSession,
  useAiStudioSessions,
} from "@composables/useAiStudioSessions";
import { isAiStudioWorkspaceMode } from "@constants/aiStudioModes";
import { subscribeSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import { getAuth } from "firebase/auth";

/**
 * EN AIstudio 統合 AI アシスタント (旧: 操作アシスタント + AI 部下) の Pinia store。
 *
 * 設計:
 *  - **1 セッション = 1 mode 固定**。1 ターン目の応答先頭の `<<intent:...>>` トークンで
 *    sessionMode を確定し、以降固定する。
 *  - **操作ガイドモード (guide)**: Firebase Callable BFF + Gemini File Search Store
 *    (1 質問 = 1 往復。send のたびに履歴・ADK セッションをリセット)
 *  - **経営相談モード (consultation)**: Cloud Run ADK エージェント (SSE / 対話) + 組織 FileSpace grounding
 *  - ADK 対話は RequestDoc → Firebase Functions → ADK（ブラウザから ADK REST しない）
 *  - 1 ターン目の intent 分類だけは consultation でも直接 Gemini を使う
 *    (intent token を高速で取りたい / FileSearch まで待つ必要が無い)。
 *  - チャット履歴は Space スコープで localStorage に永続化。
 *  - 旧 operationAssistant の localStorage 履歴があれば起動時にマイグレートする。
 */

export type EnAiStudioAssistantArtifact =
  | {
      kind: "image";
      artifactId?: string;
      url?: string;
      prompt?: string;
      mimeType?: string;
      width?: number;
      height?: number;
    }
  | {
      kind: "sheet_op";
      summary: string;
      range?: string;
      status: "proposed" | "applied" | "failed";
    }
  | {
      kind: "text_block";
      title?: string;
      body: string;
    };

export type EnAiStudioAssistantMessage = {
  role: "user" | "assistant";
  /** 生 Markdown テキスト (intent トークンはパース時に除去済み) */
  text: string;
  id: string;
  createdAt: number;
  /** ストリーミング中フラグ */
  isStreaming?: boolean;
  /** この応答が確定させた / 紐づく mode (UI の色決定用) */
  mode?: "guide" | "consultation" | "writing" | "sheet" | "image";
  /**
   * Gemini API から返ってきた grounding metadata。
   * consultation mode (FileSearch 経由) の応答に付く。UI で citation 表示する。
   */
  groundingMetadata?: unknown;
  /** FileSearch documentId / Web URI (UI citation パネル) */
  sourceReferences?: ConsultationSourceReference[];
  /**
   * ADK エージェントから返ってきた成果物 (生成画像 / シート操作結果 / コピー用ブロック等).
   * UI 側で kind ごとに専用カードを描画する.
   */
  artifacts?: EnAiStudioAssistantArtifact[];
  /** 操作ガイド回答から抽出した、ユーザー確認後に実行する遷移候補 */
  autoNavigation?: EnAiStudioGuideAutoNavigation | null;
};

const ASSISTANT_MODEL = "gemini-2.5-flash";
const HISTORY_KEY_PREFIX = "en-aistudio:assistant:history";
const LEGACY_HISTORY_KEY_PREFIX = "en-aistudio:operationAssistant:history";
const MAX_PERSISTED_MESSAGES = 50;

const buildHistoryKey = (spaceId: string | null | undefined): string =>
  spaceId ? `${HISTORY_KEY_PREFIX}:${spaceId}` : HISTORY_KEY_PREFIX;

const buildLegacyHistoryKey = (spaceId: string | null | undefined): string =>
  spaceId
    ? `${LEGACY_HISTORY_KEY_PREFIX}:${spaceId}`
    : LEGACY_HISTORY_KEY_PREFIX;

const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Backend / Gemini SDK が吐き出す raw JSON エラーをチャットバブルにそのまま貼ると
 * 「{"error":{"message":"{\n \"error\": {\n \"code\": 429,...}}」みたいに
 * 改行も整わないノイズになる. ここで主要パターンを分類して人間可読にする.
 * Markdown は renderer 経由で描画されるのでリンクや太字も生きる.
 */
const formatErrorForDisplay = (raw: unknown): string => {
  const message =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : JSON.stringify(raw);

  // Gemini AI Studio 月次 spending cap オーバー (HTTP 429 RESOURCE_EXHAUSTED)
  if (
    message.includes("RESOURCE_EXHAUSTED") ||
    /\"code\":\s*429/.test(message) ||
    message.includes("monthly spending cap")
  ) {
    return [
      "⚠️ **Gemini API の利用上限に達しました**",
      "",
      "Google AI Studio で **月次 spending cap** を超過しています.",
      "次のいずれかで解消できます:",
      "",
      "- [AI Studio で上限を確認・引き上げる](https://aistudio.google.com/apikey)",
      "- アプリ右上の **設定 → AI 連携** から別の Gemini API キーに切り替える",
      "- 翌月まで待つ (cap がリセットされます)",
    ].join("\n");
  }

  // 401 / 403 系 (API キー無効 / 権限なし)
  if (
    /\"code\":\s*40[13]/.test(message) ||
    message.includes("API key not valid") ||
    message.includes("PERMISSION_DENIED")
  ) {
    return [
      "⚠️ **API キーが無効か権限がありません**",
      "",
      "アプリ右上の **設定 → AI 連携** から有効な Gemini API キーを登録し直してください.",
      "AI Studio のキー発行ページ: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)",
    ].join("\n");
  }

  // それ以外: JSON っぽければ最初の "message" だけ拾う. なければそのまま (長すぎたら省略)
  const innerMatch = message.match(/\"message\":\s*\"([^\"]{5,300})\"/);
  if (innerMatch && innerMatch[1]) {
    return `⚠️ エラー: ${innerMatch[1]}`;
  }
  const trimmed = message.length > 400 ? `${message.slice(0, 400)}...` : message;
  return `⚠️ エラー: ${trimmed}`;
};

export const useEnAiStudioAssistantStore = defineStore("enAiStudioAssistant", {
  state: () => ({
    isOpen: false,
    isStreaming: false,
    messages: [] as EnAiStudioAssistantMessage[],
    /**
     * セッション mode。1 ターン目の応答で決定し、それ以降固定。
     * `clear()` でリセット (= 次の質問で再判定)。
     */
    sessionMode: null as EnAiStudioSessionMode,
    /** 開いた時に textarea にプリセットしたいプロンプト (one-shot) */
    pendingPrompt: null as string | null,
    /** pendingPrompt と組で使う. true なら panel 側が自動 submit (Hero フォーム経由) */
    pendingAutoSend: false,
    /** 直近エラー (UI 表示用) */
    lastError: null as string | null,
    /** guide mode で「YES」と言われた時に実行する直近の遷移候補 */
    pendingAutoNavigation: null as EnAiStudioGuideAutoNavigation | null,
    genaiClient: null as GoogleGenAI | null,
    /**
     * ユーザーが設定 → AI 連携 で登録した Gemini API キー (Firestore
     * `users/{uid}/secrets/geminiApiKey` 由来) のメモリキャッシュ.
     * researchAgent.userApiKey と同じ BYOK 規約.
     */
    userApiKey: null as string | null,
    /** 現 genaiClient がどのキーで初期化されたか. キー差し替え検知用. */
    genaiClientKeySuffix: null as string | null,
    /** 永続化対象の Space ID */
    persistedForSpaceId: null as string | null,
    /**
     * 「常時 grounding に流す default FileSpace」の ID。
     * Slideover マウント時に解決し、consultation mode で必ず使う。
     */
    defaultFileSpaceId: null as string | null,
    /**
     * FileSpace 解決中のロック (二重呼び出し防止)。
     */
    isResolvingDefaultFileSpace: false,
    /** ADK セッションの一意 ID (mode 確定後に発番). サーバー側で会話 state を保持するキー. */
    adkSessionId: null as string | null,
    activeSessionUnsubscribe: null as (() => void) | null,
    /** sheet モードで操作対象の spreadsheet ID と元 URL. URL ゲートで埋まる. */
    sheetSpreadsheetId: null as string | null,
    sheetSpreadsheetUrl: null as string | null,
    /**
     * agent page (writing/sheet/image) が session 開始時にセットする参考資料.
     * sendViaAdk の body にそのまま渡され、BE 側で 1 ターン目のみ inject される.
     * 多重投入を避けるため最初の send 直後にクリアする.
     */
    pendingAttachments: [] as AttachmentRef[],
  }),
  getters: {
    hasMessages: (state) => state.messages.length > 0,
    /** ヘッダー / バブル色制御用 (null は neutral) */
    accentMode: (state) => state.sessionMode,
    /**
     * sheet モードで URL をまだ受け取っていない状態.
     * Panel が送信ボタン disable とプレースホルダー文言の切替に使う.
     */
    needsSheetUrl: (state): boolean =>
      state.sessionMode === "sheet" && !state.sheetSpreadsheetId,
  },
  actions: {
    open() {
      this.isOpen = true;
    },
    /**
     * 操作ガイド FAB 用. 毎回セッションをリセットして guide モードで開く.
     * - 過去会話を消す (clear)
     * - sessionMode を "guide" に固定 (intent 分類スキップ)
     * - pendingPrompt をクリア (前回 launchGuideSession の残骸が autosend されないように)
     * - isOpen = true
     */
    openFreshGuide(): void {
      this.resetGuideTurn();
      this.sessionMode = "guide";
      this.lastError = null;
      this.pendingPrompt = null;
      this.pendingAutoSend = false;
      this.persistHistory();
      this.isOpen = true;
    },
    close() {
      this.isOpen = false;
    },
    toggle() {
      this.isOpen = !this.isOpen;
    },
    /**
     * @param prompt パネル open 時に textarea にプリセットする本文
     * @param options.autoSend true ならプリセット直後に自動 submit (Hero フォーム経由用)
     */
    openWithPrompt(prompt: string, options: { autoSend?: boolean } = {}) {
      this.pendingPrompt = prompt;
      this.pendingAutoSend = !!options.autoSend;
      this.isOpen = true;
    },
    consumePendingPrompt() {
      this.pendingPrompt = null;
      this.pendingAutoSend = false;
    },
    /**
     * セッション mode をユーザー操作 (ロールカードのクリック) で明示プリセット。
     * 設定済み = AI による intent 判定をスキップして、最初の send からその mode で動く。
     */
    presetMode(
      mode: "guide" | "consultation" | "writing" | "sheet" | "image"
    ): void {
      // 既に会話が始まっていれば変更を無視 (1 セッション固定の原則)
      if (this.messages.length > 0) return;
      this.sessionMode = mode;
      if (mode === "sheet") {
        this.sheetSpreadsheetId = null;
        this.sheetSpreadsheetUrl = null;
      }
    },
    /**
     * Quest カードの「続きを進める」入口。
     * 既存セッションをクリアし、guide モードで固定した状態で
     * quest 状況をまとめた prompt を auto-send する。
     */
    launchGuideSession(prompt: string): void {
      this.messages = [];
      this.sessionMode = "guide";
      this.lastError = null;
      this.pendingAutoNavigation = null;
      this.persistHistory();
      this.pendingPrompt = prompt;
      this.pendingAutoSend = true;
      this.isOpen = true;
    },
    /**
     * 操作ガイド用: 表示中の会話と ADK セッションだけ捨てる (mode は guide のまま).
     * 質問のたびに send() から呼ばれ、常に 1 往復だけ表示する.
     */
    resetGuideTurn(): void {
      this.messages = [];
      this.adkSessionId = null;
      this.activeSessionUnsubscribe?.();
      this.activeSessionUnsubscribe = null;
      this.lastError = null;
      this.pendingAutoNavigation = null;
      this.persistHistory();
    },

    ensureActiveSessionSubscription(): void {
      if (!this.adkSessionId) return;
      this.activeSessionUnsubscribe?.();
      const stopSession = subscribeActiveAdkSession({
        sessionId: this.adkSessionId,
        onRecord: (record) => {
          if (!record || record.sessionId !== this.adkSessionId) return;
          this.messages = record.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            createdAt: m.createdAt,
            completedAt: m.completedAt,
            isStreaming: m.isStreaming,
            mode: (m.agent ?? this.sessionMode ?? undefined) as
              | EnAiStudioAssistantMessage["mode"]
              | undefined,
            artifacts: m.artifacts as EnAiStudioAssistantArtifact[] | undefined,
            groundingMetadata: m.groundingMetadata,
            sourceReferences: m.sourceReferences,
            autoNavigation: undefined,
          }));
          this.isStreaming = record.messages.some((m) => m.isStreaming);
        },
      });
      const stopArtifacts = subscribeSessionArtifacts({
        sessionId: this.adkSessionId,
      });
      this.activeSessionUnsubscribe = () => {
        stopSession();
        stopArtifacts();
      };
    },
    clear() {
      this.messages = [];
      this.sessionMode = null;
      this.lastError = null;
      this.pendingAutoNavigation = null;
      this.adkSessionId = null;
      this.sheetSpreadsheetId = null;
      this.sheetSpreadsheetUrl = null;
      this.persistHistory();
    },
    /**
     * sheet モードで操作対象スプレッドシートを差し替える.
     * Panel の「シートを変える」ボタンや、ユーザーが途中で別 URL を貼った時に呼ぶ.
     */
    updateSheetUrl(url: string): boolean {
      const parsed = parseGoogleSheetUrl(url);
      if (!parsed) return false;
      this.sheetSpreadsheetId = parsed.spreadsheetId;
      this.sheetSpreadsheetUrl = parsed.url;
      this.persistHistory();
      return true;
    },
    /**
     * BYOK: 設定 → AI 連携 で登録したユーザーキー (Firestore
     * `users/{uid}/secrets/geminiApiKey`) を read してメモリにキャッシュ.
     * researchAgent.loadUserApiKey と同じ規約.
     */
    async loadUserApiKey(): Promise<string | null> {
      const byok = useGeminiByokStore();
      const k = await byok.loadUserApiKey();
      this.userApiKey = k;
      return k;
    },

    /**
     * ユーザーキャッシュをクリア. 設定画面でキーを差し替えた直後に呼ぶ.
     */
    clearUserApiKeyCache(): void {
      useGeminiByokStore().clearCache();
      this.userApiKey = null;
      this.genaiClient = null;
      this.genaiClientKeySuffix = null;
    },

    /** BYOK ストア経由で GoogleGenAI クライアントを確保する. */
    async ensureGenaiClient(): Promise<void> {
      const byok = useGeminiByokStore();
      this.genaiClient = await byok.ensureGeminiClient();
      this.genaiClientKeySuffix = byok.genaiClientKeySuffix;
      this.userApiKey = byok.apiKey;
      log("INFO", "[enAiStudioAssistant] genai client (re)initialized", {
        source: "byok",
        suffix: this.genaiClientKeySuffix,
      });
    },

    /**
     * organization の default FileSpace (system タイプ) を解決する。
     * 既存なら storeId をセット。無ければ作成 RequestDoc を発行して
     * fileSpaces state が更新されたら裏で再解決する。
     *
     * Slideover マウント時 / Space 切替時に呼ぶ。
     */
    async ensureDefaultFileSpace(): Promise<void> {
      if (this.isResolvingDefaultFileSpace) return;
      this.isResolvingDefaultFileSpace = true;
      try {
        const { useGeminiFileSpaceOperatorStore } = await import(
          "@stores/geminiFileSpaceOperator"
        );
        const fileSpaceStore = useGeminiFileSpaceOperatorStore();

        // 1) 既存の system FileSpace を最優先で取りに行く
        const existingId = await fileSpaceStore.getFirstSystemManagedFileSpaceId();
        if (existingId) {
          this.defaultFileSpaceId = existingId;
          void fileSpaceStore.fetchDocumentsFromFirestore(existingId).catch(() => {
            // citation 表示が貧しくなるだけなので黙殺
          });
          return;
        }

        // 2) 既存が無ければ作成リクエストを発行 (Cloud Run 非同期)
        // 作成中は defaultFileSpaceId は null のままで、UI は直接 Gemini にフォールバック。
        // 作成完了後の自動再解決は fileSpaces state を watch している
        // useDefaultFileSpace composable 経由でも反映される (data-source ページ等)。
        const result = await fileSpaceStore.ensureDefaultFileSpace();
        if (result.storeId) {
          this.defaultFileSpaceId = result.storeId;
          void fileSpaceStore
            .fetchDocumentsFromFirestore(result.storeId)
            .catch(() => undefined);
          return;
        }
        if (result.requestId) {
          log(
            "INFO",
            "[enAiStudioAssistant] default FileSpace creation requested",
            { requestId: result.requestId }
          );
          return;
        }
        log(
          "INFO",
          "[enAiStudioAssistant] default FileSpace unavailable; consultation mode will fall back to direct Gemini"
        );
      } catch (error) {
        log("WARN", "[enAiStudioAssistant] ensureDefaultFileSpace failed", error);
      } finally {
        this.isResolvingDefaultFileSpace = false;
      }
    },

    /**
     * ユーザーメッセージを送信し、AI 応答を取得する。
     * 経路ルーティング:
     *  - 1 ターン目で sessionMode 未確定: 直接 Gemini で intent token を引く
     *  - sessionMode が guide: Firebase Callable BFF + Gemini File Search
     *  - sessionMode が ADK モード (consultation / writing / sheet / image): ADK RequestDoc
     *  - 1 ターン目 intent 分類のみ: 直接 Gemini (軽量)
     */
    async send(prompt: string): Promise<void> {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      if (this.isStreaming) return;

      // 操作ガイド: 1 質問 = 1 往復 (履歴を引きずらない)
      if (this.sessionMode === "guide") {
        this.resetGuideTurn();
      }

      // どの mode でも、入力中に Sheets URL が含まれていたら eager に capture する.
      const parsed = parseGoogleSheetUrl(trimmed);
      if (parsed && !this.sheetSpreadsheetId) {
        this.sheetSpreadsheetId = parsed.spreadsheetId;
        this.sheetSpreadsheetUrl = parsed.url;
      }

      const isFirstTurn = !this.messages.some((m) => m.role === "assistant");
      const needsIntentClassification =
        isFirstTurn && this.sessionMode === null;

      if (needsIntentClassification) {
        await this.sendViaDirectGemini(trimmed, true);
        return;
      }

      if (this.sessionMode === "guide") {
        await this.sendViaGuideFileSearch(trimmed);
        return;
      }

      if (this.sessionMode && isAdkMode(this.sessionMode)) {
        await this.sendViaAdk(trimmed, this.sessionMode);
        return;
      }

      await this.sendViaDirectGemini(trimmed, false);
    },

    /**
     * 直接 Gemini API (browser) で送信。streaming + 1 ターン目の intent 判定対応。
     */
    async sendViaDirectGemini(
      trimmed: string,
      needsIntentClassification: boolean
    ): Promise<void> {
      const { buildSystemPrompt } = useEnAiStudioAssistantContext();
      const systemPrompt = buildSystemPrompt(
        needsIntentClassification ? null : this.sessionMode
      );

      this.messages.push({
        role: "user",
        text: trimmed,
        id: createId(),
        createdAt: Date.now(),
      });

      const assistantIndex = this.messages.length;
      this.messages.push({
        role: "assistant",
        text: "",
        id: createId(),
        createdAt: Date.now(),
        isStreaming: true,
      });

      this.lastError = null;
      this.pendingAutoNavigation = null;
      this.isStreaming = true;

      try {
        // BYOK: ユーザー登録キー優先で genaiClient を確保. キー差し替え時は
        // 自動的に作り直される.
        await this.ensureGenaiClient();
        if (!this.genaiClient) {
          throw new Error("GenAI client is not initialized.");
        }

        const contents = this.messages.slice(0, assistantIndex).map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text }],
        }));

        const requestParams = {
          model: ASSISTANT_MODEL,
          contents,
          config: {
            systemInstruction: systemPrompt,
          },
        };

        log("INFO", "[enAiStudioAssistant] streaming (direct)", {
          model: ASSISTANT_MODEL,
          needsIntentClassification,
          sessionMode: this.sessionMode,
          messageCount: contents.length,
        });

        const stream =
          await this.genaiClient.models.generateContentStream(requestParams);

        let accumulated = "";
        let intentParsed = !needsIntentClassification;
        let resolvedModeForThisTurn:
          | "guide"
          | "consultation"
          | "writing"
          | "sheet"
          | "image"
          | undefined = this.sessionMode ?? undefined;

        for await (const chunk of stream) {
          const piece = chunk.text || "";
          if (!piece) continue;
          accumulated += piece;

          let displayText = accumulated;
          if (!intentParsed) {
            const { mode, cleanedText } = parseIntentToken(accumulated);
            if (mode) {
              this.sessionMode = mode;
              resolvedModeForThisTurn = mode;
              intentParsed = true;
              displayText = cleanedText;
            } else if (accumulated.length > 64) {
              this.sessionMode = "guide";
              resolvedModeForThisTurn = "guide";
              intentParsed = true;
              displayText = accumulated;
              log(
                "WARN",
                "[enAiStudioAssistant] intent token not found in first 64 chars, defaulting to guide"
              );
            } else {
              displayText = accumulated.replace(/^\s*<<intent:[^>]*>?>?$/, "");
            }
          } else {
            const { cleanedText } = parseIntentToken(accumulated);
            displayText = cleanedText;
          }

          this.messages[assistantIndex] = {
            ...this.messages[assistantIndex]!,
            text: displayText,
            mode: resolvedModeForThisTurn,
          };
        }

        this.messages[assistantIndex] = {
          ...this.messages[assistantIndex]!,
          isStreaming: false,
          mode: resolvedModeForThisTurn,
        };

        this.persistHistory();
      } catch (error) {
        log("ERROR", "[enAiStudioAssistant] streaming failed (direct)", error);
        const message =
          error instanceof Error
            ? error.message
            : "AI 応答の取得に失敗しました";
        this.lastError = message;
        this.messages[assistantIndex] = {
          ...this.messages[assistantIndex]!,
          text: formatErrorForDisplay(message),
          isStreaming: false,
        };
      } finally {
        this.isStreaming = false;
      }
    },

    /**
     * 操作ガイド — Firebase Callable BFF + Gemini File Search.
     * ADK セッションを作らず、全ユーザー共通のヘルプコーパスに対して軽量に回答する.
     */
    async sendViaGuideFileSearch(trimmed: string): Promise<void> {
      this.messages.push({
        role: "user",
        text: trimmed,
        id: createId(),
        createdAt: Date.now(),
      });

      const assistantIndex = this.messages.length;
      this.messages.push({
        role: "assistant",
        text: "",
        id: createId(),
        createdAt: Date.now(),
        isStreaming: true,
        mode: "guide",
      });

      this.lastError = null;
      this.isStreaming = true;

      try {
        const { buildGuideRuntimeContext } = useEnAiStudioAssistantContext();
        const response = await askEnAiStudioGuide({
          prompt: trimmed,
          guideContext: buildGuideRuntimeContext(),
        });
        const groundingMetadata = response.groundingMetadata;
        const sourceReferences = groundingMetadata
          ? groundingToSourceReferences(
              groundingMetadata as AdkGroundingMetadata
            )
          : [];

        const autoNavigation =
          response.autoNavigation ??
          extractGuideAutoNavigation(
            response.text || "該当するガイドを見つけられませんでした。"
          );
        this.pendingAutoNavigation = autoNavigation ?? null;

        this.messages[assistantIndex] = {
          ...this.messages[assistantIndex]!,
          text: response.text || "該当するガイドを見つけられませんでした。",
          isStreaming: false,
          mode: "guide",
          groundingMetadata,
          sourceReferences,
          autoNavigation,
        };

        this.persistHistory();
      } catch (error) {
        log("ERROR", "[enAiStudioAssistant] guide callable failed", error);
        const message =
          error instanceof Error
            ? error.message
            : "操作ガイドの取得に失敗しました";
        this.lastError = message;
        this.pendingAutoNavigation = null;
        this.messages[assistantIndex] = {
          ...this.messages[assistantIndex]!,
          text: formatErrorForDisplay(message),
          isStreaming: false,
          mode: "guide",
        };
      } finally {
        this.isStreaming = false;
      }
    },

    /**
     * ADK エージェント (writing / sheet / image / consultation) — 対話ユースケース (SSE).
     * 共通ランタイム `useAdkSessionRuntimeStore({ scope: 'en-aistudio-assistant' }).invokeDialogue` 経由.
     */
    async sendViaAdk(trimmed: string, mode: AdkMode): Promise<void> {
      this.messages.push({
        role: "user",
        text: trimmed,
        id: createId(),
        createdAt: Date.now(),
      });

      const assistantIndex = this.messages.length;
      this.messages.push({
        role: "assistant",
        text: "",
        id: createId(),
        createdAt: Date.now(),
        isStreaming: true,
        mode,
      });

      this.lastError = null;
      this.isStreaming = true;

      let invokeRequestId: string | null = null;

      try {
        const { useOrganizationStore } = await import("@stores/organization");
        const { useSpaceStore } = await import("@stores/space");
        const orgStore = useOrganizationStore();
        const spaceStore = useSpaceStore();
        const orgId = orgStore.getLoggedInOrganizationId;
        const spaceId = spaceStore.selectedSpace?.id;
        if (!orgId || !spaceId) {
          throw new Error(
            "組織またはスペースが未選択のため、ADK 経路を使えません"
          );
        }

        if (!this.adkSessionId) {
          this.adkSessionId = createId();
        }

        const sessions = useAiStudioSessions();
        const transcriptMessages = this.messages
          .slice(0, assistantIndex + 1)
          .map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            createdAt: m.createdAt,
            isStreaming: m.isStreaming === true,
            agent: (m.mode ?? mode) as AdkMode,
          }));
        const existing = await sessions.get(this.adkSessionId);
        if (existing) {
          await sessions.update(this.adkSessionId, {
            messages: transcriptMessages,
            activeAgent: mode,
            jobKind: isAiStudioWorkspaceMode(mode) ? mode : null,
          });
        } else {
          await sessions.create({
            sessionId: this.adkSessionId,
            messages: transcriptMessages,
            activeAgent: mode,
            jobKind: isAiStudioWorkspaceMode(mode) ? mode : null,
          });
        }
        const priorTurns = this.messages.slice(0, assistantIndex - 1);
        const history: AgentSseHistoryTurn[] = priorTurns.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          text: m.text,
        }));

        const modeState: Record<string, unknown> = {};
        if (mode === "sheet") {
          modeState.spreadsheet_id = this.sheetSpreadsheetId;
          modeState.spreadsheet_url = this.sheetSpreadsheetUrl;
        }
        const fileSpaceId = this.defaultFileSpaceId;

        const modelSelection = defaultLlmModelSelectionForAdkMode(mode);
        const attachments = [...this.pendingAttachments];

        // BE は history が空 (1 ターン目) の時のみ attachments を inject する.
        // FE 側でも 1 度渡したらクリアすることで多重投入を防ぐ.
        if (attachments.length > 0) {
          this.pendingAttachments = [];
        }

        const assistantMessageId = this.messages[assistantIndex]!.id;

        if (!isAdkInvokeViaRequestDocEnabled()) {
          throw new Error(
            "ADK 直接接続は無効です。NUXT_PUBLIC_ADK_INVOKE_VIA_REQUEST_DOC=false になっていないか確認してください。"
          );
        }
        const uid = getAuth().currentUser?.uid;
        if (!uid) {
          throw new Error("ログイン状態ではありません");
        }
        this.ensureActiveSessionSubscription();
        invokeRequestId = await createAdkInvokeRequestLog({
          mode,
          sessionId: this.adkSessionId,
          prompt: trimmed,
          organizationId: orgId,
          spaceId,
          fileSpaceId,
          model: modelSelection,
        });
        const invokeInput = buildAdkInvokeInput({
          mode,
          sessionId: this.adkSessionId,
          organizationId: orgId,
          spaceId,
          userId: uid,
          prompt: trimmed,
          responseId: assistantMessageId,
          model: modelSelection,
          fileSpaceId,
          history,
          modeState,
          attachments: attachments
            .filter((a) => Boolean(a.gcsPath?.trim()))
            .map((a) => ({
              gcsPath: a.gcsPath!,
              fileName: a.name,
              mimeType: a.mimeType,
            })),
        });
        const requestId = await createAdkInvokeRequest({
          input: invokeInput,
          organizationId: orgId,
          spaceId,
        });
        invokeRequestId = requestId;
        await new Promise<void>((resolve, reject) => {
          const stopWatch = watchAdkInvokeRequest({
            organizationId: orgId,
            spaceId,
            requestId,
            onUpdate: (status, errorMessage) => {
              if (status === "completed") {
                stopWatch();
                resolve();
              } else if (status === "error") {
                stopWatch();
                reject(
                  new Error(errorMessage || "ADK invoke が失敗しました")
                );
              }
            },
          });
        });
        this.messages[assistantIndex] = {
          ...this.messages[assistantIndex]!,
          isStreaming: false,
          mode,
        };
        if (invokeRequestId) {
          await finalizeAdkInvokeRequestLog({
            requestId: invokeRequestId,
            status: "completed",
            output: {
              sessionId: this.adkSessionId ?? undefined,
              resolvedModel:
                resolveGeminiApiModelName(modelSelection) ?? undefined,
            },
          });
        }

        this.persistHistory();
      } catch (error) {
        log("ERROR", "[enAiStudioAssistant] ADK path failed", error);
        const message =
          error instanceof Error
            ? error.message
            : "ADK エージェントでエラーが発生しました";
        this.lastError = message;
        this.messages[assistantIndex] = {
          ...this.messages[assistantIndex]!,
          text: formatErrorForDisplay(message),
          isStreaming: false,
        };
        if (typeof invokeRequestId === "string") {
          await finalizeAdkInvokeRequestLog({
            requestId: invokeRequestId,
            status: "error",
            errorMessage: message,
          });
        }
      } finally {
        this.isStreaming = false;
      }
    },

    /** mode 別 (上書き env) → base URL の順で ADK エンドポイントを解決. */
    resolveAdkEndpoint(mode: AdkMode): string {
      const { $config } = useNuxtApp();
      const pub = $config.public as Record<string, unknown>;
      const perMode =
        mode === "writing"
          ? (pub.enAiStudioAdkWritingUrl as string | undefined)
          : mode === "sheet"
            ? (pub.enAiStudioAdkSheetUrl as string | undefined)
            : mode === "image"
              ? (pub.enAiStudioAdkImageUrl as string | undefined)
              : mode === "consultation"
                ? (pub.enAiStudioAdkConsultationUrl as string | undefined)
                : undefined;
      const base = pub.enAiStudioAdkBaseUrl as string | undefined;
      const chosen =
        (perMode && perMode.trim()) || (base && base.trim()) || "";
      return chosen.replace(/\/+$/, "");
    },

    /** Firebase ID Token を best-effort で取得. 失敗時は null を返す. */
    async getFirebaseIdToken(): Promise<string | null> {
      try {
        const { getAuth } = await import("firebase/auth");
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return null;
        return await user.getIdToken();
      } catch (error) {
        log(
          "WARN",
          "[enAiStudioAssistant] failed to get Firebase ID token",
          error
        );
        return null;
      }
    },

    /** localStorage への履歴永続化 (Space スコープ) */
    persistHistory(): void {
      if (import.meta.server) return;
      const spaceId = this.persistedForSpaceId;
      if (!spaceId) return;
      try {
        const payload = {
          sessionMode: this.sessionMode,
          messages: this.messages.slice(-MAX_PERSISTED_MESSAGES),
        };
        localStorage.setItem(buildHistoryKey(spaceId), JSON.stringify(payload));
      } catch (error) {
        log("WARN", "[enAiStudioAssistant] persistHistory failed", error);
      }
    },

    /**
     * Space 切替時 / 初回 mount 時に呼ぶ。
     * 1) 新キーの履歴を読む
     * 2) 無ければ旧 operationAssistant のキーから移行する (1 回だけ)
     * 3) FileSearch 用の default FileSpace を裏で解決する
     */
    hydrateForSpace(spaceId: string | null): void {
      if (import.meta.server) return;
      if (this.persistedForSpaceId === spaceId) return;
      this.persistedForSpaceId = spaceId;
      // Space が変わったら FileSpace も再解決する
      this.defaultFileSpaceId = null;
      if (spaceId) {
        // 非同期で解決 (await しない: UI を止めない)
        void this.ensureDefaultFileSpace();
      }
      if (!spaceId) {
        this.messages = [];
        this.sessionMode = null;
        return;
      }
      try {
        const raw = localStorage.getItem(buildHistoryKey(spaceId));
        if (raw) {
          const parsed = JSON.parse(raw) as {
            sessionMode?: EnAiStudioSessionMode;
            messages?: EnAiStudioAssistantMessage[];
          };
          if (parsed && Array.isArray(parsed.messages)) {
            this.messages = parsed.messages.map((m) => ({
              ...m,
              isStreaming: false,
            }));
            this.sessionMode = parsed.sessionMode ?? null;
            return;
          }
        }

        // 新キーに履歴なし → 旧 operationAssistant キーをマイグレート
        const legacyRaw = localStorage.getItem(buildLegacyHistoryKey(spaceId));
        if (legacyRaw) {
          const legacyParsed = JSON.parse(legacyRaw) as Array<{
            role: "user" | "assistant";
            text: string;
            id: string;
            createdAt: number;
          }>;
          if (Array.isArray(legacyParsed)) {
            this.messages = legacyParsed.map((m) => ({
              ...m,
              isStreaming: false,
              mode: undefined,
            }));
            this.sessionMode = null;
            this.persistHistory();
            log(
              "INFO",
              "[enAiStudioAssistant] migrated legacy operationAssistant history",
              { spaceId, count: legacyParsed.length }
            );
            return;
          }
        }

        this.messages = [];
        this.sessionMode = null;
      } catch (error) {
        log("WARN", "[enAiStudioAssistant] hydrate failed", error);
        this.messages = [];
        this.sessionMode = null;
      }
    },
  },
});
