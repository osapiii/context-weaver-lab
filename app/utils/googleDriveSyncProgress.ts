import type {
  DecodedGoogleDriveSyncRequest,
  GoogleDriveSyncMirrorSummary,
  GoogleDriveSyncRegisterSummary,
} from "@models/googleDriveSyncRequest";
import {
  isGoogleDriveSyncPipelineActive,
  isGoogleDriveSyncTerminal,
} from "@utils/googleDriveSyncTerminal";

import {
  DRIVE_IMPORT_USER_LABELS,
  driveImportStepUserLabel,
} from "@constants/driveImportUserLabels";

/** Workflow steps の表示ラベル（ユーザー向け） */
const STEP_LABELS: Record<string, string> = {
  ...DRIVE_IMPORT_USER_LABELS.steps,
};

const STEP_RANK: Record<string, number> = {
  loadInput: 1,
  listDriveFolder: 2,
  diffWithMirror: 3,
  mirrorAdd: 4,
  mirrorRemove: 4,
  diffWithFileSpace: 5,
  registerAdd: 6,
  registerRemove: 6,
  finalize: 7,
};

const MAX_STEP_RANK = 7;

export function getDriveSyncStepLabel(step: string | undefined | null): string {
  if (!step) return "準備中";
  return STEP_LABELS[step] ?? driveImportStepUserLabel(step);
}

/**
 * RequestDoc 全体の概算進捗 (%) を返す。
 * Workflow の現在ステップ rank + バッチ進捗で 0-99 をならす。
 * 終端なら 100。
 */
export function getDriveSyncProgressPercent(
  request: DecodedGoogleDriveSyncRequest
): number {
  if (request.status === "error") return 100;
  if (isGoogleDriveSyncTerminal(request)) return 100;
  if (!isGoogleDriveSyncPipelineActive(request) && request.status === "pending") {
    return 5;
  }

  const currentStep = request.progress?.currentStep ?? "loadInput";
  const rank = STEP_RANK[currentStep] ?? 1;
  const stagePercent = Math.round((rank / MAX_STEP_RANK) * 100);

  const totalBatches = request.progress?.totalBatches ?? 0;
  const completedBatches = request.progress?.completedBatches ?? 0;
  if (totalBatches > 0) {
    const batchRatio = Math.min(1, completedBatches / totalBatches);
    const stageWeight = 100 / MAX_STEP_RANK;
    const withinStage = stageWeight * batchRatio;
    return Math.min(
      99,
      Math.max(0, Math.round(stagePercent - stageWeight + withinStage))
    );
  }
  return Math.min(99, Math.max(0, stagePercent));
}

export type DriveSyncOutputCounts = {
  addedCount: number;
  updatedCount: number;
  removedCount: number;
  failedCount: number;
  skippedCount: number;
};

export function getDriveSyncOutputCounts(
  request: DecodedGoogleDriveSyncRequest
): DriveSyncOutputCounts {
  const mirror: GoogleDriveSyncMirrorSummary = request.mirror ?? {};
  const register: GoogleDriveSyncRegisterSummary = request.register ?? {};
  return {
    addedCount: (mirror.addedCount ?? 0) + (register.addedCount ?? 0),
    updatedCount: (mirror.updatedCount ?? 0) + (register.updatedCount ?? 0),
    removedCount: (mirror.removedCount ?? 0) + (register.removedCount ?? 0),
    failedCount: (mirror.failedCount ?? 0) + (register.failedCount ?? 0),
    skippedCount: mirror.skippedCount ?? 0,
  };
}

/** バッチ結果の一行サマリ (UI 用) */
export function formatDriveSyncOutputSummary(
  request: DecodedGoogleDriveSyncRequest
): string {
  const c = getDriveSyncOutputCounts(request);
  const parts: string[] = [];
  if (c.addedCount > 0) parts.push(`追加 ${c.addedCount}`);
  if (c.updatedCount > 0) parts.push(`更新 ${c.updatedCount}`);
  if (c.removedCount > 0) parts.push(`削除 ${c.removedCount}`);
  if (c.failedCount > 0) parts.push(`失敗 ${c.failedCount}`);
  if (c.skippedCount > 0) parts.push(`スキップ ${c.skippedCount}`);
  return parts.length ? parts.join(" · ") : "変更なし";
}

export function getDriveSyncStatusPresentation(
  request: DecodedGoogleDriveSyncRequest
): {
  label: string;
  badgeColor: "primary" | "success" | "error" | "neutral" | "warning";
  badgeVariant: "soft" | "outline";
} {
  if (request.status === "error") {
    return { label: "失敗", badgeColor: "error", badgeVariant: "soft" };
  }
  if (isGoogleDriveSyncTerminal(request)) {
    const failed = getDriveSyncOutputCounts(request).failedCount;
    if (failed > 0) {
      return {
        label: `完了（${failed}件失敗）`,
        badgeColor: "warning",
        badgeVariant: "soft",
      };
    }
    return { label: "完了", badgeColor: "success", badgeVariant: "soft" };
  }
  if (isGoogleDriveSyncPipelineActive(request)) {
    return { label: "実行中", badgeColor: "primary", badgeVariant: "soft" };
  }
  if (request.status === "pending") {
    return { label: "待機", badgeColor: "neutral", badgeVariant: "outline" };
  }
  return { label: request.status, badgeColor: "neutral", badgeVariant: "outline" };
}
