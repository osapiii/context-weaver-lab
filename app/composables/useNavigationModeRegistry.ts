export type NavBehavior = "page" | "modal" | "panel";
export type AiSupportLevel = "auto" | "assist" | "user";

export type NavCardGroup = {
  key: string;
  label: string;
  description?: string;
  cards: NavCard[];
};

export type NavCard = {
  key: string;
  label: string;
  description?: string;
  purpose?: string;
  icon: string;
  behavior: NavBehavior;
  routeName?: string;
  routeQuery?: Record<string, string>;
  badge?: string;
  comingSoon?: boolean;
  launcher?:
    | "business-consultation"
    | "writing"
    | "sheet"
    | "image";
  useCases?: string[];
};

export type GlobalRoute = {
  routeName: string;
  label: string;
  icon: string;
  description: string;
  purpose: string;
  path: string;
};

export type NavGroupId = "input" | "analysis" | "admin";

export type NavMode = {
  key:
    | "knowledge"
    | "operation-videos"
    | "git-repositories"
    | "stories"
    | "settings";
  navGroup: NavGroupId;
  label: string;
  subtitle: string;
  icon: string;
  homeRouteName: string;
  homeRouteQuery?: Record<string, string>;
  accent: "purple" | "warning" | "success" | "neutral" | "info";
  aiSupport?: AiSupportLevel;
  badge?: string;
  groups: NavCardGroup[];
  ownedRouteNamePrefixes: string[];
};

export const useNavigationModeRegistry = () => {
  const navModeIcons = useNavModeIcons();

  const modes: NavMode[] = [
    {
      key: "knowledge",
      navGroup: "input",
      label: "AIに教える",
      subtitle: "仕様書・URL・Google Driveを投入してAIの理解を育てる",
      icon: navModeIcons.grow,
      homeRouteName: "admin-storyvault",
      homeRouteQuery: { view: "application-knowledge" },
      accent: "purple",
      ownedRouteNamePrefixes: ["admin-storyvault"],
      groups: [],
    },
    {
      key: "operation-videos",
      navGroup: "input",
      label: "操作動画",
      subtitle: "音声付きの操作動画を録画し、解析の材料として蓄積",
      icon: navModeIcons.operationVideos,
      homeRouteName: "admin-storyvault",
      homeRouteQuery: { view: "application-zapping" },
      accent: "purple",
      ownedRouteNamePrefixes: ["admin-storyvault"],
      groups: [],
    },
    {
      key: "git-repositories",
      navGroup: "input",
      label: "Gitリポジトリ",
      subtitle: "接続済みリポジトリ、PR、アプリ紐付けを確認",
      icon: "i-simple-icons-github",
      homeRouteName: "admin-storyvault",
      homeRouteQuery: { view: "repositories" },
      accent: "neutral",
      ownedRouteNamePrefixes: ["admin-storyvault"],
      groups: [],
    },
    {
      key: "stories",
      navGroup: "input",
      label: "ユーザーストーリー",
      subtitle: "解析結果から生成されたユーザーストーリーをレビュー",
      icon: navModeIcons.stories,
      homeRouteName: "admin-storyvault",
      homeRouteQuery: { view: "stories" },
      accent: "info",
      ownedRouteNamePrefixes: ["admin-storyvault"],
      groups: [],
    },
    {
      key: "settings",
      navGroup: "admin",
      label: "設定",
      subtitle: "アプリの外観・メンバー・API キーを管理",
      icon: "material-symbols:tune",
      homeRouteName: "admin-preferences",
      accent: "neutral",
      ownedRouteNamePrefixes: [
        "admin-preferences",
        "admin-settings",
        "admin-api-keys",
      ],
      groups: [],
    },
  ];

  const globalRoutes: GlobalRoute[] = [
    {
      routeName: "admin-api-keys",
      label: "API キー",
      icon: "material-symbols:key",
      description: "Gemini 等の API キーを登録",
      purpose:
        "AI 機能を使うための Gemini API キーを登録します。組織の他ユーザーからは見えません。",
      path: "/admin/api-keys",
    },
    {
      routeName: "admin-settings",
      label: "組織設定",
      icon: "material-symbols:groups",
      description: "ユーザー・メール送信元などの組織管理",
      purpose:
        "組織のユーザー管理や Google 連携ユーザー、送信元メールの設定を行います。",
      path: "/admin/settings",
    },
    {
      routeName: "admin-preferences",
      label: "設定",
      icon: "material-symbols:tune",
      description: "アプリの外観 / API キーなどの個人・組織設定",
      purpose:
        "アプリ全体の設定画面。外観、AI 連携、その他のグローバル設定を行います。",
      path: "/admin/preferences",
    },
  ];

  const findModeByRouteName = (routeName: string): NavMode | undefined => {
    if (!routeName) return undefined;
    const directHit = modes.find((mode) => mode.homeRouteName === routeName);
    if (directHit) return directHit;
    return modes.find((mode) =>
      mode.ownedRouteNamePrefixes.some((prefix) =>
        routeName.startsWith(prefix)
      )
    );
  };

  const findGlobalRouteByName = (
    routeName: string
  ): GlobalRoute | undefined => {
    if (!routeName) return undefined;
    return globalRoutes.find((route) => route.routeName === routeName);
  };

  return {
    modes,
    findModeByRouteName,
    globalRoutes,
    findGlobalRouteByName,
  };
};
