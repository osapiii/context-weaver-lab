/**
 * モード TOP (NavCard) 用のカラー Hero アイコン。
 * UIcon / @nuxt/icon 経由で flat-color-icons・vscode-icons を表示する。
 *
 * @see https://icon-sets.iconify.design/flat-color-icons/
 */
export const useNavCardIcons = () => {
  return {
    /** 生産計画策定 */
    productionPlanning: "flat-color-icons:calendar",
    /** 経営相談 */
    businessConsultation: "flat-color-icons:business-contact",
    /** 書類記入 */
    aiWriting: "flat-color-icons:approval",
    /** 調査レポート作成 */
    slidesResearch: "flat-color-icons:search",
    /** 画像生成 */
    aiImage: "flat-color-icons:picture",
    /** 経営分析 (coming soon) */
    aiDataAnalysis: "flat-color-icons:combo-chart",
    /** ワークスペース一覧 */
    productionLines: "flat-color-icons:factory",
    /** データ管理 */
    masterSummary: "flat-color-icons:data-configuration",
    /** 取引先登録 */
    businessPartners: "flat-color-icons:contacts",
    /** 実績登録 */
    actuals: "flat-color-icons:ship",
    /** ナレッジ素材 */
    knowledgeMaterials: "vscode-icons:default-folder-opened",
    /** リクエストログ */
    requestLogs: "flat-color-icons:list",
    /** VibeControl */
    vibeControl: "flat-color-icons:flow-chart",
  } as const;
};
