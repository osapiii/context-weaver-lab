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

export type NavGroupId = "home" | "ai" | "data";

export type NavMode = {
  key: "applications" | "stories" | "worklog" | "settings";
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
  const navCardIcons = useNavCardIcons();

  const modes: NavMode[] = [
    {
      key: "applications",
      navGroup: "home",
      label: "アプリ",
      subtitle: "ユーザーストーリーを束ねるアプリ単位を管理",
      icon: navModeIcons.applications,
      homeRouteName: "admin-vibe-control",
      homeRouteQuery: { view: "applications" },
      accent: "neutral",
      ownedRouteNamePrefixes: ["admin-vibe-control"],
      groups: [],
    },
    {
      key: "stories",
      navGroup: "home",
      label: "ユーザーストーリー",
      subtitle: "仕様・根拠・コード状態をストーリー単位で確認",
      icon: navModeIcons.stories,
      homeRouteName: "admin-vibe-control",
      homeRouteQuery: { view: "stories" },
      accent: "neutral",
      ownedRouteNamePrefixes: ["admin-vibe-control"],
      groups: [],
    },
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
    {
      key: "settings",
      navGroup: "data",
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
