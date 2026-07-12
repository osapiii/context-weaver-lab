export type WorkspaceEditMode = "analysis" | "edit" | "filter";

export const workspaceEditModeHint = (
  mode: WorkspaceEditMode
): string => {
  switch (mode) {
    case "analysis":
      return "業務データを集計・分析します";
    case "edit":
      return "業務データの追加・更新案を作成します";
    case "filter":
      return "条件に合う業務データを探します";
  }
};
