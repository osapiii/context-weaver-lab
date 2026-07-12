/**
 * Drive ファイル一覧と Firestore Document の driveFileId を突合し、
 * 取り込みプレビュー件数を算出する (list + diff のみ、取り込みはしない).
 */

import { isKnowledgeIndexed } from "@utils/knowledge";
import type { Knowledge } from "@models/document";

export type DriveListFile = {
  id: string;
  name?: string | null;
  mimeType?: string | null;
  modifiedTime?: string | null;
};

/** pending diff 用の最小 Knowledge フィールド */
export type FirestoreDriveDoc = Pick<
  Knowledge,
  | "driveFileId"
  | "driveModifiedTime"
  | "name"
  | "agentSearchDocumentId"
  | "registration"
  | "filePath"
>;

export type DrivePendingDiffCounts = {
  addedCount: number;
  updatedCount: number;
  removedCount: number;
  skippedCount: number;
};

export type DrivePendingDiffResult = DrivePendingDiffCounts & {
  /** 取り込み対象 (新規 + 更新) の Drive fileId */
  importFileIds: string[];
  /** Drive から消えた分の削除対象 Drive fileId */
  removeFileIds: string[];
};

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

function parseDriveTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const s = value.endsWith("Z") ? value.replace(/Z$/, "+00:00") : value;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function driveIsNewer(
  driveModifiedTime: string | null | undefined,
  storedModifiedTime: string | null | undefined
): boolean {
  const driveMs = parseDriveTime(driveModifiedTime);
  if (driveMs === null) return false;
  const storedMs = parseDriveTime(storedModifiedTime);
  if (storedMs === null) return true;
  return driveMs > storedMs;
}

export function computeDrivePendingDiff(params: {
  driveFiles: DriveListFile[];
  existingDocs: FirestoreDriveDoc[];
  /** @deprecated diff 判定では未使用（後方互換のため残す） */
  fileSpaceId?: string;
  /** syncFolder 相当なら Drive に無い doc を removed に数える */
  allowRemovals?: boolean;
}): DrivePendingDiffResult {
  const { driveFiles, existingDocs, allowRemovals = true } = params;

  const files = driveFiles.filter((f) => f.id && f.mimeType !== DRIVE_FOLDER_MIME);

  const existingByDriveId = new Map<string, FirestoreDriveDoc>();
  for (const doc of existingDocs) {
    const driveId = doc.driveFileId?.trim();
    if (!driveId) continue;
    existingByDriveId.set(driveId, doc);
  }

  const driveIdsOnDrive = new Set(files.map((f) => f.id));

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let removedCount = 0;
  const importFileIds: string[] = [];
  const removeFileIds: string[] = [];

  for (const f of files) {
    const existing = existingByDriveId.get(f.id);
    if (!existing || !isKnowledgeIndexed(existing)) {
      addedCount += 1;
      importFileIds.push(f.id);
      continue;
    }
    if (driveIsNewer(f.modifiedTime, existing.driveModifiedTime)) {
      updatedCount += 1;
      importFileIds.push(f.id);
    } else {
      skippedCount += 1;
    }
  }

  if (allowRemovals) {
    for (const [driveId, existing] of existingByDriveId) {
      if (driveIdsOnDrive.has(driveId)) continue;
      if (!isKnowledgeIndexed(existing)) continue;
      removedCount += 1;
      removeFileIds.push(driveId);
    }
  }

  return {
    addedCount,
    updatedCount,
    removedCount,
    skippedCount,
    importFileIds,
    removeFileIds,
  };
}
