/**
 * Activity Bar（4 モード）用のカラーアイコン。
 * material-symbols の単色 tint より flat-color-icons で視認性・品質を上げる。
 *
 * @see https://icon-sets.iconify.design/flat-color-icons/
 */
export const useNavModeIcons = () => {
  return {
    home: "flat-color-icons:home",
    /** AI に仕事を依頼（ロケット / 起動） */
    work: "flat-color-icons:deployment",
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
