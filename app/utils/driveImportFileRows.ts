import type { GoogleDriveSyncFileItem } from "@models/googleDriveSyncRequest";
import type { DriveImportSessionState } from "@utils/driveImportSession";
import { DRIVE_IMPORT_USER_LABELS } from "@constants/driveImportUserLabels";

export type DriveImportFileKind = "import" | "remove";

export type DriveImportFileItemSource = {
  driveFileId: string;
  kind: DriveImportFileKind;
  displayName?: string | null;
};

export type DriveImportFileColumnId =
  | "prepare"
  | "mirror"
  | "register"
  | "complete";

export type DriveImportFileColumnStatus =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "skipped";

export type DriveImportFileRow = {
  driveFileId: string;
  kind: DriveImportFileKind;
  label: string;
  columns: Record<DriveImportFileColumnId, DriveImportFileColumnStatus>;
  errorMessage?: string | null;
};

export type DriveImportFileColumnDef = {
  id: DriveImportFileColumnId;
  label: string;
};

export const DRIVE_IMPORT_FILE_COLUMNS: DriveImportFileColumnDef[] = [
  { id: "prepare", label: DRIVE_IMPORT_USER_LABELS.stepper.prepare },
  { id: "mirror", label: DRIVE_IMPORT_USER_LABELS.stepper.mirror },
  { id: "register", label: DRIVE_IMPORT_USER_LABELS.stepper.register },
  { id: "complete", label: DRIVE_IMPORT_USER_LABELS.stepper.complete },
];

const PREP_STEPS = ["loadInput", "listDriveFolder"] as const;
const MIRROR_STEPS = ["diffWithMirror", "mirrorAdd", "mirrorRemove"] as const;
const REGISTER_STEPS = [
  "diffWithFileSpace",
  "registerAdd",
  "registerRemove",
] as const;

type PhaseStatus = "pending" | "running" | "completed" | "error";

function phaseStatus(
  steps: DriveImportSessionState["steps"],
  ids: readonly string[]
): PhaseStatus {
  const subset = steps.filter((s) => ids.includes(s.id));
  if (subset.some((s) => s.status === "error")) return "error";
  const done = subset.filter(
    (s) => s.status === "completed" || s.status === "skipped"
  ).length;
  if (done >= ids.length) return "completed";
  if (subset.some((s) => s.status === "running")) return "running";
  if (done > 0) return "running";
  return "pending";
}

function shortDriveId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function resolveFileLabel(item: GoogleDriveSyncFileItem): string {
  const name = item.displayName?.trim();
  if (name) return name;
  return shortDriveId(item.driveFileId);
}

function buildPlaceholderItems(
  session: DriveImportSessionState
): GoogleDriveSyncFileItem[] {
  const items: GoogleDriveSyncFileItem[] = [];
  const importCount = session.importCount;
  const removeCount = session.removeCount;
  for (let i = 0; i < importCount; i++) {
    items.push({
      driveFileId: `pending-import-${i}`,
      kind: "import",
      displayName:
        importCount === 1 ? "取り込み対象ファイル" : `取り込み対象 ${i + 1}`,
      prepare: "pending",
      mirror: "pending",
      register: "pending",
      complete: "pending",
      errorMessage: null,
    });
  }
  for (let i = 0; i < removeCount; i++) {
    items.push({
      driveFileId: `pending-remove-${i}`,
      kind: "remove",
      displayName:
        removeCount === 1 ? "削除対象ファイル" : `削除対象 ${i + 1}`,
      prepare: "pending",
      mirror: "pending",
      register: "pending",
      complete: "pending",
      errorMessage: null,
    });
  }
  return items;
}

function columnFromPhase(
  phase: PhaseStatus,
  opts: { skip?: boolean } = {}
): DriveImportFileColumnStatus {
  if (opts.skip) return "skipped";
  switch (phase) {
    case "completed":
      return "completed";
    case "running":
      return "running";
    case "error":
      return "error";
    default:
      return "pending";
  }
}

/** RequestDoc の fileItem 段階 + マクロ段階をマージ (Workflow 未 patch 列は phase を反映) */
function resolveFileColumn(
  itemStage: GoogleDriveSyncFileItem[keyof Pick<
    GoogleDriveSyncFileItem,
    "prepare" | "mirror" | "register" | "complete"
  >],
  phase: PhaseStatus,
  opts: { skip?: boolean } = {}
): DriveImportFileColumnStatus {
  if (opts.skip) return "skipped";
  if (
    itemStage === "completed" ||
    itemStage === "error" ||
    itemStage === "skipped"
  ) {
    return itemStage;
  }
  if (itemStage === "running") return "running";
  return columnFromPhase(phase);
}

/**
 * RequestDoc スナップショットから 1 行 = 1 ファイルの進捗行を組み立てる。
 * `fileItems` に Workflow が書き込んだ段階ステータスを優先する。
 */
export function buildDriveImportFileRows(params: {
  session: DriveImportSessionState;
}): DriveImportFileRow[] {
  const { session } = params;
  const steps = session.steps ?? [];
  const prep = phaseStatus(steps, PREP_STEPS);
  const mirror = phaseStatus(steps, MIRROR_STEPS);
  const register = phaseStatus(steps, REGISTER_STEPS);
  const finalizeStep = steps.find((s) => s.id === "finalize");
  const completePhase: PhaseStatus =
    finalizeStep?.status === "error"
      ? "error"
      : finalizeStep?.status === "completed" ||
          finalizeStep?.status === "skipped" ||
          session.phase === "completed"
        ? "completed"
        : finalizeStep?.status === "running"
          ? "running"
          : register === "completed"
            ? "running"
            : "pending";

  const failedByDriveId = new Map<string, string>();
  for (const item of session.register?.failedItems ?? []) {
    const id = item.driveFileId?.trim();
    if (!id) continue;
    failedByDriveId.set(
      id,
      item.reason?.trim() || "素材プールへの反映に失敗しました"
    );
  }

  const items =
    session.fileItems.length > 0
      ? session.fileItems
      : buildPlaceholderItems(session);

  return items.map((item) => {
    const registerFailed = failedByDriveId.get(item.driveFileId);
    const errorMessage =
      item.errorMessage ?? registerFailed ?? null;

    return {
      driveFileId: item.driveFileId,
      kind: item.kind,
      label: resolveFileLabel(item),
      columns: {
        prepare: resolveFileColumn(item.prepare, prep),
        mirror: resolveFileColumn(item.mirror, mirror),
        register: registerFailed
          ? "error"
          : resolveFileColumn(item.register, register, {
              skip: item.kind === "remove" && register === "pending",
            }),
        complete: errorMessage
          ? "error"
          : resolveFileColumn(item.complete, completePhase),
      },
      errorMessage,
    };
  });
}

export function driveImportFileColumnIcon(
  status: DriveImportFileColumnStatus
): string {
  switch (status) {
    case "completed":
      return "i-heroicons-check-circle";
    case "running":
      return "i-heroicons-arrow-path";
    case "error":
      return "i-heroicons-x-circle";
    case "skipped":
      return "i-heroicons-minus-circle";
    default:
      return "i-heroicons-ellipsis-horizontal-circle";
  }
}

export function driveImportFileColumnTone(
  status: DriveImportFileColumnStatus
): string {
  switch (status) {
    case "completed":
      return "text-emerald-600";
    case "running":
      return "text-sky-600 animate-spin";
    case "error":
      return "text-rose-600";
    case "skipped":
      return "text-gray-400";
    default:
      return "text-slate-300";
  }
}

/** ステージセルの背景・リング (テーブル用) */
export function driveImportFileColumnCellClass(
  status: DriveImportFileColumnStatus
): string {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100";
    case "running":
      return "bg-sky-50 text-sky-600 ring-2 ring-sky-200 shadow-sm shadow-sky-100";
    case "error":
      return "bg-rose-50 text-rose-600 ring-1 ring-rose-100";
    case "skipped":
      return "bg-slate-50 text-slate-300 ring-1 ring-slate-100";
    default:
      return "bg-slate-50/80 text-slate-300 ring-1 ring-slate-100";
  }
}

export function driveImportFileTypeIcon(label: string): string {
  const ext = label.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "i-heroicons-document-text";
    case "doc":
    case "docx":
      return "i-heroicons-document";
    case "xls":
    case "xlsx":
    case "csv":
      return "i-heroicons-table-cells";
    case "ppt":
    case "pptx":
      return "i-heroicons-presentation-chart-bar";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return "i-heroicons-photo";
    default:
      return "i-heroicons-document";
  }
}

export function driveImportFileTypeTone(label: string): string {
  const ext = label.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "bg-rose-50 text-rose-600 ring-rose-100";
    case "doc":
    case "docx":
      return "bg-sky-50 text-sky-600 ring-sky-100";
    case "xls":
    case "xlsx":
    case "csv":
      return "bg-emerald-50 text-emerald-600 ring-emerald-100";
    case "ppt":
    case "pptx":
      return "bg-purple-50 text-purple-600 ring-purple-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export function shortDriveFileId(id: string): string {
  return shortDriveId(id);
}

export function driveImportRowIsActive(row: DriveImportFileRow): boolean {
  return Object.values(row.columns).some((s) => s === "running");
}

/** 全ファイル×全段階から全体進捗 % を算出 */
export function computeDriveImportProgressPercent(
  rows: DriveImportFileRow[]
): number {
  if (rows.length === 0) return 0;
  const columnIds = DRIVE_IMPORT_FILE_COLUMNS.map((c) => c.id);
  let done = 0;
  const total = rows.length * columnIds.length;
  for (const row of rows) {
    for (const id of columnIds) {
      const status = row.columns[id];
      if (
        status === "completed" ||
        status === "skipped" ||
        status === "error"
      ) {
        done += 1;
      } else if (status === "running") {
        done += 0.5;
      }
    }
  }
  return Math.min(100, Math.round((done / total) * 100));
}
