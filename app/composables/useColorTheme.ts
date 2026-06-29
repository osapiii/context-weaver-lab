/**
 * 組織単位の Nuxt UI カラーテーマ切り替え。
 *
 * `useAppConfig().ui.colors` をランタイムで上書きすることで、UButton / UBadge /
 * UInput など Nuxt UI コンポーネントの primary / secondary / accent / neutral を
 * 一括で差し替える。`bg-primary-500` / `themeSemanticClasses` / EnButton `color="primary"`
 * (Button3D `theme`) も追従する。AI 専用の violet/purple 直書きは意図的にテーマ外。
 *
 * 保存先は organizations.branding.colorThemeId (Firestore)。組織メンバー全員で共有される。
 */

export type ColorThemePresetId =
  | "violet"
  | "emerald"
  | "default"
  | "sunset"
  | "ocean"
  | "forest"
  | "mono";

export interface ColorThemePreset {
  id: ColorThemePresetId;
  label: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
  };
  /** UI プレビュー用の代表色 (Tailwind 各カラーの 500 番台) */
  swatch: {
    primary: string;
    secondary: string;
    neutral: string;
  };
}

export const COLOR_THEME_PRESETS: readonly ColorThemePreset[] = [
  {
    id: "violet",
    label: "ENOSTECH Violet",
    description:
      "ENOSTECH 標準。深い violet と purple/fuchsia のアクセントで AI Studio らしく見せる配色。",
    colors: {
      primary: "violet",
      secondary: "purple",
      accent: "fuchsia",
      neutral: "slate",
    },
    swatch: { primary: "#8b5cf6", secondary: "#a855f7", neutral: "#64748b" },
  },
  {
    id: "emerald",
    label: "StoryVault Emerald",
    description:
      "StoryVault 向け。深い emerald と teal を中心に、知識管理らしい落ち着きと鮮度を両立する配色。",
    colors: {
      primary: "emerald",
      secondary: "teal",
      accent: "emerald",
      neutral: "slate",
    },
    swatch: { primary: "#10b981", secondary: "#14b8a6", neutral: "#64748b" },
  },
  {
    id: "default",
    label: "デフォルト Teal",
    description:
      "EN AIstudio 標準。落ち着いた teal と emerald を組み合わせた配色。",
    colors: {
      primary: "teal",
      secondary: "emerald",
      accent: "teal",
      neutral: "slate",
    },
    swatch: { primary: "#14b8a6", secondary: "#10b981", neutral: "#64748b" },
  },
  {
    id: "sunset",
    label: "サンセット",
    description: "夕焼けのような暖色系。前向きでエネルギッシュな印象。",
    colors: {
      primary: "violet",
      secondary: "rose",
      accent: "violet",
      neutral: "slate",
    },
    swatch: { primary: "#7c3aed", secondary: "#f43f5e", neutral: "#64748b" },
  },
  {
    id: "ocean",
    label: "オーシャン",
    description: "海と空をイメージしたブルー基調。爽やかで信頼感のある印象。",
    colors: {
      primary: "sky",
      secondary: "indigo",
      accent: "sky",
      neutral: "slate",
    },
    swatch: { primary: "#0ea5e9", secondary: "#6366f1", neutral: "#64748b" },
  },
  {
    id: "forest",
    label: "フォレスト",
    description: "森の緑。自然・成長を感じさせるアースカラー寄りの配色。",
    colors: {
      primary: "emerald",
      secondary: "lime",
      accent: "emerald",
      neutral: "stone",
    },
    swatch: { primary: "#10b981", secondary: "#84cc16", neutral: "#78716c" },
  },
  {
    id: "mono",
    label: "モノクローム",
    description: "彩度を抑えた無彩色。情報密度の高い画面でも目が疲れにくい。",
    colors: {
      primary: "slate",
      secondary: "zinc",
      accent: "slate",
      neutral: "zinc",
    },
    swatch: { primary: "#64748b", secondary: "#71717a", neutral: "#71717a" },
  },
] as const;

export const DEFAULT_COLOR_THEME_ID: ColorThemePresetId = "emerald";

/**
 * 組織カラーテーマ (Nuxt UI `primary`) に追従する Tailwind クラス。
 * `bg-violet-500` のような直書きの代わりに CTA / 選択枠 / ツールバーで使う。
 * AI 専用 UI (`variant="ai"` 等) は violet/purple のまま維持すること。
 */
export const themeSemanticClasses = {
  selectionCard: "border-primary-400 ring-2 ring-primary-200",
  selectionIcon: "text-primary-500",
  ctaSolid:
    "font-bold shadow-md ring-1 ring-primary-400 bg-primary-500 hover:bg-primary-600 text-white",
  ctaSolidDisabled:
    "bg-primary-200 text-primary-50 ring-primary-200 cursor-not-allowed",
  toolbarBanner:
    "border-b border-primary-200 dark:border-primary-900/50 bg-gradient-to-r from-primary-50 via-white to-primary-50/80 dark:from-primary-950/30 dark:via-slate-950/30 dark:to-primary-950/30",
} as const;

const isValidThemeId = (id: unknown): id is ColorThemePresetId =>
  typeof id === "string" &&
  COLOR_THEME_PRESETS.some((preset) => preset.id === id);

export const useColorTheme = () => {
  const organization = useOrganizationStore();

  const currentThemeId = computed<ColorThemePresetId>(() => {
    const saved = organization.loggedInOrganizationInfo.branding?.colorThemeId;
    return isValidThemeId(saved) ? saved : DEFAULT_COLOR_THEME_ID;
  });

  /** Nuxt UI の ui.colors を上書きして即時反映する (永続化しない).
   *  Object.assign での mutate ではなく updateAppConfig を使うことで
   *  Nuxt UI 内部の CSS 変数 (`--ui-color-primary-*` 等) の再生成を確実に走らせる. */
  const applyTheme = (id: ColorThemePresetId) => {
    const preset = COLOR_THEME_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    updateAppConfig({ ui: { colors: preset.colors } });
  };

  /** 即時適用 + Firestore (organizations.branding.colorThemeId) に保存 */
  const selectTheme = async (id: ColorThemePresetId) => {
    const previousId = currentThemeId.value;
    applyTheme(id);
    try {
      await organization.updateBranding({ colorThemeId: id });
    } catch (error) {
      applyTheme(previousId);
      throw error;
    }
  };

  return {
    presets: COLOR_THEME_PRESETS,
    currentThemeId,
    applyTheme,
    selectTheme,
  };
};
