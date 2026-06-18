import type { BriefingFlowConfig } from "@composables/agentBriefing/types";

/**
 * シート編集エージェントの briefing flow.
 *
 * 3 ステップ:
 *   1. spreadsheetUrl (text) — 編集対象シートの URL (必須)
 *   2. intent (text) — やりたいことの概要
 *   3. range (text, 任意) — 対象範囲・条件
 *
 * 注: backend は Cloud Run service account に編集者共有が必要. プロンプトでも案内する.
 */
export const sheetAgentBriefingConfig: BriefingFlowConfig = {
  id: "sheetAgent",
  title: "シート編集: 前準備",
  subtitle: "対象シートとやりたいことを 3 ステップで確認します",
  icon: "material-symbols:table-chart-view",
  accent: "sky",
  skipLabel: "URL を貼って直接話しかける",
  finalize: {
    heading: "OK! このシートをこう編集しますね.",
    sub: "サービスアカウントへの編集者共有が済んでいることを確認の上、進めてください.",
    confirmLabel: "AI 部下に編集を任せる",
  },
  mascot: {
    imageSrc: "/en-ai-avatar-violet.png",
    altText: "シート編集 AI バディ",
    linesByStep: {
      1: [
        "どのシートを編集する?\nURL を貼ってー!",
        "docs.google.com/spreadsheets/d/...\nのリンクで OK!",
        "サービスアカウントに\n編集者共有もよろしくね!",
      ],
      2: [
        "そのシートで何をする?\n1 言でざっくり!",
        "「集計入れて」「行追加して」\nレベルで OK!",
      ],
      3: [
        "対象範囲ある?\n「Sheet1!A1:D10」とか.",
        "なければ後で AI が\n聞いてくれるよ!",
      ],
      4: [
        "完璧!\nシート編集モードに繋ぐね!",
        "確認 OK なら任せて!",
      ],
    },
  },
  fields: [
    {
      key: "spreadsheetUrl",
      step: 1,
      kind: "text",
      heading: "編集する Google スプレッドシートの URL は?",
      hint: "docs.google.com/spreadsheets/d/{id}/edit の形のリンクをコピペしてください. サービスアカウント (781544707153-compute@developer.gserviceaccount.com) に **編集者** として共有しておく必要があります.",
      placeholder: "https://docs.google.com/spreadsheets/d/.../edit",
      stickyLabel: "シート URL",
      stickyTone: "sky",
    },
    {
      key: "intent",
      step: 2,
      kind: "text",
      heading: "そのシートで何をしたいですか?",
      hint: "ざっくり 1-2 行で OK. 細部は AI が必要に応じて聞き返します.",
      placeholder: "例: 売上シートの月別合計を E 列に出して、前月比 % も F 列に追加",
      stickyLabel: "やりたいこと",
      stickyTone: "sky",
    },
    {
      key: "range",
      step: 3,
      kind: "text",
      heading: "対象範囲・条件はありますか? (任意)",
      hint: "A1 記法 (例: Sheet1!A2:D100) や「最後の行に追加」など具体があるとスムーズ.",
      placeholder: "例: Sheet1!A2:D100, ヘッダーは触らない",
      stickyLabel: "範囲",
      stickyTone: "sky",
    },
  ],
  buildPrompt: (draft) => {
    const url =
      typeof draft.spreadsheetUrl === "string"
        ? draft.spreadsheetUrl.trim()
        : "";
    const intent =
      typeof draft.intent === "string" ? draft.intent.trim() : "";
    const range = typeof draft.range === "string" ? draft.range.trim() : "";

    return [
      `操作対象シート: ${url || "(未指定)"}`,
      "",
      "# やりたいこと",
      intent || "(未指定)",
      "",
      "# 対象範囲・条件",
      range || "(指定なし — 必要なら確認してください)",
      "",
      "上記を踏まえ、まず list_sheets / read_range で現状を確認してから、",
      "実行内容を 1-2 行で要約 + 必要なら確認質問してから操作を進めてください.",
    ].join("\n");
  },
};
