import type { AdkAgentMode } from "@composables/useAgentSseClient";
import { AI_STUDIO_HUB_JOB_META } from "@constants/aiStudioHub";

export type AiStudioWorkspaceMode = Extract<
  AdkAgentMode,
  | "consultation"
  | "writing"
  | "sheet"
  | "image"
  | "research"
  | "data_analysis"
  | "web_page"
>;

export const AI_STUDIO_MODE_META: Record<
  AiStudioWorkspaceMode,
  {
    label: string;
    shortLabel: string;
    icon: string;
    badgeClass: string;
  }
> = {
  consultation: {
    label: AI_STUDIO_HUB_JOB_META.consultation.label,
    shortLabel: AI_STUDIO_HUB_JOB_META.consultation.shortLabel,
    icon: AI_STUDIO_HUB_JOB_META.consultation.icon,
    badgeClass:
      "bg-sky-50 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800/50",
  },
  writing: {
    label: AI_STUDIO_HUB_JOB_META.writing.label,
    shortLabel: AI_STUDIO_HUB_JOB_META.writing.shortLabel,
    icon: AI_STUDIO_HUB_JOB_META.writing.icon,
    badgeClass:
      "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50",
  },
  sheet: {
    label: AI_STUDIO_HUB_JOB_META.sheet.label,
    shortLabel: AI_STUDIO_HUB_JOB_META.sheet.shortLabel,
    icon: AI_STUDIO_HUB_JOB_META.sheet.icon,
    badgeClass:
      "bg-green-50 text-green-800 ring-1 ring-green-200 dark:bg-green-950/40 dark:text-green-200 dark:ring-green-800/50",
  },
  image: {
    label: AI_STUDIO_HUB_JOB_META.image.label,
    shortLabel: AI_STUDIO_HUB_JOB_META.image.shortLabel,
    icon: AI_STUDIO_HUB_JOB_META.image.icon,
    badgeClass:
      "bg-violet-50 text-violet-800 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-800/50",
  },
  data_analysis: {
    label: AI_STUDIO_HUB_JOB_META.data_analysis.label,
    shortLabel: AI_STUDIO_HUB_JOB_META.data_analysis.shortLabel,
    icon: AI_STUDIO_HUB_JOB_META.data_analysis.icon,
    badgeClass:
      "bg-teal-50 text-teal-800 ring-1 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-800/50",
  },
  web_page: {
    label: AI_STUDIO_HUB_JOB_META.web_page.label,
    shortLabel: AI_STUDIO_HUB_JOB_META.web_page.shortLabel,
    icon: AI_STUDIO_HUB_JOB_META.web_page.icon,
    badgeClass:
      "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-800/50",
  },
  research: {
    label: AI_STUDIO_HUB_JOB_META.research.label,
    shortLabel: AI_STUDIO_HUB_JOB_META.research.shortLabel,
    icon: AI_STUDIO_HUB_JOB_META.research.icon,
    badgeClass:
      "bg-slate-50 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-950/40 dark:text-slate-200 dark:ring-slate-800/50",
  },
};

export function isAiStudioWorkspaceMode(
  value: unknown
): value is AiStudioWorkspaceMode {
  return (
    value === "consultation" ||
    value === "writing" ||
    value === "sheet" ||
    value === "image" ||
    value === "research" ||
    value === "data_analysis" ||
    value === "web_page"
  );
}

/** ワークスペース左ペイン・ヘッダー用の短いモード名 */
export const AI_STUDIO_MODE_PANEL_TITLE: Record<AiStudioWorkspaceMode, string> = {
  consultation: "経営相談モード",
  writing: "書類記入モード",
  sheet: "シート編集モード",
  image: "画像生成モード",
  research: "調査レポートモード",
  data_analysis: "データ分析モード",
  web_page: "WEBページモード",
};

export const AI_STUDIO_CONCIERGE_PANEL_TITLE = "コンシェルジュモード";

export function resolveAiStudioPanelTitle(
  mode: AdkAgentMode | null | undefined
): string {
  if (mode && isAiStudioWorkspaceMode(mode)) {
    return AI_STUDIO_MODE_PANEL_TITLE[mode];
  }
  return AI_STUDIO_CONCIERGE_PANEL_TITLE;
}

export function modeMeta(mode: AiStudioWorkspaceMode | null | undefined) {
  if (!mode) {
    return {
      label: "コンシェルジュ",
      shortLabel: "自動",
      icon: "material-symbols:auto-awesome",
      badgeClass:
        "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700",
    };
  }
  return AI_STUDIO_MODE_META[mode];
}
