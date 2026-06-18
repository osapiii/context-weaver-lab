import type { BriefingFlowConfig } from "@composables/agentBriefing/types";

/**
 * 画像生成エージェントの briefing flow.
 *
 * 4 ステップ:
 *   1. subject (text) — 主題 (何を描く?)
 *   2. style (chips) — スタイル
 *   3. aspectRatio (chips) — アスペクト比
 *   4. avoid (text, 任意) — 避けたい要素
 */
export const imageAgentBriefingConfig: BriefingFlowConfig = {
  id: "imageAgent",
  title: "画像生成: 前準備",
  subtitle: "OpenAI gpt-image-2 で生成する画像のイメージを 4 ステップで揃えます",
  icon: "material-symbols:image",
  accent: "purple",
  skipLabel: "プロンプトを直接書く",
  finalize: {
    heading: "OK! このイメージで生成しますね.",
    sub: "gpt-image-2 で 1-4 枚を生成します. 結果を見て派生も依頼できます.",
    confirmLabel: "画像を生成する",
  },
  mascot: {
    imageSrc: "/en-ai-avatar-violet.png",
    altText: "画像生成 AI バディ",
    linesByStep: {
      1: [
        "何を描く?\n主題を 1-2 文で!",
        "シチュエーション・モノ・人\n何でも OK!",
      ],
      2: [
        "スタイルは?\n写真風? イラスト?",
        "雰囲気が決まると\n仕上がりがブレない!",
      ],
      3: [
        "アスペクト比は?\nどこで使うかで決めて!",
        "1:1 SNS, 16:9 OGP,\n9:16 スマホ縦!",
      ],
      4: [
        "避けたい要素ある?\n文字・人物・色など.",
        "なければスキップで OK!",
      ],
      5: [
        "完璧!\n画像を生成するね!",
        "確認 OK なら任せて!",
      ],
    },
  },
  fields: [
    {
      key: "subject",
      step: 1,
      kind: "text",
      heading: "何を描きますか?",
      hint: "主題を 1-2 文で. シーン・登場するモノ・色味・雰囲気など.",
      placeholder: "例: 富山湾の朝焼け. 漁船 1 隻, 遠くに立山連峰, 静かな海面",
      stickyLabel: "主題",
      stickyTone: "purple",
    },
    {
      key: "style",
      step: 2,
      kind: "chips",
      heading: "スタイルは?",
      hint: "1 つ選ぶか自由入力. 複数組み合わせも OK.",
      placeholder: "例: ミニマルなフラットイラスト",
      stickyLabel: "スタイル",
      stickyTone: "purple",
      samples: [
        "写真調",
        "デジタルアート",
        "フラットイラスト",
        "水彩風",
        "3D レンダリング",
        "ミニマル",
        "コーポレート",
      ],
    },
    {
      key: "aspectRatio",
      step: 3,
      kind: "chips",
      heading: "アスペクト比は?",
      hint: "用途に合わせて 1 つ選んでください.",
      placeholder: "例: 16:9",
      stickyLabel: "比率",
      stickyTone: "purple",
      samples: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    },
    {
      key: "avoid",
      step: 4,
      kind: "text",
      heading: "避けたい要素はありますか? (任意)",
      hint: "「文字を入れない」「顔は出さない」「派手な色は使わない」など.",
      placeholder: "例: 文字・人物の顔は入れないでください",
      stickyLabel: "NG 要素",
      stickyTone: "purple",
    },
  ],
  buildPrompt: (draft) => {
    const subject =
      typeof draft.subject === "string" ? draft.subject.trim() : "";
    const style = Array.isArray(draft.style)
      ? draft.style.filter((s): s is string => typeof s === "string").join(", ")
      : "";
    const aspect = Array.isArray(draft.aspectRatio)
      ? (draft.aspectRatio.filter(
          (a): a is string => typeof a === "string"
        )[0] ?? "1:1")
      : "1:1";
    const avoid = typeof draft.avoid === "string" ? draft.avoid.trim() : "";

    return [
      "# 主題",
      subject || "(未指定)",
      "",
      `# スタイル: ${style || "(指定なし)"}`,
      `# アスペクト比: ${aspect}`,
      "",
      "# 避けたい要素",
      avoid || "(指定なし)",
      "",
      `上記を踏まえ、generate_image を呼んで画像を 1 枚生成してください. aspect_ratio="${aspect}" を必ず付けてください.`,
    ].join("\n");
  },
};
