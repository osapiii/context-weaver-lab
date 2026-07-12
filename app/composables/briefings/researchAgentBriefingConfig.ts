import type { BriefingFlowConfig } from "@composables/agentBriefing/types";

/**
 * Briefing flow config for the **research agent**.
 *
 * 2 ステップ:
 *   1. テーマ (text)
 *   2. 知りたいこと + 懸念 (chips) — sections[] / concerns[] 用
 *
 * 完了後は即 research-v13 生成 (確認画面なし).
 */
export const researchAgentBriefingConfig: BriefingFlowConfig = {
  id: "researchAgent",
  title: "リサーチエージェント: 前準備",
  subtitle: "テーマと知りたいことだけ整理して、レポート生成へ",
  icon: "material-symbols:auto-stories",
  accent: "purple",
  layout: "stacked",
  skipFinalizeScreen: true,
  lastStepAdvanceLabel: "リサーチ開始",
  finalize: {
    heading: "リサーチを開始します",
    sub: "テーマと知りたいことをもとにレポートを生成します",
    confirmLabel: "リサーチ開始",
  },
  mascot: {
    imageSrc: "/en-ai-avatar-violet.png",
    altText: "リサーチ AI バディ",
    linesByStep: {
      1: [
        "今日は何を調べる?\nテーマだけ教えてー!",
        "ふむふむ、\nどんな話題が気になる?",
        "ざっくり方向だけで OK だよ。\n後で深掘りするから!",
      ],
      2: [
        "知りたいことを\n教えて!",
        "AI が候補も出すから\n気になるのをタップしてね",
        "1 個ずつ Enter で\n貯めていこう!",
      ],
      3: [
        "完璧!\nプランを組み立てるね!",
        "あとで 1 問 1 答の構成を確認できるよ",
      ],
    },
  },
  fields: [
    {
      key: "theme",
      step: 1,
      kind: "text",
      heading: "今日リサーチしたいテーマは?",
      hint: "1 行でざっくり。キーワードや問いの中心を教えてください。",
      placeholder: "例: 中小企業における AI 活用の導入ステップ",
      stickyLabel: "テーマ",
      stickyTone: "purple",
      samples: [
        "中小企業における AI 活用の導入ステップ",
        "Z 世代向けマーケティングのトレンド 2026",
        "サブスクリプション型 SaaS の価格設計",
      ],
    },
    {
      key: "questions",
      step: 2,
      kind: "chips",
      heading: "知りたいこと",
      placeholder: "例: うちの規模でも始められる最初の 3 ステップは?",
      stickyLabel: "知りたいこと",
      stickyTone: "purple",
      aiSuggestChips: true,
    },
    {
      key: "doubts",
      step: 2,
      kind: "chips",
      heading: "懸念",
      placeholder: "例: 初期投資の回収にどれくらい時間がかかるか不安",
      stickyLabel: "懸念",
      stickyTone: "violet",
      optional: true,
    },
  ],
  buildPrompt: (draft) => {
    const theme = typeof draft.theme === "string" ? draft.theme.trim() : "";
    const questions = Array.isArray(draft.questions)
      ? draft.questions.filter((q): q is string => typeof q === "string")
      : [];
    const doubts = Array.isArray(draft.doubts)
      ? draft.doubts.filter((d): d is string => typeof d === "string")
      : Array.isArray(draft.concerns)
        ? draft.concerns.filter((d): d is string => typeof d === "string")
        : [];

    const questionsBlock = questions.length
      ? questions.map((q) => `- ${q}`).join("\n")
      : "- (特になし)";
    const doubtsBlock = doubts.length
      ? doubts.map((d) => `- ${d}`).join("\n")
      : "- (なし)";

    return [
      "# テーマ",
      theme || "(未指定)",
      "",
      "# 調べたいこと (sections[] に対応)",
      questionsBlock,
      "",
      "# 懸念 (concerns[] に対応)",
      doubtsBlock,
    ].join("\n");
  },
};
