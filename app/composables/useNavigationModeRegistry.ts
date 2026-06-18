/**
 * グローバルナビゲーションのモード制レジストリ。
 *
 * ## 世界観
 * 本アプリの主役は「AI に作業を丸投げ依頼する」こと。
 * その世界観を 4 モードで構造化する:
 *
 * 1. **ホーム** (着地点)         — AI Studio の入口とシステム稼働状況の俯瞰
 * 2. **仕事をこなす** (今)       — AI に依頼する
 * 3. **AI を育てる** (長期投資)  — ナレッジ (PDF / 文書) を AI に教える
 *
 * ## ナビ方式
 * グローバルサイドバーは 4 モードのスイッチだけを持つ縦長 Activity Bar。
 * 各モードの TOP ページ (`/admin`, `/admin/work`, `/admin/prepare`,
 * `/admin/data-source`) はカードグリッドで個別機能への入口を提供する。
 * 深い nested メニューはサイドバーから排除し、入口は各モード TOP に集約する
 * (ユーザー指示)。
 *
 * ※ 旧 `analyze` (データを見る・分析) と `integrate` (データを連携する) は機能を
 * 整理して廃止. 経営ダッシュボード等の閲覧画面は直接 URL でアクセス可能 (nav からは消えただけ).
 * AI データ分析は「仕事をこなす」モード配下に coming-soon カードとして残してある.
 */

export type NavBehavior = "page" | "modal" | "panel";

/**
 * AI 代行度。「AI が代わりにやる」「AI が補助する」「人が入れる」の 3 段階。
 */
export type AiSupportLevel = "auto" | "assist" | "user";

export type NavCardGroup = {
  /** カード群のセクション見出し (例: "実績登録" "マスタ" "AI 補助") */
  key: string;
  label: string;
  description?: string;
  cards: NavCard[];
};

export type NavCard = {
  key: string;
  label: string;
  description?: string;
  /**
   * AI 操作アシスタント (Cmd+K) 向けの「ここで何ができるか」詳細説明 (2-3 文)。
   * system prompt に注入され、AI がユーザーの困りごとに対して
   * 「○○なら ○○カード が便利です」と提案する材料になる。
   */
  purpose?: string;
  /**
   * カード Hero / タイトル行の Iconify 名。
   * flat-color-icons / vscode-icons 等のカラー set を推奨 (`useNavCardIcons`)。
   */
  icon: string;
  behavior: NavBehavior;
  /** behavior=page の遷移先ルート名 */
  routeName?: string;
  /** behavior=page の query (例: AIスタジオの kind フィルタ) */
  routeQuery?: Record<string, string>;
  /** "準備中" "Beta" 等のバッジ */
  badge?: string;
  /**
   * true の場合、TOP からのクリック遷移を禁止する (準備中バッジ表示込み)。
   * badge を併用して視覚的にも準備中と分かるようにすること。
   */
  comingSoon?: boolean;
  /** behavior=modal|panel の場合、launcher で参照するキー */
  launcher?:
    | "business-consultation"
    | "writing"
    | "sheet"
    | "image";
  /**
   * 「どんなときに使うか」をパッと示す soft chips (最大 2 個)。
   * ぱっと見で選択に迷わないようにするためのヒント文。
   */
  useCases?: string[];
};

/**
 * 4 モードのどれにも属さない「グローバル設定系」ルート。
 * 例: `/admin/preferences` (設定)。サイドナビの 4 モードタブからは辿らないが、
 * 操作アシスタントがページ認識・案内できるよう登録しておく。
 */
export type GlobalRoute = {
  routeName: string;
  label: string;
  icon: string;
  description: string;
  /** AI 操作アシスタント向けの詳細説明 */
  purpose: string;
  /** 実 URL (動的セグメントが無い前提) */
  path: string;
};

/**
 * リボン上の視覚グループ。proximity (近接) でカテゴリを伝えるための識別子。
 * - "home"   : ログイン後の着地点 (1 ボタンだけ)
 * - "ai"     : AI を能動的に動かす / 育てる
 * - "data"   : データを連携・確認する
 */
export type NavGroupId = "home" | "ai" | "data";

export type NavMode = {
  key: "home" | "work" | "grow" | "worklog";
  /** リボンでの視覚グループ (この値が連続する modes は 1 グループとして縦線で区切る) */
  navGroup: NavGroupId;
  label: string;
  /** モード説明 (サイドバー縮小時のツールチップ / TOP ページのヘッダー) */
  subtitle: string;
  icon: string;
  /** モード home の route name */
  homeRouteName: string;
  /**
   * モード固有の差し色 (アイコンのみに適用)。
   * Button3D 本体は全モード共通で `neutral` グレーに統一し、
   * アイコンの色だけでモードを識別する (派手すぎず地味すぎず)。
   */
  accent: "purple" | "warning" | "success" | "neutral" | "info";
  /** AI 代行度 (モード説明バッジ) */
  aiSupport?: AiSupportLevel;
  /** "準備中" 等のモード自体のバッジ */
  badge?: string;
  /** モード TOP のカードグループ群 */
  groups: NavCardGroup[];
  /** このモードに属する route 名 (URL → モード逆引き用) */
  ownedRouteNamePrefixes: string[];
};

export const useNavigationModeRegistry = () => {
  const navModeIcons = useNavModeIcons();
  const navCardIcons = useNavCardIcons();

  const modes: NavMode[] = [
    // ⓪ ホーム
    {
      key: "home",
      navGroup: "home",
      label: "ホーム",
      subtitle: "AI Studio と稼働状況の俯瞰",
      icon: navModeIcons.home,
      homeRouteName: "admin",
      accent: "neutral",
      // ホームは TOP 1 枚しか持たないので prefix は空。
      // homeRouteName === "admin" の直接一致だけで認識する。
      ownedRouteNamePrefixes: [],
      groups: [],
    },

    // ① 仕事をこなす (AI へ仕事を依頼するエントリ群)
    {
      key: "work",
      navGroup: "ai",
      label: "仕事をこなす",
      subtitle: "AI に作業を依頼する",
      icon: navModeIcons.work,
      homeRouteName: "admin-work",
      accent: "purple",
      ownedRouteNamePrefixes: [
        "admin-work",
        // AI Studio ハブ + Workspace (経営相談 / 文書生成 / 画像生成 を統合)
        "admin-ai-studio",
        // 「リサーチエージェント」の能動的な生成セッション画面
        "admin-research-agent",
        "admin-researches",
        "admin-vibe-control",
        "admin-data-analysis",
        // レガシー一覧 → AI スタジオへリダイレクト
        "admin-writings",
        "admin-sheets",
        "admin-images",
      ],
      groups: [
        {
          key: "ai-delegate",
          label: "AI に依頼",
          description: "丸投げで AI に作業をしてもらう",
          cards: [
            {
              key: "business-consultation",
              label: "経営相談",
              description:
                "ナレッジを踏まえ、AI と対話で経営課題を整理",
              purpose:
                "経営相談 Workspace では、社内ナレッジを参照しながら AI とチャットできます. 論点整理や、次に打つべき手の相談に向いています.",
              icon: navCardIcons.businessConsultation,
              behavior: "page",
              routeName: "admin-ai-studio",
              routeQuery: { kind: "consultation" },
              useCases: ["経営判断", "論点整理"],
            },
            {
              key: "ai-writing",
              label: "書類記入",
              description: "フォーマットに沿って AI が文書・帳票を作成",
              purpose:
                "書類記入 (文書生成) では、テンプレートや入力項目を確認しながら AI が文書を起こします. 報告書・申請書・社内フォーマットへの記入を任せたい時に使います.",
              icon: navCardIcons.aiWriting,
              behavior: "page",
              routeName: "admin-ai-studio",
              routeQuery: { kind: "writing" },
              useCases: ["報告書", "申請書"],
            },
            {
              key: "slides-research",
              label: "調査レポート作成",
              description:
                "テーマを伝えると AI が調査し、完了時にメールでお知らせ",
              purpose:
                "調査レポート作成では、テーマとヒアリング内容をもとに Web 調査 → 構造化 → HTML レポートまでを AI がバックグラウンドで進めます. 完了時にメール通知されます.",
              icon: navCardIcons.slidesResearch,
              behavior: "page",
              routeName: "admin-ai-studio",
              routeQuery: { kind: "research" },
              badge: "Beta",
              useCases: ["市場調査", "題材リサーチ"],
            },
            {
              key: "vibe-control",
              label: "VibeControl",
              description: "仕様・根拠・コード状態からユーザーストーリーSSOTを構築",
              purpose:
                "VibeControl では、FileSpace に登録されたナレッジと GitHub の現在状態を突き合わせ、根拠・信頼度・差分を持つユーザーストーリー台帳を確認できます。Visual QA は含めず、まずSSOTの正確性に集中します。",
              icon: navCardIcons.vibeControl,
              behavior: "page",
              routeName: "admin-vibe-control",
              badge: "MVP",
              useCases: ["SSOT構築", "仕様差分確認"],
            },
            {
              key: "ai-image",
              label: "画像生成",
              description: "参照画像や指示から、製品・広告用ビジュアルを生成",
              purpose:
                "画像生成 Workspace では、テキスト指示や参照画像からビジュアルを生成・修正できます. 商品イメージや説明用イラストのたたき台づくりに使います.",
              icon: navCardIcons.aiImage,
              behavior: "page",
              routeName: "admin-ai-studio",
              routeQuery: { kind: "image" },
              useCases: ["商品画像", "説明用イラスト"],
            },
          ],
        },
      ],
    },

    // ② AI を育てる
    {
      key: "grow",
      navGroup: "ai",
      // ナビ UI 上はカードグリッド TOP を経由せず、ワークスペース (admin-data-source) に
      // 直接遷移する (ユーザー指示)。groups は AI 操作アシスタントが各機能を案内する
      // 材料として残しているが、画面遷移には使われない。
      label: "AI を育てる",
      subtitle: "PDF や文書を教えて AI を賢くする",
      icon: navModeIcons.grow,
      homeRouteName: "admin-data-source",
      accent: "success",
      aiSupport: "user",
      ownedRouteNamePrefixes: [
        "admin-data-source",
        "admin-business-partners",
        "admin-request-logs",
        "admin-storage",
      ],
      groups: [
        {
          key: "knowledge",
          label: "知識を与える",
          description: "AI が参照するナレッジ素材を投入する",
          cards: [
            {
              key: "knowledge-materials",
              label: "ナレッジ素材",
              description: "PDF / 文書 / Web ページを AI に教える",
              purpose:
                "AI 部下 (経営相談) が参照するナレッジ素材を投入します。PDF / 文書ファイルのアップロードと、Web ページの URL クローリングに対応。素材を増やすほど AI の回答精度が上がります。",
              icon: navCardIcons.knowledgeMaterials,
              behavior: "page",
              routeName: "admin-data-source",
              useCases: ["資料の追加", "AI への学習"],
            },
            {
              key: "business-partners",
              label: "取引先",
              description: "顧客・仕入先などの法人情報を登録・管理",
              purpose:
                "取引先では、顧客・仕入先などの法人情報を登録できます。公式サイト URL や法人番号からAIで基本情報を補完し、連絡先・所在地・ロゴなどを管理できます。",
              icon: navCardIcons.businessPartners,
              behavior: "page",
              routeName: "admin-business-partners-list",
              useCases: ["顧客管理", "仕入先管理"],
            },
          ],
        },
        {
          key: "observe",
          label: "AI の挙動を確かめる",
          description: "AI が何を考え何をしたかを観察",
          cards: [
            {
              key: "request-logs",
              label: "リクエストログ",
              description: "AI への依頼履歴と結果を時系列で確認",
              purpose:
                "AI に投げたリクエスト (Web クロール / Drive 同期 / ADK 実行 等) の履歴とステータスを時系列で確認できます。AI が今何をしているか / 過去何を頼んだかを把握したい時に。",
              icon: navCardIcons.requestLogs,
              behavior: "page",
              routeName: "admin-request-logs",
              useCases: ["挙動の振り返り", "結果のトレース"],
            },
          ],
        },
      ],
    },

    // ③ 仕事ログ (実行中・完了した AI / Workflow ジョブの一覧)
    {
      key: "worklog",
      navGroup: "ai",
      label: "仕事ログ",
      subtitle: "実行中・完了したジョブを確認",
      icon: navModeIcons.worklog,
      homeRouteName: "admin-workflow-executions",
      accent: "info",
      ownedRouteNamePrefixes: ["admin-workflow-executions"],
      groups: [],
    },

  ];

  /**
   * どの 4 モードにも属さない「グローバル設定系」ルートの一覧。
   * 例: `/admin/preferences` (設定) は home / work / prepare / grow のどれにも
   * 属さないが、操作アシスタントには認識させて案内可能にする必要がある。
   */
  const globalRoutes: GlobalRoute[] = [
    {
      routeName: "admin-api-keys",
      label: "API キー",
      icon: "material-symbols:key",
      description: "Gemini 等の API キーを登録",
      purpose:
        "AI 機能を使うための Gemini API キー (BYOK) を登録します。組織の他ユーザーからは見えません。",
      path: "/admin/api-keys",
    },
    {
      routeName: "admin-settings",
      label: "組織設定",
      icon: "material-symbols:groups",
      description: "ユーザー・メール送信元などの組織管理",
      purpose: "組織のユーザー管理や Google 連携ユーザー、送信元メールの設定を行います。",
      path: "/admin/settings",
    },
    {
      routeName: "admin-preferences",
      label: "設定",
      icon: "material-symbols:tune",
      description: "アプリの外観 / API キーなどの個人・組織設定",
      purpose:
        "アプリ全体の設定画面。外観タブでヘッダーロゴ画像を差し替え、AI 連携タブで Gemini API キー (BYOK) を登録、その他タブでその他のグローバル設定を行います。ショートカット `Cmd + ,` (Ctrl + ,) でいつでも開けます。",
      path: "/admin/preferences",
    },
  ];

  /** 現在のルート名から該当モードを逆引きする */
  const findModeByRouteName = (routeName: string): NavMode | undefined => {
    if (!routeName) return undefined;
    // home route と直接一致するか
    const directHit = modes.find((m) => m.homeRouteName === routeName);
    if (directHit) return directHit;
    // prefix マッチ
    return modes.find((m) =>
      m.ownedRouteNamePrefixes.some((prefix) =>
        routeName.startsWith(prefix)
      )
    );
  };

  /** グローバル設定ルートを名前で引く (4 モードに属さない設定系ページ用) */
  const findGlobalRouteByName = (
    routeName: string
  ): GlobalRoute | undefined => {
    if (!routeName) return undefined;
    return globalRoutes.find((r) => r.routeName === routeName);
  };

  return {
    modes,
    findModeByRouteName,
    globalRoutes,
    findGlobalRouteByName,
  };
};
