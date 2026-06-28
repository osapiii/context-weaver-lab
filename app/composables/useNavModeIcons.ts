/**
 * Activity Bar（4 モード）用のカラーアイコン。
 * material-symbols の単色 tint より flat-color-icons で視認性・品質を上げる。
 *
 * @see https://icon-sets.iconify.design/flat-color-icons/
 */
export const useNavModeIcons = () => {
  return {
    home: "flat-color-icons:home",
    /** アプリ */
    applications: "flat-color-icons:deployment",
    /** ユーザーストーリー */
    stories: "flat-color-icons:flow-chart",
    /** 操作動画 */
    operationVideos: "material-symbols:video-camera-back-outline",
    /** 外部サービス連携 */
    externalServices: "material-symbols:conversion-path",
    /** 画面カタログ */
    screenCatalog: "material-symbols:preview-outline",
    /** 機能候補 */
    capabilities: "material-symbols:account-tree-outline",
    /** マスタ・実績・取引先の整備 */
    prepare: "flat-color-icons:survey",
    /** ナレッジ投入・AI 育成 */
    grow: "flat-color-icons:mind-map",
    /** AI / Workflow の実行ジョブ一覧 */
    worklog: "flat-color-icons:flow-chart",
  } as const;
};

/** 単色 text-* をかけると劣化するアイコンセット */
export function isMulticolorNavIcon(icon: string): boolean {
  return (
    icon.startsWith("flat-color-icons:") ||
    icon.startsWith("logos:") ||
    icon.startsWith("vscode-icons:")
  );
}
