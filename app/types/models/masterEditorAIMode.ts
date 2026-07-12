export type MasterEditorAIModeId = "analysis" | "edit" | "filter";

export const masterEditorAIModeHint = (mode: MasterEditorAIModeId): string => {
  switch (mode) {
    case "analysis":
      return "現在のマスタを集計・分析します";
    case "edit":
      return "マスタデータの追加・更新案を作成します";
    case "filter":
      return "条件に合うマスタ行を探します";
  }
};
