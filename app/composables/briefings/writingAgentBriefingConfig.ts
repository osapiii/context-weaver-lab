import type { BriefingFlowConfig } from "@composables/agentBriefing/types";

/**
 * 文章生成エージェントの briefing flow.
 *
 * 4 ステップ:
 *   1. genre (chips) — どんな種類の文書?
 *   2. recipient (text) — 誰に向けて?
 *   3. content (text) — 主旨と盛り込みたい内容
 *   4. tone (chips) — トーン・温度感
 *
 * finalize 時に buildPrompt が返すプロンプトを AI 部下 (writing mode) に
 * 自動 send する想定.
 */
export const writingAgentBriefingConfig: BriefingFlowConfig = {
  id: "writingAgent",
  title: "文章生成: 前準備",
  subtitle: "4 ステップで AI に整えてもらいやすい形に揃えます",
  icon: "material-symbols:edit-document",
  accent: "emerald",
  skipLabel: "全部自分で書く(従来モード)",
  finalize: {
    heading: "OK! こんな指示で AI 部下に書いてもらいますね.",
    sub: "内容を確認して問題なければ、AI 部下にバトンタッチします.",
    confirmLabel: "AI 部下にお願いする",
  },
  mascot: {
    imageSrc: "/en-ai-avatar-violet.png",
    altText: "文章生成 AI バディ",
    linesByStep: {
      1: [
        "どんな文章を作る?\n用途を 1 言で教えて!",
        "メール? 通知? 議事録?\nまず種類から!",
      ],
      2: [
        "誰に向ける文章?\n読み手を教えてー!",
        "社内? 社外?\n役職や立場があると助かる!",
      ],
      3: [
        "主旨を箇条書きで OK!\n大事な要素を全部教えて.",
        "数字や固有名詞も\n入れたいなら全部書いて!",
      ],
      4: [
        "トーンは?\n硬め / 親しみ / 要点だけ?",
        "雰囲気が決まると\n仕上がりがブレないよ!",
      ],
      5: [
        "完璧!\nこれで書き始めるね!",
        "確認 OK なら任せて!",
      ],
    },
  },
  fields: [
    {
      key: "genre",
      step: 1,
      kind: "chips",
      heading: "どんな種類の文書を作りますか?",
      hint: "選択肢から選ぶか、自由に追加してください (1 個でも複数選んでも OK).",
      placeholder: "例: 謝罪メール",
      stickyLabel: "種類",
      stickyTone: "lime",
      samples: [
        "メール",
        "社内通知",
        "議事録",
        "ブログ記事",
        "プレスリリース",
        "提案書の本文",
      ],
    },
    {
      key: "recipient",
      step: 2,
      kind: "text",
      heading: "誰に向けた文章ですか?",
      hint: "読み手が分かるほど、トーンや細かさを AI が調整しやすくなります.",
      placeholder: "例: 顧客企業の経理担当者 (50 代男性)",
      stickyLabel: "読み手",
      stickyTone: "lime",
    },
    {
      key: "content",
      step: 3,
      kind: "text",
      heading: "主旨・盛り込みたい内容を箇条書きで教えてください.",
      hint: "日付・金額・固有名詞などは具体的に書いてください. AI が補完しません.",
      placeholder: "例:\n- 5/20 納品予定が遅れる\n- 新納期: 5/25\n- 原因: 部品入荷遅延",
      stickyLabel: "内容",
      stickyTone: "lime",
    },
    {
      key: "tone",
      step: 4,
      kind: "chips",
      heading: "トーン・温度感は?",
      hint: "1 つ選ぶか自由入力. 「短く」「長めにじっくり」など長さの希望も chip でどうぞ.",
      placeholder: "例: 丁寧だがフラットに",
      stickyLabel: "トーン",
      stickyTone: "lime",
      samples: [
        "丁寧・かしこまった",
        "親しみやすい",
        "要点だけ短く",
        "じっくり長め",
        "謝罪を含む",
        "前向き・ポジティブ",
      ],
    },
  ],
  buildPrompt: (draft) => {
    const genre = Array.isArray(draft.genre)
      ? draft.genre.filter((g): g is string => typeof g === "string").join(" / ")
      : "";
    const recipient =
      typeof draft.recipient === "string" ? draft.recipient.trim() : "";
    const content =
      typeof draft.content === "string" ? draft.content.trim() : "";
    const tone = Array.isArray(draft.tone)
      ? draft.tone.filter((t): t is string => typeof t === "string").join(" / ")
      : "";

    return [
      "# 種類",
      genre || "(未指定)",
      "",
      "# 読み手",
      recipient || "(未指定)",
      "",
      "# 主旨・盛り込みたい内容",
      content || "(未指定)",
      "",
      "# トーン",
      tone || "(未指定)",
      "",
      "上記を踏まえ、コピペでそのまま使える完成文を作ってください.",
      "複数のコピー単位 (件名 + 本文 等) があれば add_text_block で各単位を分けて出力してください.",
    ].join("\n");
  },
};
