import type { AiStudioJobKind } from "@stores/aiStudio";

/** ハブ一覧に載せる Workspace ジョブ */
export const AI_STUDIO_HUB_JOB_KINDS = [
  "consultation",
  "writing",
  "sheet",
  "image",
  "research",
  "data_analysis",
  "web_page",
] as const satisfies readonly Exclude<AiStudioJobKind, null>[];

export type AiStudioHubJobKind = (typeof AI_STUDIO_HUB_JOB_KINDS)[number];

/** Unified ADK の新規利用導線に表示するジョブ。sheet は既存セッション互換のため定義のみ残す。 */
export const AI_STUDIO_HUB_VISIBLE_JOB_KINDS = [
  "consultation",
  "writing",
  "image",
  "web_page",
  "research",
  "data_analysis",
] as const satisfies readonly AiStudioHubJobKind[];

export type AiStudioHubKindFilter = "all" | AiStudioHubJobKind;

export const AI_STUDIO_HUB_KIND_FILTER_ALL = "all" as const;

export const AI_STUDIO_HUB_ALL_TOGGLE_ICON = "flat-color-icons:combo-chart";

/** AiStudioModeSegmentBar 用の選択肢（ハブ / ワークスペース共通） */
export type AiStudioModeSegmentOption = {
  value: string;
  label: string;
  icon?: string;
  count?: number;
};

export const isAiStudioHubJobKind = (
  value: string | null | undefined
): value is AiStudioHubJobKind =>
  !!value &&
  (AI_STUDIO_HUB_JOB_KINDS as readonly string[]).includes(value);

export const parseAiStudioHubKindFilter = (
  value: string | null | undefined | readonly (string | null)[]
): AiStudioHubKindFilter => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === AI_STUDIO_HUB_KIND_FILTER_ALL) {
    return AI_STUDIO_HUB_KIND_FILTER_ALL;
  }
  if (isAiStudioHubJobKind(raw)) {
    return raw;
  }
  return AI_STUDIO_HUB_KIND_FILTER_ALL;
};

export const aiStudioHubKindToQuery = (
  filter: AiStudioHubKindFilter
): Record<string, string> | undefined => {
  if (filter === AI_STUDIO_HUB_KIND_FILTER_ALL) {
    return undefined;
  }
  return { kind: filter };
};

export type AiStudioHubJobMeta = {
  kind: AiStudioHubJobKind;
  label: string;
  shortLabel: string;
  icon: string;
  emptyHeading: string;
  emptyDescription: string;
};

export const AI_STUDIO_HUB_JOB_META: Record<
  AiStudioHubJobKind,
  AiStudioHubJobMeta
> = {
  consultation: {
    kind: "consultation",
    label: "経営相談",
    shortLabel: "相談",
    icon: "flat-color-icons:business-contact",
    emptyHeading: "経営相談のセッションはまだありません",
    emptyDescription:
      "ナレッジを踏まえて、経営課題を AI と整理できます。",
  },
  writing: {
    kind: "writing",
    label: "書類記入",
    shortLabel: "書類",
    icon: "flat-color-icons:approval",
    emptyHeading: "書類記入のセッションはまだありません",
    emptyDescription:
      "テンプレートに沿って報告書・申請書などの文書を AI が起こします。",
  },
  sheet: {
    kind: "sheet",
    label: "シート編集",
    shortLabel: "シート",
    icon: "flat-color-icons:data-configuration",
    emptyHeading: "シート編集のセッションはまだありません",
    emptyDescription:
      "スプレッドシートを指定して、データの追記や修正を AI に依頼できます。",
  },
  image: {
    kind: "image",
    label: "画像生成",
    shortLabel: "画像",
    icon: "flat-color-icons:picture",
    emptyHeading: "画像生成のセッションはまだありません",
    emptyDescription:
      "参照画像や指示から、商品・広告用のビジュアルを生成できます。",
  },
  research: {
    kind: "research",
    label: "調査レポート",
    shortLabel: "調査",
    icon: "material-symbols:auto-stories",
    emptyHeading: "調査レポートのセッションはまだありません",
    emptyDescription:
      "テーマを伝えると AI が調査し、完了時にメールでお知らせします。",
  },
  data_analysis: {
    kind: "data_analysis",
    label: "データ分析",
    shortLabel: "分析",
    icon: "flat-color-icons:combo-chart",
    emptyHeading: "データ分析のセッションはまだありません",
    emptyDescription:
      "BigQuery と組織ナレッジを踏まえて、集計・比較・可視化を行います。",
  },
  web_page: {
    kind: "web_page",
    label: "WEBページ",
    shortLabel: "LP",
    icon: "material-symbols:desktop-windows-outline",
    emptyHeading: "WEBページのセッションはまだありません",
    emptyDescription:
      "目的・ページタイプ・参考URLから、シングルページLPのHTMLと素材を生成します。",
  },
};

export const resolveAiStudioHubJobMeta = (params: {
  jobKind: AiStudioJobKind | null;
}): AiStudioHubJobMeta | null => {
  const { jobKind } = params;
  if (!jobKind || !isAiStudioHubJobKind(jobKind)) {
    return null;
  }
  return AI_STUDIO_HUB_JOB_META[jobKind];
};

export const jobKindForNewSession = (
  filter: AiStudioHubKindFilter
): AiStudioHubJobKind | null => {
  if (filter === AI_STUDIO_HUB_KIND_FILTER_ALL) {
    return null;
  }
  return filter;
};

/** チャットワークスペース: 短ラベル + アイコン */
export const buildAiStudioWorkspaceModeSegmentItems =
  (): AiStudioModeSegmentOption[] =>
    AI_STUDIO_HUB_JOB_KINDS.map((kind) => ({
      value: kind,
      label: AI_STUDIO_HUB_JOB_META[kind].shortLabel,
      icon: AI_STUDIO_HUB_JOB_META[kind].icon,
    }));

/** AI Studio ハブ: 「すべて」+ モード */
export const buildAiStudioHubKindToggleItems = (): AiStudioModeSegmentOption[] => [
  {
    value: AI_STUDIO_HUB_KIND_FILTER_ALL,
    label: "すべて",
    icon: AI_STUDIO_HUB_ALL_TOGGLE_ICON,
  },
  ...buildAiStudioWorkspaceModeSegmentItems(),
];
