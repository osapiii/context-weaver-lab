/**
 * Generic "agent job briefing" types.
 *
 * The research-agent's briefing UX (5 steps × sticky-note board, draft persisted
 * to localStorage, escape hatch to "skip briefing") turned out to apply across
 * many job-style features — slide generation, data analysis, sheet editing,
 * image generation. To make that reuse cheap, the UI components in
 * ``app/components/AgentBriefing/*`` are driven by a config object of this
 * shape instead of being bound to a specific store.
 *
 * To wire up a new job, write a ``BriefingFlowConfig`` and pass it to
 * ``useAgentBriefing`` / ``AgentBriefingSession``.
 */

export type BriefingFieldKind = "text" | "chips";

export interface BriefingFieldDef {
  /** Draft property key (e.g. ``"theme"``, ``"questions"``). */
  key: string;
  /** 1-based step number this field belongs to. */
  step: number;
  /** ``text`` = single multi-line answer; ``chips`` = N short tags. */
  kind: BriefingFieldKind;
  /** Big heading shown above the input in the step. */
  heading: string;
  /** Smaller hint text shown under the heading (optional). */
  hint?: string;
  /** Placeholder shown inside the textarea. */
  placeholder?: string;
  /** Label shown on the sticky note for this field (e.g. ``"テーマ"``). */
  stickyLabel: string;
  /** Tone for the sticky note background — purely cosmetic. */
  stickyTone?: "purple" | "lime" | "sky" | "rose" | "violet";
  /** Sample answers offered as quick-tap chips inside the step. */
  samples?: string[];
  /** 入力文脈から AI 候補 chip を生成 (Firebase AI Logic structured output). */
  aiSuggestChips?: boolean;
  /** chips フィールドで未入力でも次へ進める (例: 疑問は任意). */
  optional?: boolean;
  /** text フィールドの形式チェック (例: メール通知先). */
  format?: "email";
  /**
   * 同一 ``stickyGroup`` のフィールドをヒアリングボード上で 1 枚の付箋にまとめる.
   * 先頭フィールドの ``stickyGroupLabel`` が付箋タイトルになる.
   */
  stickyGroup?: string;
  /** stickyGroup 統合時の付箋タイトル (先頭フィールドのみ指定). */
  stickyGroupLabel?: string;
}

/**
 * Top-level configuration for a single job's briefing flow.
 *
 * One config = one job. Multiple configs can coexist in the codebase
 * (slides config, data-analysis config, etc.).
 */
export interface BriefingFlowConfig {
  /** Stable identifier (used as the localStorage namespace). */
  id: string;
  /** Title shown in the panel header (e.g. ``"データ分析の前準備"``). */
  title: string;
  /** Subtitle / short description shown under the title. */
  subtitle?: string;
  /** Icon name for the header chip (Material Symbols / Heroicons). */
  icon?: string;
  /** Accent color used for buttons, progress, and chips. */
  accent?: "purple" | "emerald" | "sky" | "violet";
  /**
   * ``split`` = 左入力 + 右ヒアリングボード (既定).
   * ``stacked`` = ステップカード縦並び (入力中=textarea / 完了=Chips).
   */
  layout?: "split" | "stacked";
  /** Ordered field definitions. Steps are derived from ``step`` values. */
  fields: BriefingFieldDef[];
  /**
   * Final transformation of the draft into the prompt that will be sent to
   * the agent. The result is what ``finalize`` resolves with.
   */
  buildPrompt: (draft: BriefingDraft) => string;
  /** Optional copy customisation for the finalize screen. */
  finalize?: {
    heading?: string;
    sub?: string;
    confirmLabel?: string;
  };
  /** Optional copy for the "skip the briefing" escape hatch. */
  skipLabel?: string;
  /**
   * true のとき最終ステップの「次へ」で確認画面を出さず finalize を即実行.
   * 親は ``@finalize`` で受け取ってバックエンド起動する (リサーチ等).
   */
  skipFinalizeScreen?: boolean;
  /** skipFinalizeScreen 時の最終ステップ CTA ラベル (既定: 確認へ). */
  lastStepAdvanceLabel?: string;
  /**
   * Optional マスコットキャラ. 指定すると左ペイン上部に吹き出し + 画像が
   * 表示される. step ごとにセリフをローテーションして「相棒感」を出すための演出.
   */
  mascot?: BriefingMascotConfig;
}

/**
 * マスコットキャラ (例: ENOSTECH Violet アバター) を briefing 画面に
 * 出すための設定. step ごとにセリフ配列を渡し、コンポーネント側で 5 秒
 * 間隔ローテーションする.
 */
export interface BriefingMascotConfig {
  /** 画像 URL (public 配下の絶対パス). 既定: "/en-ai-avatar-violet.png" */
  imageSrc?: string;
  /** alt テキスト. 既定: "AI バディ" */
  altText?: string;
  /**
   * step (1-indexed) ごとのセリフ配列. 各 step で複数行ある場合は 5 秒ごとに
   * ローテーション. finalize 画面用に step = totalSteps + 1 を入れても OK.
   */
  linesByStep: Record<number, string[]>;
}

/** Generic draft value shape: any number of text fields + chip arrays. */
export type BriefingDraftValue = string | string[];
export type BriefingDraft = Record<string, BriefingDraftValue>;

/** Persisted state in localStorage (draft + current step). */
export interface BriefingPersistedState {
  draft: BriefingDraft;
  step: number;
}
