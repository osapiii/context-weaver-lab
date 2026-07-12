/**
 * EN AIstudio 統合アシスタントの system prompt / 実行時コンテキスト構築。
 *
 * 操作ガイドのヘルプ本文は Firebase Callable BFF + Gemini File Search Store に移行。
 * ここでは intent 分類用の振る舞いルールと、guide 向けのナビ・画面コンテキストのみを組み立てる。
 */

export type EnAiStudioSessionMode =
  | "guide"
  | "consultation"
  | "writing"
  | "sheet"
  | "image"
  | null;

/**
 * セッション mode の集合 (null 以外)。
 * intent 分類・色マップ・ラベルマップなど、列挙が必要な箇所で使う。
 */
export const EN_AISTUDIO_SESSION_MODES = [
  "guide",
  "consultation",
  "writing",
  "sheet",
  "image",
] as const;

export type EnAiStudioSessionModeKey = (typeof EN_AISTUDIO_SESSION_MODES)[number];

/** ADK 経路. guide は Firebase Callable BFF を使うため含めない. */
export const ADK_MODES = [
  "writing",
  "sheet",
  "image",
  "consultation",
] as const;
export type AdkMode = (typeof ADK_MODES)[number];
export const isAdkMode = (m: EnAiStudioSessionMode): m is AdkMode =>
  m === "writing" ||
  m === "sheet" ||
  m === "image" ||
  m === "consultation";

export const useEnAiStudioAssistantContext = () => {
  const route = useRoute();
  const { modes, findModeByRouteName, globalRoutes, findGlobalRouteByName } =
    useNavigationModeRegistry();

  /** 4 モード x グループ x カードを LLM 向けに整形 */
  const buildNavSection = (): string => {
    const lines: string[] = [];
    modes.forEach((mode, mIdx) => {
      const badge = mode.badge ? ` [${mode.badge}]` : "";
      lines.push(`### ${mIdx + 1}. ${mode.label}${badge} — ${mode.subtitle}`);
      lines.push(`  (モードTOP route: \`${mode.homeRouteName}\`)`);
      if (mode.groups.length === 0) {
        lines.push("  (空・準備中)");
      }
      mode.groups.forEach((group) => {
        lines.push(`  - **${group.label}**: ${group.description ?? ""}`);
        group.cards.forEach((card) => {
          const routeRef = card.routeName
            ? `route:${card.routeName}`
            : card.launcher
              ? `launcher:${card.launcher}`
              : `behavior:${card.behavior}`;
          const badgeStr = card.badge ? ` [${card.badge}]` : "";
          lines.push(`    - **${card.label}**${badgeStr} (\`${routeRef}\`)`);
          if (card.purpose) {
            lines.push(`      → ${card.purpose}`);
          }
        });
      });
      lines.push("");
    });

    if (globalRoutes.length > 0) {
      lines.push("### ⑤ グローバル (モード横断の設定系)");
      globalRoutes.forEach((g) => {
        lines.push(`  - **${g.label}** (\`route:${g.routeName}\`)`);
        lines.push(`    → ${g.purpose}`);
      });
      lines.push("");
    }
    return lines.join("\n");
  };

  /** 現在のユーザー状況サマリ */
  const buildCurrentStateSection = (): string => {
    const routeName = typeof route.name === "string" ? route.name : "(unknown)";
    const mode = findModeByRouteName(routeName);
    const global = !mode ? findGlobalRouteByName(routeName) : undefined;

    const modeLine = mode
      ? `${mode.label} (${mode.subtitle})`
      : global
        ? `グローバル設定: ${global.label} — ${global.description}`
        : "(モード未判定)";

    return [
      "## 現在のユーザー状況",
      `- 今いるページ: \`${routeName}\``,
      `- 所属モード: ${modeLine}`,
    ].join("\n");
  };

  /**
   * guide モード向け: ナビ全体図 + 現在画面を毎ターン注入する文字列.
   * (ヘルプ本文は Firebase Callable BFF の Gemini File Search から検索)
   */
  const buildGuideRuntimeContext = (): string => {
    return [
      "## EN AIstudio のナビ全体図",
      buildNavSection(),
      buildCurrentStateSection(),
    ].join("\n\n");
  };

  /** 統合アシスタント全体の振る舞いルール (mode 共通 + mode 別) */
  const buildBehaviorRules = (sessionMode: EnAiStudioSessionMode): string => {
    const intro = [
      "## あなたの役割",
      "あなたは EN AIstudio の AI アシスタントです。",
      "ユーザーの発話を読んで、次の 5 つのモードのいずれかで応答してください:",
      "",
      "- **経営相談モード** (intent: consultation): 「分析して」「原因は」「シミュレーションして」「相談したい」など、深い経営判断・データ解釈の壁打ち",
      "- **操作ガイドモード** (intent: guide): 「どこで何をすれば良いか」「使い方」「設定方法」など、EN AIstudio の機能・操作・場所の案内",
      "- **文章生成モード** (intent: writing): 「メール書いて」「社内通知の原稿」「議事録まとめて」「ブログの下書き」など、すぐコピペで使える文章成果物の生成",
      "- **スプレッドシート編集モード** (intent: sheet): 「シートに書き込んで」「行追加して」「集計して」「数式入れて」など、Google スプレッドシートに対する操作 (URL 必須)",
      "- **画像生成モード** (intent: image): 「画像作って」「アイコン生成」「OGP イメージ」「資料に貼る図」など、Imagen による画像生成",
      "",
    ];

    const intentDecl =
      sessionMode === null
        ? [
            "## モード判定 (今回はセッション 1 ターン目)",
            "今回の応答の **先頭の行** に、必ず次のいずれかのトークンだけを出力してください (前後に空白や別の文字を入れないこと):",
            "",
            "- `<<intent:guide>>` — 操作ガイドモードが妥当",
            "- `<<intent:consultation>>` — 経営相談モードが妥当",
            "- `<<intent:writing>>` — 文章生成モードが妥当",
            "- `<<intent:sheet>>` — スプレッドシート編集モードが妥当",
            "- `<<intent:image>>` — 画像生成モードが妥当",
            "",
            "トークンの次の行から本文を始めてください。トークンは UI 側で削除されてユーザーには見えません。",
            "",
            "**重要**: このトークンは 1 ターン目のみ必須です。2 ターン目以降は出さないでください。",
            "",
            "**補足**: writing / sheet / image モードは別の専用エージェントが応答するため、1 ターン目のここでは intent トークン + 1 行程度の確認 (「文章生成モードで進めますね」程度) だけ返してください。本格的な応答はモード確定後に専用エージェントが行います。",
            "",
          ]
        : (() => {
            const modeLabel = {
              guide: "操作ガイドモード",
              consultation: "経営相談モード",
              writing: "文章生成モード",
              sheet: "スプレッドシート編集モード",
              image: "画像生成モード",
            }[sessionMode];
            return [
              `## 現在のセッションのモード: ${modeLabel} (固定)`,
              "このセッションは既にモードが決まっているので、intent トークンは出さなくて大丈夫です。",
              "ユーザーが別モード向けの質問をしてきても、自分で対応しようとせず、次の通り誘導してください:",
              "",
              "- 「これは別モード向けのご相談のようです。一度パネルを閉じて (Esc キー) もう一度ご質問いただくと、その専用モードでお答えできます」と短く返してください。",
              "",
            ];
          })();

    const guideRules = [
      "## 操作ガイドモード の振る舞い (intent: guide)",
      "- 1 ターン目は intent トークンを出した上で、「操作ガイドモードで進めますね」と短く確認するだけに留めてください。実際の案内は専用ガイド BFF (Gemini File Search) が行います。",
    ];

    const consultationRules = [
      "## 経営相談モード の振る舞い (intent: consultation)",
      "- 経営判断の壁打ち相手になってください。深い分析・推論・観点提示を行います。",
      "- 数値・指標が話題に出たら、複数の観点 (短期/長期、コスト/品質/納期 等) で整理してください。",
      "- 結論を急がず、まずは「目的」「制約」「前提」を確認する問いを返すのが基本姿勢。ユーザーが意思決定者なので、選択肢と tradeoff を整理して提示してください。",
      "- 操作の case (「どこから入る?」など) が混ざった場合は、本筋の経営相談を進めつつ、必要なら最後に「実際に操作する画面はこちら」とだけ短く触れてください (深追いはしない)。",
      "- 出力は Markdown で。コードブロックは使わず、見出し・リスト・太字で構造を作ってください。",
    ];

    const writingHandoff = [
      "## 文章生成モード の振る舞い (intent: writing)",
      "- 1 ターン目は intent トークンを出した上で、「文章生成モードで進めますね。どんな文章を作りますか?」程度の短い確認だけ返してください。実際の生成は専用 ADK エージェントが行います。",
    ];

    const sheetHandoff = [
      "## スプレッドシート編集モード の振る舞い (intent: sheet)",
      "- 1 ターン目は intent トークンを出した上で、**スプレッドシート URL の貼付けを促す** 短いメッセージを返してください。例: 「スプレッドシート編集モードで進めますね。まず編集したい Google スプレッドシートの URL を貼ってください」",
      "- ユーザーの 1 ターン目に既に URL が含まれていた場合も、URL を受け取ったことを確認する短い返答だけ行ってください。実際の編集操作は専用 ADK エージェントが行います。",
    ];

    const imageHandoff = [
      "## 画像生成モード の振る舞い (intent: image)",
      "- 1 ターン目は intent トークンを出した上で、「画像生成モードで進めますね。どんな画像を作りますか?」程度の短い確認だけ返してください。実際の生成は専用 ADK エージェントが行います。",
    ];

    const rulesByMode =
      sessionMode === null
        ? [
            ...guideRules,
            "",
            ...consultationRules,
            "",
            ...writingHandoff,
            "",
            ...sheetHandoff,
            "",
            ...imageHandoff,
          ]
        : sessionMode === "guide"
          ? guideRules
          : sessionMode === "consultation"
            ? consultationRules
            : sessionMode === "writing"
              ? writingHandoff
              : sessionMode === "sheet"
                ? sheetHandoff
                : imageHandoff;

    return [...intro, ...intentDecl, ...rulesByMode].join("\n");
  };

  /**
   * intent 分類専用の軽量 system prompt (ブラウザ直 Gemini).
   * ヘルプ本文は含めない — guide 本体は Firebase Callable BFF + Gemini File Search.
   */
  const buildSystemPrompt = (sessionMode: EnAiStudioSessionMode): string => {
    return [
      "# EN AIstudio 統合アシスタント — system prompt (intent 分類)",
      "",
      buildBehaviorRules(sessionMode),
      "",
      "## EN AIstudio のナビ全体図 (参照用)",
      buildNavSection(),
      buildCurrentStateSection(),
    ].join("\n");
  };

  return {
    buildSystemPrompt,
    buildNavSection,
    buildCurrentStateSection,
    buildBehaviorRules,
    buildGuideRuntimeContext,
  };
};

/**
 * AI 応答先頭の intent トークンをパースする。
 * 戻り値: { mode, cleanedText } — mode が取れなければ null、cleanedText はトークンを除いた本文
 */
export const parseIntentToken = (
  text: string
): { mode: EnAiStudioSessionMode; cleanedText: string } => {
  const match = text.match(
    /^\s*<<intent:(guide|consultation|writing|sheet|image)>>\s*\n?/
  );
  if (!match) {
    return { mode: null, cleanedText: text };
  }
  const mode = match[1] as EnAiStudioSessionModeKey;
  const cleanedText = text.slice(match[0].length);
  return { mode, cleanedText };
};

/**
 * テキスト中の最初の Google スプレッドシート URL を抜き出して
 * spreadsheetId と元 URL を返す. 該当しなければ null.
 */
export const parseGoogleSheetUrl = (
  text: string
): { url: string; spreadsheetId: string } | null => {
  const match = text.match(
    /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})[^\s]*/
  );
  if (!match || !match[1]) return null;
  return { url: match[0], spreadsheetId: match[1] };
};
