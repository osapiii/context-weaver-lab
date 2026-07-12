/**
 * UI session model for the GCP Workflows-based Drive Sync.
 *
 * 1 manual import = 1 RequestDoc = 1 Workflow execution.
 * This module no longer tracks plan / slots (the FE no longer fans out
 * batches; the Workflow does). Instead it mirrors the relevant pieces of
 * the RequestDoc that the import progress modal renders.
 */

import {
  KNOWN_GOOGLE_DRIVE_SYNC_STEPS,
  type DecodedGoogleDriveSyncRequest,
  type GoogleDriveSyncMirrorSummary,
  type GoogleDriveSyncProgress,
  type GoogleDriveSyncRegisterSummary,
  type GoogleDriveSyncStep,
  type GoogleDriveSyncStepLogs,
  type GoogleDriveSyncStepsById,
  type GoogleDriveSyncUiFlow,
  type GoogleDriveSyncLogEntry,
  type GoogleDriveSyncWorkflowMeta,
} from "@models/googleDriveSyncRequest";
import type { GoogleDriveSyncFileItem } from "@models/googleDriveSyncRequest";
import { truncateStepLogs } from "@utils/truncateStepLogs";

export type DriveImportSessionPhase = "idle" | "running" | "completed" | "error";

export type DriveImportSessionState = {
  /** Active RequestDoc id; null when idle */
  requestId: string | null;
  phase: DriveImportSessionPhase;
  startedAt: number | null;
  endedAt: number | null;
  /** Snapshot of the live RequestDoc projected onto the modal */
  steps: GoogleDriveSyncStep[];
  progress: GoogleDriveSyncProgress;
  mirror: GoogleDriveSyncMirrorSummary | null;
  register: GoogleDriveSyncRegisterSummary | null;
  workflow: GoogleDriveSyncWorkflowMeta | null;
  /** Cached file counts (from input) so the UI knows totals before Workflow patches `progress` */
  importCount: number;
  removeCount: number;
  /** FE seed した Vue Flow レイアウト */
  uiFlow: GoogleDriveSyncUiFlow | null;
  /** Workflow が書き込む実行ログ (正規化済み) */
  stepLogs: Record<string, GoogleDriveSyncLogEntry[]> | null;
  /** 1 行 = 1 ファイル (Workflow writeback + FE seed) */
  fileItems: GoogleDriveSyncFileItem[];
};

export function createIdleImportSession(): DriveImportSessionState {
  return {
    requestId: null,
    phase: "idle",
    startedAt: null,
    endedAt: null,
    steps: [],
    progress: createEmptyProgress(),
    mirror: null,
    register: null,
    workflow: null,
    importCount: 0,
    removeCount: 0,
    uiFlow: null,
    stepLogs: null,
    fileItems: [],
  };
}

export function createEmptyProgress(): GoogleDriveSyncProgress {
  return {
    currentStep: null,
    currentStage: null,
    totalFiles: 0,
    processedFiles: 0,
    totalBatches: 0,
    completedBatches: 0,
    failedBatches: 0,
  };
}

export function deriveSessionPhase(
  request: Pick<DecodedGoogleDriveSyncRequest, "status" | "workflow">
): DriveImportSessionPhase {
  const wfState = request.workflow?.state;
  if (wfState === "FAILED" || wfState === "CANCELLED") return "error";
  if (wfState === "SUCCEEDED") return "completed";
  if (request.status === "completed") return "completed";
  if (request.status === "error") return "error";
  if (request.status === "processing" || request.status === "pending") {
    return "running";
  }
  return "idle";
}

/**
 * `step.detail` は Workflow YAML 側で JSON 文字列化されて Firestore に入るケースが
 * あるため、Record に揃える。Parse 失敗時は { raw: "<string>" } にフォールバック。
 */
function normalizeStepDetail(
  detail: GoogleDriveSyncStep["detail"]
): Record<string, unknown> | null {
  if (detail == null) return null;
  if (typeof detail === "string") {
    if (detail.trim().length === 0) return null;
    try {
      const parsed = JSON.parse(detail);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch {
      return { raw: detail };
    }
  }
  return detail as Record<string, unknown>;
}

/**
 * Workflow が書き戻す `steps` (map keyed by stepId) を、UI が並べる固定順の配列に正規化する。
 * 未登場の step は `pending` で埋めて、Vue Flow / プログレスバー がフリッカーしないようにする。
 */
export function normalizeStepMapToArray(
  stepsById: GoogleDriveSyncStepsById | undefined | null
): GoogleDriveSyncStep[] {
  const map = stepsById ?? {};
  return KNOWN_GOOGLE_DRIVE_SYNC_STEPS.map((id) => {
    const entry = (map as Record<string, GoogleDriveSyncStep | undefined>)[id];
    if (entry) {
      return {
        ...entry,
        id,
        detail: normalizeStepDetail(entry.detail),
      };
    }
    return {
      id,
      status: "pending" as const,
      stage: id.startsWith("mirror")
        ? ("mirror" as const)
        : id.startsWith("register") || id === "diffWithFileSpace"
          ? ("register" as const)
          : null,
      attempts: 0,
    } satisfies GoogleDriveSyncStep;
  });
}

function orderedFileItemIds(
  request: DecodedGoogleDriveSyncRequest,
  prev?: DriveImportSessionState | null
): string[] {
  const byId = request.fileItems ?? {};
  const prevItems = prev?.fileItems ?? [];
  const ordered: string[] = [];
  const seen = new Set<string>();

  const pushId = (driveFileId: string | null | undefined) => {
    const id = driveFileId?.trim();
    if (!id || seen.has(id)) return;
    ordered.push(id);
    seen.add(id);
  };

  // 1) 既存セッション順を最優先 (Firestore snapshot で並びが変わらない)
  for (const item of prevItems) {
    pushId(item.driveFileId);
  }

  // 2) kicker / scan 時の import → remove 順
  const payload = request._kickerPayload;
  for (const id of payload?.importIds ?? []) {
    pushId(id);
  }
  for (const id of payload?.removeIds ?? []) {
    pushId(id);
  }

  // 3) RequestDoc にだけ存在する ID (Workflow patch 等)
  for (const id of Object.keys(byId).sort((a, b) => a.localeCompare(b))) {
    pushId(id);
  }

  return ordered;
}

function mergeFileItemsFromRequest(
  request: DecodedGoogleDriveSyncRequest,
  prev?: DriveImportSessionState | null
): GoogleDriveSyncFileItem[] {
  const byId = request.fileItems ?? {};
  const prevById = new Map(
    (prev?.fileItems ?? []).map((item) => [item.driveFileId, item])
  );
  const orderedIds = orderedFileItemIds(request, prev);

  if (orderedIds.length === 0) {
    return fileItemsFromKickerPayload(request, prev);
  }

  return orderedIds.map((driveFileId) => {
    const fromRequest = byId[driveFileId];
    const fromPrev = prevById.get(driveFileId);
    if (fromRequest) {
      return {
        ...fromRequest,
        displayName:
          fromRequest.displayName ?? fromPrev?.displayName ?? null,
      };
    }
    return fromPrev!;
  });
}

function fileItemsFromKickerPayload(
  request: DecodedGoogleDriveSyncRequest,
  prev?: DriveImportSessionState | null
): GoogleDriveSyncFileItem[] {
  if (prev?.fileItems?.length) return prev.fileItems;
  const payload = request._kickerPayload;
  if (!payload) return [];
  const importItems = (payload.importIds ?? []).map((driveFileId) => ({
    driveFileId,
    kind: "import" as const,
    displayName: null,
    prepare: "pending" as const,
    mirror: "pending" as const,
    register: "pending" as const,
    complete: "pending" as const,
    errorMessage: null,
  }));
  const removeItems = (payload.removeIds ?? []).map((driveFileId) => ({
    driveFileId,
    kind: "remove" as const,
    displayName: null,
    prepare: "pending" as const,
    mirror: "pending" as const,
    register: "pending" as const,
    complete: "pending" as const,
    errorMessage: null,
  }));
  return [...importItems, ...removeItems];
}

/**
 * RequestDoc → DriveImportSessionState の射影。
 * 不在フィールドはデフォルトに置き換え、UI 側で安全に bind できる形にする。
 */
export function projectRequestToSession(
  request: DecodedGoogleDriveSyncRequest,
  prev?: DriveImportSessionState | null
): DriveImportSessionState {
  const progress = request.progress ?? createEmptyProgress();
  const importCount = request.input?.importCount ?? prev?.importCount ?? 0;
  const removeCount = request.input?.removeCount ?? prev?.removeCount ?? 0;
  const totalFiles = progress.totalFiles || importCount + removeCount;
  const steps = normalizeStepMapToArray(request.steps);

  return {
    requestId: request.id,
    phase: deriveSessionPhase(request),
    startedAt: prev?.startedAt ?? request.createdAt?.toMillis?.() ?? Date.now(),
    endedAt:
      deriveSessionPhase(request) === "completed" ||
      deriveSessionPhase(request) === "error"
        ? request.updatedAt?.toMillis?.() ?? Date.now()
        : null,
    steps,
    progress: {
      ...progress,
      totalFiles,
    },
    mirror: request.mirror ?? null,
    register: request.register ?? null,
    workflow: request.workflow ?? null,
    importCount,
    removeCount,
    uiFlow: request.uiFlow ?? null,
    stepLogs: truncateStepLogsForSession(request.stepLogs),
    fileItems: mergeFileItemsFromRequest(request, prev),
  };
}

function truncateStepLogsForSession(
  stepLogs: DecodedGoogleDriveSyncRequest["stepLogs"]
): Record<string, GoogleDriveSyncLogEntry[]> | null {
  if (!stepLogs) return null;
  const normalized = truncateStepLogs(stepLogs);
  return Object.keys(normalized).length > 0 ? normalized : null;
}

/** Number rendered in the modal as "登録 +N" */
export function summarizeAddedFiles(session: DriveImportSessionState): number {
  return (
    (session.mirror?.addedCount ?? 0) +
    (session.mirror?.updatedCount ?? 0) +
    (session.register?.addedCount ?? 0) +
    (session.register?.updatedCount ?? 0)
  );
}

/** Number rendered in the modal as "失敗 N" */
export function summarizeFailedFiles(session: DriveImportSessionState): number {
  return (
    (session.mirror?.failedCount ?? 0) +
    (session.register?.failedCount ?? 0)
  );
}
