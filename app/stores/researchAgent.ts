import { defineStore } from "pinia";
import { getAuth } from "firebase/auth";
import log from "@utils/logger";
import {
  fetchSessionArtifacts,
  subscribeSessionArtifacts,
} from "@composables/useAdkSessionArtifacts";
import {
  createAdkInvokeRequest,
  watchAdkInvokeRequest,
} from "@composables/useAdkInvokeRequest";
import {
  fetchAdkSessionState,
  subscribeActiveAdkSession,
  subscribeAiStudioSessions,
  useAiStudioSessions,
} from "@composables/useAiStudioSessions";
import type { AiStudioMessage } from "@stores/aiStudio";
import { buildAdkInvokeInput } from "@utils/adkInvokeInputBuilder";
import {
  buildResearchModeState,
  researchAgentStateFromSessionState,
  researchStudioFieldsFromAgentState,
  type ResearchStudioFields,
} from "@utils/researchStudioState";
import { researchGoldenToEffectiveFlat } from "@utils/goldenTaskBucket";
import { resolveAdkSessionScope } from "@composables/useAdkSessionScope";
import type { DecodedAdkSessionArtifact } from "@models/adkSessionArtifact";
import {
  buildResearchPlanBriefingInvokePrompt,
  buildResearchPlanFromBriefing,
  buildResearchPlanLaunchPrompt,
  type ResearchPlanContextHint,
  type ResearchPlanDraft,
} from "@utils/researchPlanDraft";
import {
  persistResearchWorkflowToSession,
  readResearchWorkflowFromFlatState,
} from "@utils/researchWorkflowState";

export type ResearchWorkflowPhase =
  | "plan_generating"
  | "plan_review"
  | "confirm_submit"
  | "generating"
  | "submitted"
  | "done"
  | "failed";

/**
 * Slides Generator Agent (ADK / Cloud Run) のフロント側 store.
 *
 * 通信先:
 *   - 自前 Cloud Run サービス `enostech-research-agent` (runtimeConfig.public.researchAgentServiceUrl)
 *   - 認証: Firebase ID Token を Authorization Bearer で都度送る
 *   - BYOK: 各ユーザーが「設定 > API キー」で登録した Gemini API キーをサーバ側で読み出して使う
 *
 * UX:
 *   - チャット風 UI: ユーザー発話 / エージェント発話 / tool 呼び出し / アーティファクト を時系列で表示
 *   - Phase Timeline (2026-05 大胆刷新後):
 *       1: hearing → 1.8: research (json) → 2: svg 生成 → 3: research.html 化
 *   - Artifacts: Firebase Storage の getDownloadURL でダウンロード / プレビュー
 */

// ─── 型 ────────────────────────────────────────────

export type ResearchAgentMessageRole = "user" | "agent" | "tool" | "system";

export interface ResearchAgentToolCall {
  name: string;
  args?: Record<string, unknown>;
}
export interface ResearchAgentToolResult {
  name: string;
  response?: Record<string, unknown>;
}

export interface ResearchAgentMessage {
  id: string;
  role: ResearchAgentMessageRole;
  /** Markdown を含む生テキスト (assistant の場合は SSE で逐次追記される) */
  text: string;
  toolCall?: ResearchAgentToolCall;
  toolResult?: ResearchAgentToolResult;
  createdAt: number;
  isStreaming?: boolean;
  /** 自動進行モードで AI が生成したユーザー代理発話 (UI でバッジ表示) */
  isAuto?: boolean;
}

export interface ResearchAgentArtifact {
  artifactId: string;
  kind: string; // "pptx" | "plan_json" | "narration" | "html" | "package" | "image" | "other"
  name: string;
  /** Canonical Firebase Storage path (gs://...) */
  storageGcsPath: string;
  /** @deprecated use storageGcsPath */
  gcsPath: string;
  bytes: number;
  contentType: string;
  generatedAt: number;
  status?: "syncing" | "ready" | "failed";
}

/**
 * 2026-05 大胆刷新: 旧 PPTX パイプライン (phase2_design / phase3_build / phase4_qa) を全廃し、
 * research.{json,html} 2 ファイル体制に集約.
 * - phase1_hearing:    Phase 1 ヒアリング (sub_agent)
 * - phase1_8_research: Phase 1.8 リサーチ (sub_agent / research.json を structured output 出力)
 * - phase2_svg:        Phase 2 図解生成 (Coordinator atomic, generate_svgs_tool)
 * - phase3_html:       Phase 3 読み物化 (Coordinator atomic, build_research_html_tool)
 */
export type ResearchAgentPhaseKey =
  | "phase1_hearing"
  | "phase1_8_research"
  | "phase2_svg"
  | "phase3_html";

export type ResearchAgentPhaseStatus = "idle" | "running" | "done" | "failed";

export interface ResearchAgentPhase {
  key: ResearchAgentPhaseKey;
  label: string;
  status: ResearchAgentPhaseStatus;
  startedAt: number | null;
  completedAt: number | null;
}

export interface SessionListItem {
  sessionId: string;
  theme: string | null;
  currentPhase: string | null;
  status: string;
  updatedAt: number;
  artifacts: ResearchAgentArtifact[];
}

/**
 * 問いの明確化セッション (ADK 起動前) の下書き.
 * テーマ + Question (sections) + 疑問 (concerns) の 3 要素のみ.
 */
export interface ResearchAgentBriefingDraft {
  theme: string;
  /** Question — research.json sections[] に対応 */
  questions: string[];
  /** 疑問 — research.json concerns[] に対応 */
  doubts: string[];
  /** 完了通知メール (ログインアドレスに縛らない) */
  notificationEmail?: string;
  /** @deprecated 旧 briefing 互換 */
  audience?: string;
  useCase?: string;
  concerns?: string[];
  purpose?: string;
}

/** 1=テーマ / 2=知りたいこと / 3=最終確認画面 */
export type ResearchAgentBriefingStep = 1 | 2 | 3;

/**
 * ADK エージェント側 update_progress_tool が session.state.progress_history に
 * 蓄積している進捗ログのエントリ. tool / phase / step / ts などを持つ.
 * 形は agent 側で自由なので Record<string, unknown> で受ける.
 */
export interface ProgressHistoryEntry {
  ts?: number | string;
  ts_unix?: number;
  phase?: string;
  step?: string;
  tool?: string;
  status?: string;
  message?: string;
  note?: string;
  [key: string]: unknown;
}

/** ADK session.state.job_log の 1 行 (ターミナル UI 用) */
export interface ResearchJobLogEntry {
  ts?: string;
  ts_unix?: number;
  level?: string;
  tag?: string;
  message?: string;
  note?: string;
  [key: string]: unknown;
}

// ─── 定数 ──────────────────────────────────────────

export const PHASE_LABELS: Record<ResearchAgentPhaseKey, string> = {
  phase1_hearing: "Phase 1 ヒアリング",
  phase1_8_research: "Phase 2 リサーチ",
  phase2_svg: "Phase 3 図解生成",
  phase3_html: "Phase 4 読み物化",
};

export const PHASE_ORDER: ResearchAgentPhaseKey[] = [
  "phase1_hearing",
  "phase1_8_research",
  "phase2_svg",
  "phase3_html",
];

// tool 名 → Phase 推定 (進捗タイムラインの自動更新用)
export const TOOL_PHASE_MAP: Record<string, ResearchAgentPhaseKey> = {
  ensure_deck_dir_tool: "phase1_hearing",
  save_research_tool: "phase1_8_research",
  generate_svgs_tool: "phase2_svg",
  build_research_html_tool: "phase3_html",
};

const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Briefing 下書きの localStorage キー (ページリロード越しで draft を維持) */
const BRIEFING_STORAGE_KEY = "en-aistudio:researchAgent:briefingDraft";
const emptyBriefingDraft = (): ResearchAgentBriefingDraft => ({
  theme: "",
  questions: [],
  doubts: [],
});

/**
 * 旧 draft (purpose 単一フィールド) を新 draft (audience + useCase) に変換.
 * localStorage に古い draft が残っていても起動できるように.
 */
const migrateBriefingDraft = (
  raw: Partial<ResearchAgentBriefingDraft> | null | undefined,
): ResearchAgentBriefingDraft => {
  const base = emptyBriefingDraft();
  if (!raw) return base;
  base.theme = typeof raw.theme === "string" ? raw.theme : base.theme;
  base.questions = Array.isArray(raw.questions)
    ? raw.questions.filter((q): q is string => typeof q === "string")
    : base.questions;
  if (Array.isArray(raw.doubts)) {
    base.doubts = raw.doubts.filter((d): d is string => typeof d === "string");
  } else if (Array.isArray(raw.concerns)) {
    base.doubts = raw.concerns.filter((c): c is string => typeof c === "string");
  } else if (typeof raw.concerns === "string") {
    const t = raw.concerns.trim();
    base.doubts = t ? [t] : [];
  }
  return base;
};

const initialPhases = (): ResearchAgentPhase[] =>
  PHASE_ORDER.map((key) => ({
    key,
    label: PHASE_LABELS[key],
    status: "idle",
    startedAt: null,
    completedAt: null,
  }));

// ─── store ─────────────────────────────────────────

export const useResearchAgentStore = defineStore("researchAgent", {
  state: () => ({
    sessionId: null as string | null,
    uid: null as string | null,
    isStreaming: false,
    messages: [] as ResearchAgentMessage[],
    phases: initialPhases(),
    artifacts: [] as ResearchAgentArtifact[],
    lastError: null as string | null,
    /** 既存セッション一覧 (履歴モーダル用) */
    sessions: [] as SessionListItem[],
    abortController: null as AbortController | null,
    artifactSubscriptionUnsubscribe: null as (() => void) | null,
    enAiStudioUiUnsubscribe: null as (() => void) | null,
    /** API キー未登録エラーを UI で個別ハンドリングするためのフラグ */
    needsApiKeyRegistration: false,

    /**
     * ADK エージェント側 session.state ミラー (フロント表示用).
     * SSE event の actions.state_delta で逐次更新される.
     * 中でも `progress_history` が「実行ログ」タブのソース.
     */
    agentState: {} as Record<string, unknown>,

    // ─── 自動進行モード ────────────────────────────
    /**
     * 自動進行 ON のとき、ADK が応答した直後に文脈を考慮した
     * ユーザー代理応答を Gemini Flash で生成して自動で送り返す。
     * 都度承認モードの ADK エージェントを実質自律稼動させる。
     *
     * 2026-05: 既定値を **true** に変更. 多くのユーザーは briefing で十分情報を
     * 与えてから AI に任せたいので、新規セッションでは auto ON で始まる方が UX 上自然.
     * API キーが未登録 / 生成失敗時は _autoRespondIfNeeded のエラーハンドリングで
     * 自動的に false に落ちるので安全.
     */
    autoMode: true,
    /** 自動進行で連続実行したターン数 (暴走防止カウンタ) */
    autoTurnCount: 0,
    /** 自動進行の連続ターン上限 (これを超えたら強制 OFF) */
    autoMaxTurns: 30,
    /** Gemini Flash を叩いて auto reply 生成中かどうか */
    isAutoResponding: false,
    /** auto reply 生成の中断用 */
    autoAbortController: null as AbortController | null,
    /** ユーザーが登録した Gemini API キー (auto reply 生成にだけ使う; キャッシュ) */
    userApiKey: null as string | null,

    /**
     * 「completion トースト 1 回だけ発火」用のフラグ.
     * isCompleted が true になったあと indicator が consumeCompletion() を呼ぶと
     * true に切り替わり、それ以降 justCompleted は false を返す.
     * reset / startSession / resumeSession のたびに false にリセットされる.
     */
    _completionConsumed: false,

    // ─── Briefing Session (問いの明確化) ─────────────
    /** 下書き: localStorage 同期。完了 (finalizeBriefing) で消える. */
    briefingDraft: emptyBriefingDraft() as ResearchAgentBriefingDraft,
    /** 1..4 が各 step、5 が最終確認画面. */
    briefingStep: 1 as ResearchAgentBriefingStep,
    /** 完了 (整形プロンプトを送信済み) で true. UI が briefing からキオスクへ切替. */
    briefingComplete: false,

    /**
     * AI 動的 chip 候補 (step 2/3/4 のみ).
     * step 1 は static chips だけ (テーマ前なので AI 文脈が無い).
     * 永続化しない (毎セッション再生成).
     */
    briefingSuggestions: {} as Partial<Record<2 | 3 | 4 | 5, string[]>>,
    /** AI 候補生成中フラグ (step ごと). */
    loadingSuggestions: {} as Partial<Record<2 | 3 | 4 | 5, boolean>>,
    /** Step 4 (疑問) の chip 追加時に AI が文章整形 + 関連質問追加中かどうか */
    polishingQuestion: false,
    /** Step 5 (懸念点) の chip 追加時に AI が文章整形 + 関連懸念追加中かどうか */
    polishingConcern: false,

    /** キオスク型ワークフロー: briefing 後 plan 確認 → 生成 → 完了 */
    researchWorkflowPhase: null as ResearchWorkflowPhase | null,
    researchPlanDraft: null as ResearchPlanDraft | null,
    /** confirmResearchPlan の二重起動防止 */
    _researchLaunchInFlight: false,
    /** キオスク一気通貫: 1 invoke でサーバーがパイプライン完走 (autoMode 不使用) */
    researchPipelineAutonomous: false,
    /** plan_only invoke — プラン素案を state に書き込むのみ */
    researchPlanOnly: false,
    /** バックグラウンド invoke 監視の解除関数 */
    invokeWatchUnsubscribe: null as (() => void) | null,
    /** 受付完了画面用: ログインユーザーの通知先メール */
    notificationEmail: null as string | null,
  }),
  getters: {
    hasMessages: (state) => state.messages.length > 0,
    currentPhase: (state) =>
      state.phases.find((p) => p.status === "running") ||
      [...state.phases].reverse().find((p) => p.status === "done"),
    isCompleted: (state) => {
      const hasHtmlArtifact = state.artifacts.some(
        (a) =>
          a.kind === "html" ||
          /research\.html$/i.test(a.name ?? "") ||
          /research\.html$/i.test(a.artifactId ?? "") ||
          /research\.html$/i.test(a.storageGcsPath ?? ""),
      );
      if (hasHtmlArtifact) return true;
      const htmlPath = state.agentState.research_html_path;
      return typeof htmlPath === "string" && /research\.html/i.test(htmlPath);
    },
    /**
     * グローバルインジケーターから「完了通知トースト」を 1 回だけ発火するための getter.
     * isCompleted (terminal 到達) かつまだ consume されていない場合だけ true.
     */
    justCompleted(state): boolean {
      const completed =
        state.phases.every((p) => p.status === "done") &&
        state.artifacts.length > 0;
      return completed && !state._completionConsumed;
    },
    /** session.state.progress_history を表示用に取り出す */
    progressHistory: (state): ProgressHistoryEntry[] => {
      const raw = state.agentState["progress_history"];
      if (Array.isArray(raw)) return raw as ProgressHistoryEntry[];
      return [];
    },
    /** session.state.job_log を表示用に取り出す */
    jobLog: (state): ResearchJobLogEntry[] => {
      const raw = state.agentState["job_log"];
      if (Array.isArray(raw)) return raw as ResearchJobLogEntry[];
      return [];
    },
  },
  actions: {
    _sessionScope(): { organizationId: string; spaceId: string } {
      const organizationStore = useOrganizationStore();
      const spaceStore = useSpaceStore();
      const organizationId =
        organizationStore.loggedInOrganizationInfo?.id?.trim() ?? "";
      const spaceId = spaceStore.selectedSpace?.id?.trim() ?? "";
      if (!organizationId || !spaceId) {
        throw new Error(
          "organizationId and spaceId are required for research agent sessions"
        );
      }
      return { organizationId, spaceId };
    },

    // ─── セッション管理 (Firestore adkSessions のみ) ──

    /** 進行中の invoke / auto-reply を止める (autoMode は維持). */
    _abortActiveRequests(): void {
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
        this.isStreaming = false;
      }
      if (this.autoAbortController) {
        this.autoAbortController.abort();
        this.autoAbortController = null;
        this.isAutoResponding = false;
      }
    },

    async startSession(initialPrompt?: string): Promise<void> {
      // 明示的 reset() とは分離 — プラン確認 → 生成の途中で session だけ作る経路がある
      // cancelStream() は autoMode を OFF にするので、新規セッション開始では使わない
      this._abortActiveRequests();
      this._stopArtifactSubscription();
      this._stopEnAiStudioUiSubscription();

      this._sessionScope();
      const sessionId = createId();
      const sessions = useAiStudioSessions();
      await sessions.create({
        sessionId,
        jobKind: "research",
        activeAgent: "research",
        messages: [],
        researchCurrentPhase: "phase1_hearing",
        researchTheme:
          initialPrompt?.trim() ||
          this.researchPlanDraft?.deck.title ||
          null,
        researchAutoMode: this.autoMode,
      });
      this.sessionId = sessionId;
      const state = await fetchAdkSessionState(sessionId);
      if (state) {
        this.agentState = researchAgentStateFromSessionState(state);
      }
      subscribeAiStudioSessions();
      this._ensureArtifactSubscription();
      this.ensureEnAiStudioUiSubscription();
      log("INFO", "[researchAgent] session started (Firestore)", {
        sessionId: this.sessionId,
      });
    },

    async listSessions(): Promise<void> {
      subscribeAiStudioSessions();
      const sessions = useAiStudioSessions();
      this.sessions = sessions
        .list()
        .filter((item) => item.jobKind === "research")
        .map((item) => ({
          sessionId: item.sessionId,
          theme: item.researchTheme ?? item.title ?? null,
          currentPhase: item.researchCurrentPhase ?? null,
          status: item.status,
          updatedAt: item.updatedAt,
          artifacts: [],
        }));
    },

    async resumeSession(sessionId: string): Promise<void> {
      this.reset();
      const sessions = useAiStudioSessions();
      const record = await sessions.get(sessionId);
      if (!record) {
        throw new Error("セッションが見つかりません");
      }
      this.sessionId = sessionId;
      const state = (await fetchAdkSessionState(sessionId)) ?? {};
      this.agentState = researchAgentStateFromSessionState(state);
      this.messages = record.messages.map((m, i) => ({
        id: m.id || `${sessionId}-${i}`,
        role: m.role === "user" ? "user" : "agent",
        text: m.text,
        createdAt: m.createdAt ?? Date.now(),
        isStreaming: m.isStreaming === true,
      }));
      this.autoMode = record.researchAutoMode === true;
      this.artifacts = [];
      this._ensureArtifactSubscription();
      this.ensureEnAiStudioUiSubscription();
      const currentPhaseKey = (record.researchCurrentPhase ||
        (this.agentState.current_phase as string) ||
        "") as ResearchAgentPhaseKey;
      this._restorePhasesUpTo(currentPhaseKey);
      if (this.messages.length > 0) {
        this.briefingComplete = true;
      }
      this._applyWorkflowFromSessionState(state);
      if (!this.researchWorkflowPhase) {
        if (this.isCompleted) {
          this.researchWorkflowPhase = "done";
        } else if (this.messages.length > 0) {
          this.researchWorkflowPhase = "submitted";
        }
      }
      if (!this.notificationEmail) {
        this.notificationEmail = getAuth().currentUser?.email ?? null;
      }
    },

    /** AIスタジオから新規 research セッションを開く (Firestore doc は aiStudio が作成済み) */
    prepareNewSession(params: { sessionId: string }): void {
      this._abortActiveRequests();
      this._stopArtifactSubscription();
      this._stopEnAiStudioUiSubscription();
      this._stopInvokeBackgroundWatch();
      this.sessionId = params.sessionId;
      this.messages = [];
      this.phases = initialPhases();
      this.artifacts = [];
      this.agentState = {};
      this.lastError = null;
      this.needsApiKeyRegistration = false;
      this.autoMode = false;
      this.autoTurnCount = 0;
      this.isAutoResponding = false;
      this._completionConsumed = false;
      this.briefingComplete = false;
      this.researchWorkflowPhase = null;
      this.researchPlanDraft = null;
      this.researchPipelineAutonomous = false;
      this.researchPlanOnly = false;
      this.notificationEmail = getAuth().currentUser?.email ?? null;
      this.resetBriefing();
      this._ensureArtifactSubscription();
      this.ensureEnAiStudioUiSubscription();
      subscribeAiStudioSessions();
    },

    /** Firestore onSnapshot 補完 — ポーリングで state / phase をマージ */
    async pollSessionState(): Promise<void> {
      if (!this.sessionId) return;
      if (this.isStreaming) return;
      const state = await fetchAdkSessionState(this.sessionId);
      if (!state) return;
      this.agentState = {
        ...this.agentState,
        ...researchAgentStateFromSessionState(state),
      };
      const phaseKey = String(
        this.agentState.current_phase ?? ""
      ) as ResearchAgentPhaseKey;
      if (phaseKey) this._restorePhasesUpTo(phaseKey);
    },

    /** justCompleted を消化して二度目以降は false を返すようにする */
    consumeCompletion(): void {
      this._completionConsumed = true;
    },

    /** state.current_phase に基づき、それ以前の Phase を done にしておく */
    _restorePhasesUpTo(phaseKey: ResearchAgentPhaseKey | ""): void {
      if (!phaseKey || !PHASE_ORDER.includes(phaseKey)) return;
      const idx = PHASE_ORDER.indexOf(phaseKey);
      const nowTs = Date.now();
      this.phases = this.phases.map((p, i) => {
        if (i < idx) {
          return { ...p, status: "done" as const, completedAt: nowTs };
        }
        if (i === idx) {
          return { ...p, status: "running" as const, startedAt: nowTs };
        }
        return p;
      });
    },

    async deleteSession(sessionId: string): Promise<void> {
      const sessions = useAiStudioSessions();
      await sessions.remove(sessionId);
      this.sessions = this.sessions.filter((s) => s.sessionId !== sessionId);
      if (this.sessionId === sessionId) this.reset();
    },

    // ─── メッセージ送信 (SSE) ────────────────────

    async send(text: string, opts: { isAuto?: boolean } = {}): Promise<void> {
      if (!this.sessionId) {
        await this.startSession(text);
      }
      const sessionId = this.sessionId!;
      const userMsg: ResearchAgentMessage = {
        id: createId(),
        role: "user",
        text,
        createdAt: Date.now(),
        isAuto: opts.isAuto === true,
      };
      const assistantMsg: ResearchAgentMessage = {
        id: createId(),
        role: "agent",
        text: "",
        createdAt: Date.now(),
        isStreaming: true,
      };
      const assistantIndex = this.messages.length + 1;
      this.messages.push(userMsg, assistantMsg);
      this.isStreaming = true;
      this.lastError = null;

      this.abortController = new AbortController();

      try {
        await this._sendViaRequestDoc({
          text,
          sessionId,
          assistantIndex,
          assistantMsgId: assistantMsg.id,
        });
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const msg = this._humanizeErrorMessage(raw);
        this.lastError = msg;
        log("ERROR", "[researchAgent] send failed", e);
        const cur = this.messages[assistantIndex];
        if (cur) {
          this.messages[assistantIndex] = {
            ...cur,
            text: cur.text + (cur.text ? "\n\n" : "") + `⚠️ エラー: ${msg}`,
            isStreaming: false,
          };
        }
      } finally {
        this.isStreaming = false;
        this.abortController = null;
        const cur = this.messages[assistantIndex];
        if (cur && cur.isStreaming) {
          this.messages[assistantIndex] = { ...cur, isStreaming: false };
        }
      }

      // ─── 自動進行: ADK の応答が出揃ったら次の代理応答を生成 ────────
      // SSE 中の transient エラーで lastError が立つことがあるが、agent からの
      // 最後の発話 (= text を含む agent メッセージ) があれば auto は続行する.
      // ハード停止条件は: autoMode OFF / terminal / ターン上限 / 直近 agent 発話なし
      log("DEBUG", "[researchAgent] turn ended", {
        autoMode: this.autoMode,
        pipelineAutonomous: this.researchPipelineAutonomous,
        autoTurnCount: this.autoTurnCount,
        isTerminal: this._isTerminal(),
        lastError: this.lastError,
      });

      // キオスク一気通貫: サーバーが 1 invoke 内でターン継続するため FE auto は不要
      if (
        this.researchPipelineAutonomous &&
        this.researchWorkflowPhase === "generating"
      ) {
        return;
      }

      if (!this.autoMode) return;

      if (this.autoTurnCount >= this.autoMaxTurns) {
        this.autoMode = false;
        this.lastError = `自動進行を ${this.autoMaxTurns} ターンで自動停止しました。手動モードに切り替わりました。`;
        return;
      }
      if (this._isTerminal()) {
        log("INFO", "[researchAgent] terminal reached, auto-mode off");
        this.autoMode = false;
        return;
      }

      // 直近の agent 発話 / tool 呼び出しをチェック.
      // ADK + Gemini Flash は function_call のみ (text 空) のターンを頻発するため、
      // 「text が空 → 停止」は厳しすぎる. 以下のいずれかが直近に起きていれば続行する:
      //   - text を持つ agent メッセージがある (=本来の発話あり)
      //   - tool 呼び出し / transfer (= agent は動いているが text を省略しただけ)
      // どちらも無い場合だけ「沈黙」とみなして pause する.
      const recent = this.messages.slice(-6);
      const hasAgentText = recent.some(
        (m) => m.role === "agent" && !m.isStreaming && !!m.text,
      );
      const hasRecentToolActivity = recent.some(
        (m) => m.role === "tool" && !!m.toolCall?.name,
      );
      if (!hasAgentText && !hasRecentToolActivity) {
        log(
          "WARN",
          "[researchAgent] no agent text nor tool activity in recent turn, auto-mode paused",
        );
        return;
      }
      if (!hasAgentText && hasRecentToolActivity) {
        log(
          "DEBUG",
          "[researchAgent] agent text empty but tool activity present, continuing auto-mode",
        );
      }

      // SSE 中の軽微エラーは無視して続行 (lastError は表示用にだけ残す)
      // micro-task で 1 拍待って UI 更新を確実にする
      await Promise.resolve();
      await this._autoRespondIfNeeded();
    },

    cancelStream(): void {
      this._abortActiveRequests();
      // 中断時は auto モードも切る (ユーザー明示意図の尊重)
      this.autoMode = false;
    },

    // ─── Phase 進捗 ──────────────────────────────

    _markPhaseRunning(toolName: string): void {
      const phaseKey = TOOL_PHASE_MAP[toolName];
      if (!phaseKey) return;
      // この Phase より前の Phase は強制的に done に
      const idx = PHASE_ORDER.indexOf(phaseKey);
      this.phases = this.phases.map((p, i) => {
        if (i < idx && p.status === "idle") {
          return { ...p, status: "done", completedAt: Date.now() };
        }
        if (i === idx) {
          return {
            ...p,
            status: "running",
            startedAt: p.startedAt ?? Date.now(),
          };
        }
        return p;
      });
    },

    _markPhaseDone(toolName: string): void {
      const phaseKey = TOOL_PHASE_MAP[toolName];
      if (!phaseKey) return;
      // 完全な Phase 完了判定は難しい (1 Phase 内に複数 tool がある) ので、
      // とりあえず running → done に持ち上げる。次の tool で次 Phase に移れば
      // 自然に done になる。
      // 但し最終ツール (Phase 4 build_deck_package_tool) だけは明示的に done。
      if (toolName === "build_deck_package_tool") {
        this.phases = this.phases.map((p) =>
          p.key === phaseKey
            ? { ...p, status: "done", completedAt: Date.now() }
            : p,
        );
      }
    },

    // ─── 自動進行モード ────────────────────────────

    /**
     * ユーザーの Gemini API キーを Firestore `users/{uid}/secrets/geminiApiKey`
     * から読み出してメモリにキャッシュ. auto reply 生成にだけ使う.
     * (BYOK: バックエンド側でも同じ doc を読んで ADK エージェントを駆動している)
     */
    async loadUserApiKey(): Promise<string | null> {
      const byok = useGeminiByokStore();
      const k = await byok.loadUserApiKey();
      this.userApiKey = k;
      return k;
    },

    /**
     * 自動進行モードを ON/OFF する.
     * ON にして直近のエージェント発話が未応答なら、その場で代理応答ループを起動.
     */
    async setAutoMode(on: boolean): Promise<void> {
      if (this.autoMode === on) return;
      this.autoMode = on;
      if (on) {
        this.autoTurnCount = 0;
        // API キーが無いとそもそも生成できないので先に確認
        const key = await this.loadUserApiKey();
        if (!key) {
          this.needsApiKeyRegistration = true;
          this.autoMode = false;
          this.lastError =
            "自動進行には Gemini API キーが必要です。設定で登録してください。";
          return;
        }
        // 直近メッセージが agent で発話済 (= 返答待ち) なら即座に代理応答
        const last = this.messages[this.messages.length - 1];
        if (
          last &&
          last.role === "agent" &&
          !last.isStreaming &&
          last.text &&
          !this.isStreaming
        ) {
          await this._autoRespondIfNeeded();
        }
      } else {
        // OFF にしたら進行中の auto reply 生成は中断
        if (this.autoAbortController) {
          this.autoAbortController.abort();
          this.autoAbortController = null;
        }
        this.isAutoResponding = false;
      }
    },

    /**
     * 終端条件判定. Phase 4 完了 / 最終アーティファクト (PPTX or ZIP) 出現で終わり.
     */
    _isTerminal(): boolean {
      if (this._hasResearchDeliverables()) return true;
      // 全 Phase が done
      if (this.phases.every((p) => p.status === "done")) return true;
      // 最終成果物が出ている
      if (
        this.artifacts.some(
          (a) => a.kind === "package" || a.kind === "pptx",
        ) &&
        this.phases.some((p) => p.key === "phase4_qa" && p.status === "done")
      ) {
        return true;
      }
      return false;
    },

    _hasResearchDeliverables(): boolean {
      return this.artifacts.some(
        (a) =>
          a.kind === "html" ||
          /research\.html$/i.test(a.name ?? "") ||
          /research\.html$/i.test(a.artifactId ?? ""),
      );
    },

    /**
     * キオスク型リサーチ: 成果物未生成のままエージェントが完了/挨拶だけするのを防ぐ.
     * 決め打ち返答があれば Gemini Flash を呼ばずに返す.
     */
    _buildResearchKioskAutoReply(params: { agentText: string }): string | null {
      if (this.researchWorkflowPhase !== "generating") return null;
      if (this._hasResearchDeliverables()) return null;

      const t = params.agentText;
      const claimsComplete =
        /完成しました|完了しました|生成されました|リサーチレポートが|research\.html/i.test(
          t,
        );
      const closing =
        /セッションを終了|失礼いたします|またのご利用|お待ちしております/i.test(
          t,
        );
      const thanksLoop =
        /^ありがとうございました[。!]?$/.test(t.trim()) ||
        (t.includes("ありがとうございました") && t.length < 160);

      if (claimsComplete || closing || thanksLoop) {
        return "成果物ファイル（research.json と research.html）がアウトプットにまだありません。ツールで実ファイルを生成・保存してから完了報告してください。";
      }

      if (/schema 違反|Zod 検証|再出力を依頼|fatal.*件検出/i.test(t)) {
        return "はい、schema 違反を修正して research.json を再出力してください。続けてください。";
      }

      if (/進めて|良いですか|OKですか|承認|続けて|次へ/i.test(t)) {
        return "はい、進めてください。";
      }

      return null;
    },

    async _autoRespondIfNeeded(): Promise<void> {
      if (!this.autoMode) {
        log("DEBUG", "[researchAgent] _autoRespondIfNeeded: autoMode OFF, skip");
        return;
      }
      if (this.isStreaming || this.isAutoResponding) {
        log("DEBUG", "[researchAgent] _autoRespondIfNeeded: busy, skip", {
          isStreaming: this.isStreaming,
          isAutoResponding: this.isAutoResponding,
        });
        return;
      }
      if (this.autoTurnCount >= this.autoMaxTurns) {
        log("DEBUG", "[researchAgent] _autoRespondIfNeeded: max turns hit");
        return;
      }
      if (this._isTerminal()) {
        log("INFO", "[researchAgent] _autoRespondIfNeeded: terminal, auto off");
        this.autoMode = false;
        return;
      }
      // 直近の text 付き agent 発話を取得.
      // 直近 6 件以内に text 付き agent がいれば、それを文脈として auto reply を生成.
      // text なしターン (function_call only) が連続していても、もっと前の agent text を
      // 文脈として使えば auto を続けられる.
      const lastAgent = [...this.messages]
        .reverse()
        .find((m) => m.role === "agent" && !m.isStreaming && m.text);
      if (!lastAgent) {
        log(
          "WARN",
          "[researchAgent] _autoRespondIfNeeded: no agent text in history, skip",
        );
        return;
      }

      const kioskReply = this._buildResearchKioskAutoReply({
        agentText: lastAgent.text,
      });
      if (
        this.researchWorkflowPhase === "generating" &&
        !this._hasResearchDeliverables() &&
        this.autoTurnCount >= 45
      ) {
        this.lastError =
          "自動進行の上限に達しましたが、research.html が生成されませんでした。";
        this.autoMode = false;
        return;
      }

      this.isAutoResponding = true;
      this.autoAbortController = new AbortController();
      try {
        log("DEBUG", "[researchAgent] generating auto reply", {
          turn: this.autoTurnCount + 1,
          agentTextHead: lastAgent.text.slice(0, 80),
          kioskReply: kioskReply?.slice(0, 80) ?? null,
        });
        const reply =
          kioskReply ??
          (await this._generateAutoResponse(
            lastAgent.text,
            this.autoAbortController.signal,
          ));
        if (!this.autoMode) {
          log("DEBUG", "[researchAgent] auto mode toggled OFF during generation");
          return;
        }
        this.autoTurnCount += 1;
        log("INFO", "[researchAgent] auto reply ready", {
          turn: this.autoTurnCount,
          reply: reply.slice(0, 120),
        });
        // send() 内で次ターンの _autoRespondIfNeeded が再帰呼び出しされる。
        // ここで isAutoResponding=true のままだと再帰側でゲートに弾かれて
        // 連鎖が 1 ターンで止まるので、send 前に明示的にクリアしておく。
        // (send 内部は isStreaming で排他制御されるため二重実行は起きない)
        this.isAutoResponding = false;
        this.autoAbortController = null;
        await this.send(reply, { isAuto: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // AbortError は無視 (ユーザーが OFF にした等)
        if (msg.includes("aborted") || msg === "AbortError") return;
        log("ERROR", "[researchAgent] auto reply failed", e);
        this.lastError = `自動応答生成に失敗しました: ${msg}`;
        this.autoMode = false;
      } finally {
        this.isAutoResponding = false;
        this.autoAbortController = null;
      }
    },

    /**
     * Gemini Flash でユーザー代理応答を生成する.
     * 会話履歴 (直近 20 件) を contents に積み、systemInstruction で
     * 「あなたはこの会話のユーザー側」というロールを与える.
     */
    async _generateAutoResponse(
      _agentLatestText: string,
      signal: AbortSignal,
    ): Promise<string> {
      const apiKey = this.userApiKey || (await this.loadUserApiKey());
      if (!apiKey) {
        // キオスク型リサーチはチャット UI が無い — 承認系は決め打ちで続行
        if (this.researchWorkflowPhase === "generating") {
          return "はい、そのプランで進めてください。承認します。";
        }
        throw new Error("API キー未登録");
      }

      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey });

      // 直近 20 メッセージを contents に積む. tool / system は除外し
      // user ↔ model だけの平面会話に正規化する.
      const recent = this.messages
        .filter(
          (m) =>
            (m.role === "user" || m.role === "agent") &&
            !m.isStreaming &&
            !!m.text,
        )
        .slice(-20)
        .map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text }],
        }));

      // 「user → 代理 (= model 役) で返答する」シミュレーションだが、
      // 直近が model の発話なので、次に model 役で返答すると user 発話の
      // 自然な内容にならない。代わりに以下: contents の **role を反転** して
      // 流し、最後に model として「ユーザー視点の発話」を生成させる.
      const flipped = recent.map((c) => ({
        role: c.role === "user" ? "model" : "user",
        parts: c.parts,
      }));

      const kioskNoArtifacts =
        this.researchWorkflowPhase === "generating" &&
        !this._hasResearchDeliverables();

      const systemInstruction = `あなたは ENOSTECH リサーチエージェントと対話しているユーザーの**代理**です。
最初に与えたテーマを踏まえて、エージェントからの質問・確認に**ユーザー視点で**簡潔に応答してください。

ルール (絶対):
- 出力は 1〜3 文。敬語は不要、自然な日本語。Markdown 記法は使わない。
- Phase 1 (ヒアリング) でテーマ・読者・分量 (枚数) ・知りたい論点を聞かれたら、最初のテーマに沿った**具体的な回答**を 1 つずつ自然に出す。質問が複数同時のときは最重要な 1〜2 項目だけ答える。
- 承認系の質問 (「これで進めて良いですか?」「次のフェーズへ?」「承認しますか?」「続けて良いですか?」「次へ」「OK」) は**短く承認**: 「はい、お願いします」「OK、進めてください」「ありがとうございます、次へ」など。
- **エージェントが失敗・エラー報告 + 修正提案 を出してきたケース** (例「fatal 22 件検出、plan.json 修正が必要です。続けて良いですか?」「Zod 検証でエラー、修正します。OK ですか?」) も、それは**通常の進行**なので「はい、修正して進めてください」「OK、お願いします」と**短く承認**する。**絶対にやめさせない**。
- braindump.md や plan.json の中身を直接書き換える要求は出さない (エージェントに任せる)。
- 「やっぱりテーマを変えたい」「やり直したい」「キャンセル」「中止」「最初からやり直し」とは**絶対に言わない**。テーマや構成への不満も出さない (全部エージェントに任せる前提)。
- ${kioskNoArtifacts ? "**アウトプットに research.html がまだ無い限り**、エージェントが「完成しました」と言っても**信じない**。その場合は「成果物ファイル（research.json / research.html）をツールで保存してから完了報告してください」と返す。感謝やセッション終了の挨拶には乗らない。" : "すでに最終成果物 (PPTX / ZIP / deck-package / research.html) が完成した合図が来たら「ありがとうございました、これで OK です」と短く返す。"}
- 質問の意図が曖昧、または ヒアリング段階で具体例が思いつかなければ「お任せします、進めてください」と回答する。

エージェントとの会話履歴 (あなたが user 役):
※注: 上の contents は role を反転して見せています (あなたから見て自分が user)。
最新の **エージェントからの発話** に対する、あなた (= user) の次の発話を 1〜3 文で出力してください。`;

      const resp = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: flipped as any,
        config: {
          systemInstruction,
          temperature: 0.5,
        },
        // @ts-expect-error: SDK 型に signal が未定義の場合があるが実装は対応
        signal,
      });
      const text = (resp.text || "").trim();
      // 安全 fallback (空文字や極端に長い応答を防ぐ)
      if (!text) return "はい、進めてください。";
      if (text.length > 400) return text.slice(0, 400);
      return text;
    },

    // ─── Briefing Session (問いの明確化) ─────────────

    /**
     * localStorage から briefing 下書きを復元.
     * BriefingSession コンポーネントの onMounted で呼ぶ.
     * SSR では何もしない (Nuxt SPA だが念のため).
     */
    hydrateBriefing(): void {
      if (!import.meta.client) return;
      try {
        const raw = localStorage.getItem(BRIEFING_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            draft?: Partial<ResearchAgentBriefingDraft>;
            step?: number;
          };
          if (parsed.draft) {
            // migration helper で旧 purpose → useCase に救済
            this.briefingDraft = migrateBriefingDraft(parsed.draft);
          }
          if (
            typeof parsed.step === "number" &&
            parsed.step >= 1 &&
            parsed.step <= 3
          ) {
            this.briefingStep = parsed.step as ResearchAgentBriefingStep;
          }
        }
        // 廃止した「従来モード」フラグを掃除
        localStorage.removeItem("en-aistudio:researchAgent:briefingSkipped");
      } catch (e) {
        log("WARN", "[researchAgent] hydrateBriefing failed", e);
      }
    },

    _persistBriefing(): void {
      if (!import.meta.client) return;
      try {
        localStorage.setItem(
          BRIEFING_STORAGE_KEY,
          JSON.stringify({ draft: this.briefingDraft, step: this.briefingStep }),
        );
      } catch (e) {
        log("WARN", "[researchAgent] persistBriefing failed", e);
      }
    },

    _clearBriefingStorage(): void {
      if (!import.meta.client) return;
      try {
        localStorage.removeItem(BRIEFING_STORAGE_KEY);
      } catch {
        // ignore quota / private mode 失敗
      }
    },

    updateBriefingField<K extends keyof ResearchAgentBriefingDraft>(
      field: K,
      value: ResearchAgentBriefingDraft[K],
    ): void {
      this.briefingDraft = { ...this.briefingDraft, [field]: value };
      this._persistBriefing();
    },

    addBriefingQuestion(q: string): void {
      const trimmed = q.trim();
      if (!trimmed) return;
      if (this.briefingDraft.questions.includes(trimmed)) return;
      this.briefingDraft.questions = [...this.briefingDraft.questions, trimmed];
      this._persistBriefing();
    },

    removeBriefingQuestion(index: number): void {
      this.briefingDraft.questions = this.briefingDraft.questions.filter(
        (_, i) => i !== index,
      );
      this._persistBriefing();
    },

    addBriefingDoubt(d: string): void {
      const trimmed = d.trim();
      if (!trimmed) return;
      if (this.briefingDraft.doubts.includes(trimmed)) return;
      this.briefingDraft.doubts = [...this.briefingDraft.doubts, trimmed];
      this._persistBriefing();
    },

    removeBriefingDoubt(index: number): void {
      this.briefingDraft.doubts = this.briefingDraft.doubts.filter(
        (_, i) => i !== index,
      );
      this._persistBriefing();
    },

    /** @deprecated use addBriefingDoubt */
    addBriefingConcern(c: string): void {
      this.addBriefingDoubt(c);
    },

    /** @deprecated use removeBriefingDoubt */
    removeBriefingConcern(index: number): void {
      this.removeBriefingDoubt(index);
    },

    advanceBriefing(): void {
      if (this.briefingStep < 3) {
        this.briefingStep = (this.briefingStep + 1) as ResearchAgentBriefingStep;
        this._persistBriefing();
      }
    },

    backBriefing(): void {
      if (this.briefingStep > 1) {
        // 戻った場合、前提が変わる可能性があるので前方の AI 候補をクリアして再生成を促す
        this._invalidateForwardSuggestions(this.briefingStep);
        this.briefingStep = (this.briefingStep - 1) as ResearchAgentBriefingStep;
        this._persistBriefing();
      }
    },

    goToBriefingStep(step: ResearchAgentBriefingStep): void {
      if (step < this.briefingStep) {
        this._invalidateForwardSuggestions(step + 1);
      }
      this.briefingStep = step;
      this._persistBriefing();
    },

    _invalidateForwardSuggestions(fromStep: number): void {
      const next: Partial<Record<2 | 3 | 4 | 5, string[]>> = {};
      for (const k of [2, 3, 4, 5] as const) {
        if (k < fromStep && this.briefingSuggestions[k]) {
          next[k] = this.briefingSuggestions[k];
        }
      }
      this.briefingSuggestions = next;
    },

    /** Briefing 状態だけを完全初期化 (新規セッション開始時に呼ぶ). */
    resetBriefing(): void {
      this.briefingDraft = emptyBriefingDraft();
      this.briefingStep = 1;
      this.briefingComplete = false;
      this.researchWorkflowPhase = null;
      this.researchPlanDraft = null;
      this.briefingSuggestions = {};
      this.loadingSuggestions = {};
      this._clearBriefingStorage();
      if (import.meta.client) {
        try {
          localStorage.removeItem("en-aistudio:agentBriefing:researchAgent");
          localStorage.removeItem("en-aistudio:agentBriefing:researchAgent:skipped");
          localStorage.removeItem("en-aistudio:researchAgent:briefingSkipped");
        } catch {
          // ignore
        }
      }
    },

    /**
     * Briefing 4 項目から ADK Phase 1 ヒアリングが受け取れる整形プロンプトを生成.
     * フェーズ 1 hearing agent は theme / intent / questions を既に欲しがる構造なので、
     * これがそのまま「ほぼ確認 1 ターンで Phase 1.8 へ」進む素材になる.
     */
    /**
     * プロンプト出力時のサニタイズ:
     * - "pptx" を含む行は **行ごと削除** (PPTX 生成機能は廃止済み)
     * - 3 連以上の空行を 2 連に正規化
     *
     * ユーザーが付箋・編集モードで「PPTX で出力して」等と書いても、AI に渡る最終
     * テキストからは消す。Notion 風 research.html しか作らないので、矛盾指示を
     * 持ち込まれると Agent が混乱する.
     */
    _sanitizePromptText(text: string): string {
      return text
        .split("\n")
        .filter((line) => !/pptx/i.test(line))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd();
    },

    _buildBriefingPrompt(): string {
      const { theme, questions, doubts } = this.briefingDraft;
      const questionsBlock = questions.length
        ? questions.map((q) => `- ${q}`).join("\n")
        : "- (特になし)";
      const doubtsBlock = doubts.length
        ? doubts.map((d) => `- ${d}`).join("\n")
        : "- (特になし)";
      const raw = [
        "# テーマ",
        theme.trim() || "(未指定)",
        "",
        "# Question (sections[])",
        questionsBlock,
        "",
        "# 疑問 (concerns[])",
        doubtsBlock,
      ].join("\n");
      return this._sanitizePromptText(raw);
    },

    /**
     * AI 動的 chip 候補を gemini-flash で生成.
     * step に応じて以下を作る:
     *   step 2 (audience): theme を踏まえた読者候補
     *   step 3 (useCase):  theme + audience を踏まえた活用シーン候補
     *   step 4 (questions): theme + audience + useCase を踏まえた疑問候補
     *   step 5 (concerns):  theme + ... + questions を踏まえた懸念候補
     *
     * 失敗・キー未登録時は silent fail (static chips が出続けるだけ).
     */
    async generateBriefingSuggestions(
      targetStep: 2 | 3 | 4 | 5,
      opts: { force?: boolean } = {},
    ): Promise<void> {
      // 既にロード中ならスキップ
      if (this.loadingSuggestions[targetStep]) return;
      // キャッシュ済みかつ force でなければスキップ
      if (
        !opts.force &&
        (this.briefingSuggestions[targetStep]?.length ?? 0) > 0
      ) {
        return;
      }
      // 前提が揃ってなければスキップ
      if (targetStep >= 2 && !this.briefingDraft.theme.trim()) return;

      const apiKey = this.userApiKey || (await this.loadUserApiKey());
      if (!apiKey) {
        log("DEBUG", "[researchAgent] suggestions skipped: no API key");
        return;
      }

      this.loadingSuggestions = {
        ...this.loadingSuggestions,
        [targetStep]: true,
      };

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const client = new GoogleGenAI({ apiKey });

        const prompt = this._buildSuggestionsPrompt(targetStep);
        const resp = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            // 0.85 だと汎用ラベルにブレやすかったので 0.65 に絞り、題材特化度を上げる
            temperature: 0.65,
            // JSON しか出さないように systemInstruction で縛る
            systemInstruction:
              "あなたはリサーチアシスタント。ユーザーの題材に**特化した固有性の高い候補**だけを出す。どんな題材にも当てはまる汎用ラベル (例: 「情報の鮮度」「データの正確性」「比較の網羅性」) は禁止。出力は JSON 配列のみ。マークダウン記法・前置き・後置き不要。",
          },
        });
        const raw = (resp.text || "").trim();
        const parsed = this._parseSuggestionsResponse(raw);
        if (parsed.length === 0) {
          throw new Error("no suggestions parsed");
        }
        this.briefingSuggestions = {
          ...this.briefingSuggestions,
          [targetStep]: parsed,
        };
        log("DEBUG", "[researchAgent] suggestions ready", {
          targetStep,
          count: parsed.length,
        });
      } catch (e) {
        log("WARN", "[researchAgent] generateBriefingSuggestions failed", e);
        // 失敗時は空配列で抜ける (UI 側は static chips のみで継続)
        this.briefingSuggestions = {
          ...this.briefingSuggestions,
          [targetStep]: [],
        };
      } finally {
        this.loadingSuggestions = {
          ...this.loadingSuggestions,
          [targetStep]: false,
        };
      }
    },

    _buildSuggestionsPrompt(targetStep: 2 | 3 | 4 | 5): string {
      const { theme, questions, doubts } = this.briefingDraft;

      const corePrinciple = `【守るべき原則】
- ユーザーの題材に**特化**した候補を出すこと
- マークダウン記法・前置き・後置き禁止。JSON 配列のみ出力.`;

      if (targetStep === 2) {
        return `${corePrinciple}

【題材】
テーマ: 「${theme}」

このテーマについて**調べて答えが欲しい Question** の候補を 5 件、JSON 配列で返してください。
各 12〜40 字、語尾は「?」推奨。`;
      }
      if (targetStep === 3) {
        return `${corePrinciple}

【題材】
テーマ: 「${theme}」
既存 Question: ${questions.length ? questions.join(" / ") : "(なし)"}

**モヤモヤ・不安 (疑問 → concerns[])** の候補を 5 件、JSON 配列で返してください。
各 6〜25 字、体言止め推奨。`;
      }

      return `${corePrinciple}

【題材】
テーマ: 「${theme}」
Question: ${questions.join(" / ") || "(なし)"}
疑問: ${doubts.join(" / ") || "(なし)"}

追加の Question 候補を 3 件、JSON 配列で返してください。`;
    },

    /**
     * 既知の API エラーパターンを人間可読・actionable なメッセージに正規化.
     * - 429 / RESOURCE_EXHAUSTED / spending cap → 月次支出上限到達の案内
     * - GEMINI_API_KEY_NOT_REGISTERED → キー未登録の案内 (フラグも立てる)
     * - その他は素のまま (ただし 300 字超は切り詰め)
     */
    _humanizeErrorMessage(raw: string): string {
      if (!raw) return "不明なエラー";
      // Gemini API 月次支出上限 (本日 2026-05-16 に発生事例あり)
      if (/RESOURCE_EXHAUSTED|spending cap|spend.*cap|\b429\b/i.test(raw)) {
        return "Gemini API の月次支出上限に達しています。AI Studio (https://ai.studio/spend) で上限を引き上げてください。エージェントが直前に出した「ファイルが消失」等の説明は LLM の自動補完であり、実際の原因はこの API 上限です。";
      }
      if (/GEMINI_API_KEY_NOT_REGISTERED/i.test(raw)) {
        this.needsApiKeyRegistration = true;
        return "Gemini API キーが未登録です。設定 > API キーで登録してください。";
      }
      if (/PERMISSION_DENIED|401|403/.test(raw)) {
        return `Gemini API の認証エラー: ${raw.slice(0, 200)}`;
      }
      if (/DEADLINE_EXCEEDED|timeout|504/i.test(raw)) {
        return "API 呼び出しがタイムアウトしました。少し待ってからもう一度試してください。";
      }
      return raw.length > 300 ? raw.slice(0, 300) + "…" : raw;
    },

    _parseSuggestionsResponse(raw: string): string[] {
      if (!raw) return [];
      // 1) そのまま JSON.parse
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return arr
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .slice(0, 10);
        }
      } catch {
        // fallthrough
      }
      // 2) 文字列中の [ ... ] を抽出して JSON.parse
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const arr = JSON.parse(match[0]);
          if (Array.isArray(arr)) {
            return arr
              .filter((x): x is string => typeof x === "string")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
              .slice(0, 10);
          }
        } catch {
          // fallthrough
        }
      }
      // 3) 行ベースで雑にパース (- や 1. プレフィックスを除去)
      return raw
        .split("\n")
        .map((l) => l.replace(/^[\s\-*"']*\d*[\.\)、]?\s*["']?/, "").trim())
        .map((l) => l.replace(/["',]$/, "").trim())
        .filter((l) => l.length > 0 && l.length < 100)
        .slice(0, 10);
    },

    /**
     * Step 3 (疑問) の chip 追加で AI に文章整形 + 関連質問の派生を依頼.
     * gemini-2.5-flash-lite (安価で高速) を使う.
     *
     * 失敗・キー未登録時は元のまま 1 件追加 (graceful fallback).
     */
    async polishAndAddBriefingQuestion(raw: string): Promise<void> {
      const trimmed = raw.trim();
      if (!trimmed) return;

      const apiKey = this.userApiKey || (await this.loadUserApiKey());
      if (!apiKey) {
        // キー無しなら polish せずそのまま追加
        this.addBriefingQuestion(trimmed);
        return;
      }

      this.polishingQuestion = true;
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const client = new GoogleGenAI({ apiKey });

        const { theme } = this.briefingDraft;
        const prompt = `ユーザーがリサーチ用の Question として「${trimmed}」を挙げた。
コンテキスト:
- テーマ: ${theme || "(未指定)"}

以下の手順で加工して JSON 配列で返してください:
1. 原文を明確な「問い」の形にブラッシュアップ (12〜40 字、敬語不要、自然な日本語、語尾は「?」または体言止め)
2. その問いから自然に派生する関連質問を 1〜2 件追加 (任意)
3. 重複や同義の問いは含めない

合計 1〜3 件の文字列を JSON 配列で出力. 前置き・後置き・マークダウン記法は禁止.

入力例: 「IT系に絞って考えたい」
出力例: ["IT 系企業が使える補助金には何がある?", "IT 系特化の補助金で人件費に充てられる枠は?"]`;

        const resp = await client.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            temperature: 0.55,
            systemInstruction:
              "出力は JSON 配列のみ。マークダウン記法・前置き・後置き不要。",
          },
        });

        const items = this._parseSuggestionsResponse(
          (resp.text || "").trim(),
        );
        if (items.length === 0) {
          // フォールバック: 原文をそのまま追加
          this.addBriefingQuestion(trimmed);
          return;
        }
        for (const item of items.slice(0, 3)) {
          this.addBriefingQuestion(item);
        }
      } catch (e) {
        log("WARN", "[researchAgent] polishAndAddBriefingQuestion failed", e);
        // 失敗時は原文をそのまま追加
        this.addBriefingQuestion(trimmed);
      } finally {
        this.polishingQuestion = false;
      }
    },

    /**
     * Step 5 (懸念点) の chip 追加で AI に文章整形 + 関連懸念の派生を依頼.
     * 疑問 (Step 4) と同じ流儀で動く. gemini-2.5-flash-lite を使用.
     *
     * 失敗・キー未登録時は元のまま 1 件追加 (graceful fallback).
     */
    async polishAndAddBriefingConcern(raw: string): Promise<void> {
      const trimmed = raw.trim();
      if (!trimmed) return;

      const apiKey = this.userApiKey || (await this.loadUserApiKey());
      if (!apiKey) {
        this.addBriefingConcern(trimmed);
        return;
      }

      this.polishingConcern = true;
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const client = new GoogleGenAI({ apiKey });

        const { theme, questions } = this.briefingDraft;
        const qHint = questions.length
          ? questions.slice(0, 5).map((q) => `「${q}」`).join("、")
          : "(未入力)";
        const prompt = `ユーザーがリサーチ実施に伴う**疑問 (concerns)** として「${trimmed}」を挙げた。
コンテキスト:
- テーマ: ${theme || "(未指定)"}
- 既に挙がっている Question: ${qHint}

以下の手順で加工して JSON 配列で返してください:
1. 原文を簡潔な「懸念点ラベル」の形に整える (6〜25 字、体言止め推奨、ニュアンスを保つ)
2. その懸念から自然に派生する関連懸念を 0〜2 件追加 (本当に関連がある場合のみ、無理に作らない)
3. 重複や同義の懸念は含めない

合計 1〜3 件の文字列を JSON 配列で出力. 前置き・後置き・マークダウン記法は禁止.

入力例: 「情報が古かったら困る」
出力例: ["情報の鮮度", "公的データの更新頻度"]`;

        const resp = await client.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            temperature: 0.5,
            systemInstruction:
              "出力は JSON 配列のみ。マークダウン記法・前置き・後置き不要。",
          },
        });

        const items = this._parseSuggestionsResponse(
          (resp.text || "").trim(),
        );
        if (items.length === 0) {
          this.addBriefingConcern(trimmed);
          return;
        }
        for (const item of items.slice(0, 3)) {
          this.addBriefingConcern(item);
        }
      } catch (e) {
        log("WARN", "[researchAgent] polishAndAddBriefingConcern failed", e);
        this.addBriefingConcern(trimmed);
      } finally {
        this.polishingConcern = false;
      }
    },

    /**
     * Briefing を確定して整形プロンプトを ADK に送信.
     * - `promptOverride` が指定された場合は、ユーザーが編集モードで直接書き換えた
     *   テキストを使う (ただし常に sanitize を通すので PPTX 言及は強制除去).
     * - そうでない場合は付箋から自動生成 (`_buildBriefingPrompt` 内で sanitize 済).
     * 既存の send() に乗るので、Phase 進捗 / SSE / 自動進行が従来通り走る.
     */
    /**
     * Briefing 完了 → research-v13 整合のプラン素案キオスクへ.
     * ADK 送信は confirmResearchPlan() まで行わない.
     */
    _researchStudioFieldsForPersist(): ResearchStudioFields {
      const base = researchStudioFieldsFromAgentState({
        agentState: this.agentState,
        briefing: this.briefingComplete ? null : this.briefingDraft,
        autoMode: this.autoMode,
        pipelineAutonomous: this.researchPipelineAutonomous,
      });
      const organizationStore = useOrganizationStore();
      const spaceStore = useSpaceStore();
      const organizationId =
        organizationStore.loggedInOrganizationInfo?.id?.trim() ||
        base.organizationId ||
        null;
      const organizationName =
        organizationStore.loggedInOrganizationInfo?.name?.trim() ||
        base.organizationName ||
        null;
      const spaceId = spaceStore.selectedSpace?.id?.trim() || base.spaceId || null;
      const spaceName =
        spaceStore.selectedSpace?.name?.trim() || base.spaceName || null;
      return {
        ...base,
        planOnly: this.researchPlanOnly,
        workflowPhase: this.researchWorkflowPhase,
        planDraft: this.researchPlanDraft,
        notificationEmail: this.notificationEmail,
        organizationId,
        organizationName,
        spaceId,
        spaceName,
      };
    },

    _researchPlanContextHint(): ResearchPlanContextHint {
      const fields = this._researchStudioFieldsForPersist();
      return {
        organizationName: fields.organizationName ?? null,
        spaceName: fields.spaceName ?? null,
        workspaceName: fields.workspaceName ?? null,
        fileSpaceId: fields.fileSpaceId ?? null,
        contextStatus: fields.contextStatus ?? null,
        contextWarning: fields.contextWarning ?? null,
      };
    },

    async _persistResearchWorkflow(): Promise<void> {
      if (!this.sessionId) return;
      await persistResearchWorkflowToSession({
        sessionId: this.sessionId,
        fields: this._researchStudioFieldsForPersist(),
      });
    },

    _applyWorkflowFromSessionState(state: Record<string, unknown>): void {
      const bucket =
        state.research && typeof state.research === "object"
          ? (state.research as Record<string, unknown>)
          : {};
      const flat = researchGoldenToEffectiveFlat(bucket);
      this.agentState = {
        ...this.agentState,
        ...researchAgentStateFromSessionState(state),
      };
      const snapshot = readResearchWorkflowFromFlatState({ flat });
      if (snapshot.planDraft) {
        this.researchPlanDraft = snapshot.planDraft;
      }
      if (snapshot.notificationEmail) {
        this.notificationEmail = snapshot.notificationEmail;
      }
      if (this.isCompleted) {
        this.researchWorkflowPhase = "done";
        return;
      }
      if (snapshot.workflowPhase) {
        this.researchWorkflowPhase = snapshot.workflowPhase;
      }
    },

    async _finalizePlanGeneration(): Promise<void> {
      if (!this.sessionId) return;
      await this.pollSessionState();
      const state = (await fetchAdkSessionState(this.sessionId)) ?? {};
      this._applyWorkflowFromSessionState(state);
      if (
        this.researchWorkflowPhase === "plan_review" &&
        this.researchPlanDraft
      ) {
        await this._persistResearchWorkflow();
        return;
      }
      const fallback = buildResearchPlanFromBriefing({
        briefing: this.briefingDraft,
        context: this._researchPlanContextHint(),
      });
      this.researchPlanDraft = fallback;
      this.researchWorkflowPhase = "plan_review";
      await this._persistResearchWorkflow();
    },

    /** Briefing 完了 → ADK plan_only でプラン素案を state に書き込み */
    async launchResearchFromBriefing(params: {
      draft: ResearchAgentBriefingDraft;
    }): Promise<void> {
      this.briefingDraft = migrateBriefingDraft(params.draft);
      this.briefingComplete = true;
      this._clearBriefingStorage();
      this.autoMode = false;
      this.autoTurnCount = 0;
      this.researchPlanOnly = true;
      this.researchPipelineAutonomous = false;
      this.researchWorkflowPhase = "plan_generating";
      this.lastError = null;
      if (!this.sessionId) {
        await this.startSession();
      }
      await this._persistResearchWorkflow();
      const prompt = buildResearchPlanBriefingInvokePrompt({
        briefing: this.briefingDraft,
        context: this._researchPlanContextHint(),
      });
      await this.send(prompt);
      await this._finalizePlanGeneration();
    },

    goBackToPlanReview(): void {
      if (!this.researchPlanDraft) return;
      this.researchWorkflowPhase = "plan_review";
      void this._persistResearchWorkflow();
    },

    /** プラン編集完了 → メール入力・最終確認へ */
    async advancePlanToConfirmSubmit(params: {
      plan: ResearchPlanDraft;
    }): Promise<void> {
      this.researchPlanDraft = params.plan;
      this.researchWorkflowPhase = "confirm_submit";
      if (!this.notificationEmail) {
        this.notificationEmail = getAuth().currentUser?.email ?? null;
      }
      await this._persistResearchWorkflow();
    },

    /** メール確定 → フルパイプライン生成開始 */
    async submitResearchGeneration(params: {
      notificationEmail: string;
    }): Promise<void> {
      const { resolveResearchNotificationEmail } = await import(
        "@utils/researchPlanDraft"
      );
      const email = resolveResearchNotificationEmail({
        draft: {
          theme: this.briefingDraft.theme,
          questions: this.briefingDraft.questions,
          doubts: this.briefingDraft.doubts,
          notificationEmail: params.notificationEmail.trim(),
        },
        fallbackEmail: getAuth().currentUser?.email ?? null,
      });
      this.notificationEmail = email;
      if (!this.researchPlanDraft) {
        throw new Error("リサーチプランが未確定です");
      }
      this.researchPlanOnly = false;
      this.researchPipelineAutonomous = true;
      await this.confirmResearchPlan({ plan: this.researchPlanDraft });
    },

    async updateNotificationEmail(params: {
      notificationEmail: string;
    }): Promise<void> {
      const { resolveResearchNotificationEmail } = await import(
        "@utils/researchPlanDraft"
      );
      const email = resolveResearchNotificationEmail({
        draft: {
          theme: this.briefingDraft.theme,
          questions: this.briefingDraft.questions,
          doubts: this.briefingDraft.doubts,
          notificationEmail: params.notificationEmail.trim(),
        },
        fallbackEmail: getAuth().currentUser?.email ?? null,
      });
      this.notificationEmail = email;
      await this._persistResearchWorkflow();
    },

    /** プラン素案承認 → リサーチ生成フェーズ開始 */
    async confirmResearchPlan(params: { plan: ResearchPlanDraft }): Promise<void> {
      if (
        this._researchLaunchInFlight ||
        this.isStreaming ||
        this.isAutoResponding
      ) {
        return;
      }
      this._researchLaunchInFlight = true;
      try {
        const prompt = buildResearchPlanLaunchPrompt({
          plan: params.plan,
          context: this._researchPlanContextHint(),
        });
        this.researchPlanDraft = params.plan;
        this.researchWorkflowPhase = "generating";
        this.lastError = null;
        this.researchPipelineAutonomous = true;
        this.autoMode = false;
        this.autoTurnCount = 0;
        if (!this.sessionId) {
          await this.startSession();
        }
        await this._persistResearchWorkflow();
        await this.send(prompt);
        if (this.researchPipelineAutonomous) {
          await this._persistResearchWorkflow();
        }
      } finally {
        this._researchLaunchInFlight = false;
      }
    },

    /** 生成完了時に workflow を done へ (Panel から呼ぶ) */
    markResearchWorkflowDone(): void {
      if (
        this.researchWorkflowPhase === "generating" ||
        this.researchWorkflowPhase === "submitted"
      ) {
        this.researchWorkflowPhase = "done";
        void this._persistResearchWorkflow();
      }
    },

    _stopInvokeBackgroundWatch(): void {
      this.invokeWatchUnsubscribe?.();
      this.invokeWatchUnsubscribe = null;
    },

    async _onInvokeCompleted(params: { sessionId: string }): Promise<void> {
      const sessions = useAiStudioSessions();
      const record = await sessions.get(params.sessionId);
      if (record?.messages.length) {
        this._syncMessagesFromEnAiStudioUi(record.messages);
      }
      this._ensureArtifactSubscription();
      await this.pollSessionState();
      this.isStreaming = false;
      this.markResearchWorkflowDone();
      if (this.sessionId) {
        const state = (await fetchAdkSessionState(this.sessionId)) ?? {};
        this._applyWorkflowFromSessionState(state);
      }
    },

    _onInvokeFailed(params: { errorMessage?: string }): void {
      this.isStreaming = false;
      this.researchWorkflowPhase = "failed";
      this.lastError =
        params.errorMessage || "リサーチ invoke が失敗しました";
      void this._persistResearchWorkflow();
    },

    _startInvokeBackgroundWatch(params: {
      organizationId: string;
      spaceId: string;
      requestId: string;
      sessionId: string;
    }): void {
      this._stopInvokeBackgroundWatch();
      this.invokeWatchUnsubscribe = watchAdkInvokeRequest({
        organizationId: params.organizationId,
        spaceId: params.spaceId,
        requestId: params.requestId,
        onUpdate: (status, errorMessage) => {
          if (status === "completed") {
            this._stopInvokeBackgroundWatch();
            void this._onInvokeCompleted({ sessionId: params.sessionId });
          } else if (status === "error") {
            this._stopInvokeBackgroundWatch();
            this._onInvokeFailed({ errorMessage });
          }
        },
      });
    },

    // ─── reset ───────────────────────────────────

    _mapFirestoreArtifacts(
      map: Map<string, DecodedAdkSessionArtifact>
    ): ResearchAgentArtifact[] {
      return Array.from(map.values()).map((r) => ({
        artifactId: r.artifactId,
        kind: r.kind,
        name: r.name ?? r.adkFilename,
        storageGcsPath: r.storageGcsPath,
        gcsPath: r.storageGcsPath,
        bytes: r.bytes,
        contentType: r.contentType,
        generatedAt:
          r.createdAt?.toMillis?.() ?? r.updatedAt?.toMillis?.() ?? Date.now(),
        status: r.status,
      }));
    },

    async refreshArtifactsFromFirestore(): Promise<void> {
      if (!this.sessionId) return;
      const map = await fetchSessionArtifacts({ sessionId: this.sessionId });
      this.artifacts = this._mapFirestoreArtifacts(map);
    },

    _ensureArtifactSubscription(): void {
      if (!this.sessionId) return;
      this.artifactSubscriptionUnsubscribe?.();
      this.artifactSubscriptionUnsubscribe = subscribeSessionArtifacts({
        sessionId: this.sessionId,
        onUpdate: (map) => {
          this.artifacts = this._mapFirestoreArtifacts(map);
        },
      });
      void this.refreshArtifactsFromFirestore();
    },

    _stopArtifactSubscription(): void {
      this.artifactSubscriptionUnsubscribe?.();
      this.artifactSubscriptionUnsubscribe = null;
    },

    _stopEnAiStudioUiSubscription(): void {
      this.enAiStudioUiUnsubscribe?.();
      this.enAiStudioUiUnsubscribe = null;
    },

    ensureEnAiStudioUiSubscription(): void {
      if (!this.sessionId) return;
      this._stopEnAiStudioUiSubscription();
      this.enAiStudioUiUnsubscribe = subscribeActiveAdkSession({
        sessionId: this.sessionId,
        onRecord: (record) => {
          if (!record) return;
          void (async () => {
            const state =
              (await fetchAdkSessionState(this.sessionId!)) ?? {};
            this._applyWorkflowFromSessionState(state);
            if (!this.isStreaming && record.messages.length > 0) {
              this._syncMessagesFromEnAiStudioUi(record.messages);
            }
            if (this.isCompleted) {
              this._ensureArtifactSubscription();
              if (
                this.researchWorkflowPhase === "submitted" ||
                this.researchWorkflowPhase === "generating"
              ) {
                this.markResearchWorkflowDone();
              }
            }
          })();
        },
      });
    },

    async _sendViaRequestDoc(params: {
      text: string;
      sessionId: string;
      assistantIndex: number;
      assistantMsgId: string;
    }): Promise<void> {
      const scope = resolveAdkSessionScope();
      const { organizationId, spaceId } = scope;
      const uid = getAuth().currentUser?.uid;
      if (!uid) {
        throw new Error("ログイン状態ではありません");
      }

      this.ensureEnAiStudioUiSubscription();

      const sessions = useAiStudioSessions();
      const runningPhase = this.phases.find((p) => p.status === "running");
      const studioFields = this._researchStudioFieldsForPersist();
      await sessions.update(params.sessionId, {
        jobKind: "research",
        activeAgent: "research",
        researchCurrentPhase:
          runningPhase?.key ?? studioFields.currentPhase ?? null,
        researchTheme: studioFields.theme,
        researchAutoMode: this.autoMode,
        messages: this.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            id: m.id,
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            text: m.text,
            createdAt: m.createdAt,
            isStreaming: m.isStreaming === true,
          })),
      });

      const priorTurns = this.messages.slice(0, params.assistantIndex - 1);
      const history = priorTurns.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        text: m.text,
      }));

      let fileSpaceId: string | null = null;
      try {
        const { useGeminiFileSpaceOperatorStore } = await import(
          "@stores/geminiFileSpaceOperator"
        );
        const fsStore = useGeminiFileSpaceOperatorStore();
        const ensured = await fsStore.ensureDefaultFileSpace();
        fileSpaceId = ensured.storeId;
        if (!fileSpaceId) {
          fileSpaceId = (await fsStore.getFirstSystemManagedFileSpaceId()) ?? null;
        }
      } catch (error) {
        log("WARN", "[researchAgent] ensureDefaultFileSpace failed", error);
      }

      const organizationStore = useOrganizationStore();
      const spaceStore = useSpaceStore();
      const organizationName =
        organizationStore.loggedInOrganizationInfo?.name?.trim() || null;
      const spaceName = spaceStore.selectedSpace?.name?.trim() || null;

      const contextWarnings: string[] = [];
      if (!fileSpaceId) {
        contextWarnings.push(
          "データ環境 (fileSpace) を解決できないため、レポートが一般的な内容に寄る可能性があります。",
        );
      }
      if (!organizationName || !spaceName) {
        contextWarnings.push(
          "組織またはスペース情報が不足しているため、企業コンテキスト反映が限定的になる可能性があります。",
        );
      }
      const contextStatus: "ready" | "limited" =
        contextWarnings.length > 0 ? "limited" : "ready";
      const contextWarning = contextWarnings[0] ?? null;

      this.agentState = {
        ...this.agentState,
        organization_id: organizationId,
        organization_name: organizationName,
        space_id: spaceId,
        space_name: spaceName,
        file_space_id: fileSpaceId,
        context_status: contextStatus,
        context_warning: contextWarning,
      };

      const modeState = buildResearchModeState({
        fields: this._researchStudioFieldsForPersist(),
      });
      if (runningPhase) {
        modeState.current_phase = runningPhase.key;
      }

      const requestId = await createAdkInvokeRequest({
        input: buildAdkInvokeInput({
          mode: "research",
          sessionId: params.sessionId,
          organizationId,
          spaceId,
          userId: uid,
          prompt: params.text,
          responseId: params.assistantMsgId,
          fileSpaceId,
          history,
          modeState,
          notificationEmail: this.notificationEmail?.trim() || null,
        }),
        organizationId,
        spaceId,
      });

      if (this.researchPipelineAutonomous) {
        this._startInvokeBackgroundWatch({
          organizationId,
          spaceId,
          requestId,
          sessionId: params.sessionId,
        });
        this.researchWorkflowPhase = "submitted";
        this.isStreaming = false;
        void this._persistResearchWorkflow();
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const stopWatch = watchAdkInvokeRequest({
          organizationId,
          spaceId,
          requestId,
          onUpdate: (status, errorMessage) => {
            if (status === "completed") {
              stopWatch();
              resolve();
            } else if (status === "error") {
              stopWatch();
              reject(new Error(errorMessage || "リサーチ invoke が失敗しました"));
            }
          },
        });
      });

      const record = await sessions.get(params.sessionId);
      if (record?.messages.length) {
        this._syncMessagesFromEnAiStudioUi(record.messages);
      }
      await this.pollSessionState();
    },

    _syncMessagesFromEnAiStudioUi(messages: AiStudioMessage[]): void {
      this.messages = messages.map((m, i) => ({
        id: m.id || `msg-${i}`,
        role: m.role === "user" ? "user" : "agent",
        text: m.text,
        createdAt: m.createdAt ?? Date.now(),
        isStreaming: m.isStreaming === true,
      }));
    },

    reset(): void {
      this.cancelStream();
      this._stopArtifactSubscription();
      this._stopEnAiStudioUiSubscription();
      this._stopInvokeBackgroundWatch();
      this.sessionId = null;
      this.messages = [];
      this.phases = initialPhases();
      this.artifacts = [];
      this.agentState = {};
      this.lastError = null;
      this.needsApiKeyRegistration = false;
      this.autoMode = false;
      this.autoTurnCount = 0;
      this.isAutoResponding = false;
      this._completionConsumed = false;
      this.researchWorkflowPhase = null;
      this.researchPlanDraft = null;
      this.researchPipelineAutonomous = false;
      this.researchPlanOnly = false;
      this.notificationEmail = null;
    },
  },
});
