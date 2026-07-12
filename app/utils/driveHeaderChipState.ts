import type { DriveImportSessionPhase } from "@utils/driveImportSession";

export type DriveHeaderChipState =
  | "unconfigured"
  | "scanning"
  | "idle"
  | "running"
  | "error"
  | "completedFlash";

export type DriveHeaderSummary = {
  chipState: DriveHeaderChipState;
  chipLabel: string;
  progressPercent: number;
  pendingAdded: number;
  pendingUpdated: number;
  pendingRemoved: number;
  folderName: string | null;
  lastSyncedAtMs: number | null;
  phaseLabel: string | null;
  canStartImport: boolean;
  canOpenProgress: boolean;
};

export function resolveDriveHeaderChipState(params: {
  isConfigured: boolean;
  isPendingScanInProgress: boolean;
  isSyncInProgress: boolean;
  completedFlashUntil: number | null;
  activeSessionPhase: DriveImportSessionPhase;
  lastSyncStatus: string | null | undefined;
  now?: number;
}): DriveHeaderChipState {
  const now = params.now ?? Date.now();
  if (!params.isConfigured) return "unconfigured";
  if (params.isPendingScanInProgress) return "scanning";
  if (params.isSyncInProgress) return "running";
  if (
    params.completedFlashUntil != null &&
    params.completedFlashUntil > now
  ) {
    return "completedFlash";
  }
  if (
    params.activeSessionPhase === "error" ||
    params.lastSyncStatus === "error"
  ) {
    return "error";
  }
  return "idle";
}

export function buildDriveHeaderChipLabel(params: {
  chipState: DriveHeaderChipState;
  pendingAdded: number;
  pendingUpdated: number;
  progressPercent: number;
}): string {
  switch (params.chipState) {
    case "unconfigured":
      return "Drive 未設定";
    case "scanning":
      return "確認中…";
    case "running":
      return `取り込み中 ${params.progressPercent}%`;
    case "error":
      return "取り込み失敗";
    case "completedFlash":
      return "取り込み完了";
    case "idle":
    default:
      if (params.pendingAdded > 0 && params.pendingUpdated > 0) {
        return `新規 ${params.pendingAdded} · 更新 ${params.pendingUpdated}`;
      }
      if (params.pendingAdded > 0) {
        return `新規 ${params.pendingAdded} 件`;
      }
      if (params.pendingUpdated > 0) {
        return `更新 ${params.pendingUpdated} 件`;
      }
      return "Drive 同期";
  }
}
