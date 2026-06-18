import type { GoogleDriveSyncStep } from "@models/googleDriveSyncRequest";
import type { DriveImportSessionState } from "@utils/driveImportSession";
import { DRIVE_IMPORT_USER_LABELS } from "@constants/driveImportUserLabels";

export type DriveImportStepperItem = {
  title: string;
  description?: string;
  icon?: string;
};

const PREP_STEPS = ["loadInput", "listDriveFolder"] as const;
const MIRROR_STEPS = ["diffWithMirror", "mirrorAdd", "mirrorRemove"] as const;
const REGISTER_STEPS = [
  "diffWithFileSpace",
  "registerAdd",
  "registerRemove",
] as const;

function countCompleted(
  steps: GoogleDriveSyncStep[],
  ids: readonly string[]
): number {
  const set = new Set(ids);
  return steps.filter(
    (s) => set.has(s.id) && (s.status === "completed" || s.status === "skipped")
  ).length;
}

function phaseStatus(
  steps: GoogleDriveSyncStep[],
  ids: readonly string[]
): "pending" | "running" | "completed" | "error" {
  const subset = steps.filter((s) => ids.includes(s.id));
  if (subset.some((s) => s.status === "error")) return "error";
  const done = countCompleted(steps, ids);
  if (done >= ids.length) return "completed";
  if (subset.some((s) => s.status === "running")) return "running";
  if (done > 0) return "running";
  return "pending";
}

function statusIcon(
  status: "pending" | "running" | "completed" | "error"
): string {
  switch (status) {
    case "completed":
      return "i-heroicons-check-circle";
    case "running":
      return "i-heroicons-arrow-path";
    case "error":
      return "i-heroicons-x-circle";
    default:
      return "i-heroicons-minus-circle";
  }
}

/**
 * EnStepper 用の 4 マクロ段階アイテムを RequestDoc スナップショットから生成。
 */
export function buildDriveImportStepperItems(
  session: DriveImportSessionState
): { items: DriveImportStepperItem[]; activeIndex: number } {
  const steps = session.steps ?? [];
  const prepStatus = phaseStatus(steps, PREP_STEPS);
  const mirrorStatus = phaseStatus(steps, MIRROR_STEPS);
  const registerStatus = phaseStatus(steps, REGISTER_STEPS);
  const finalizeStep = steps.find((s) => s.id === "finalize");
  const finalizeStatus: "pending" | "running" | "completed" | "error" =
    finalizeStep?.status === "error"
      ? "error"
      : finalizeStep?.status === "completed" || finalizeStep?.status === "skipped"
        ? "completed"
        : finalizeStep?.status === "running"
          ? "running"
          : session.phase === "completed"
            ? "completed"
            : "pending";

  const totalFiles = session.progress.totalFiles;
  const processedFiles = session.progress.processedFiles;
  const mirrorDone = countCompleted(steps, MIRROR_STEPS);
  const registerDone = countCompleted(steps, REGISTER_STEPS);

  const items: DriveImportStepperItem[] = [
    {
      title: DRIVE_IMPORT_USER_LABELS.stepper.prepare,
      description: `${countCompleted(steps, PREP_STEPS)}/${PREP_STEPS.length} 工程`,
      icon: statusIcon(prepStatus),
    },
    {
      title: DRIVE_IMPORT_USER_LABELS.stepper.mirror,
      description:
        totalFiles > 0
          ? `${processedFiles}/${totalFiles} ファイル · ${mirrorDone}/${MIRROR_STEPS.length} 工程`
          : `${mirrorDone}/${MIRROR_STEPS.length} 工程`,
      icon: statusIcon(mirrorStatus),
    },
    {
      title: DRIVE_IMPORT_USER_LABELS.stepper.register,
      description: `${registerDone}/${REGISTER_STEPS.length} 工程 · 反映 +${
        (session.register?.addedCount ?? 0) + (session.register?.updatedCount ?? 0)
      }`,
      icon: statusIcon(registerStatus),
    },
    {
      title: DRIVE_IMPORT_USER_LABELS.stepper.complete,
      description:
        finalizeStatus === "completed"
          ? "処理完了"
          : finalizeStatus === "running"
            ? "最終処理中"
            : "待機",
      icon: statusIcon(finalizeStatus),
    },
  ];

  const statuses = [prepStatus, mirrorStatus, registerStatus, finalizeStatus];
  let activeIndex = statuses.findIndex(
    (s) => s === "running" || s === "pending"
  );
  if (activeIndex < 0) {
    activeIndex = session.phase === "completed" ? 3 : 0;
  }

  return { items, activeIndex };
}
