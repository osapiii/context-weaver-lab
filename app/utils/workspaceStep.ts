/**
 * AI Studio ワークスペース — ジョブ別 step（EnStepper / Firestore bucket 共通）
 */
import type { ImageWorkflowPhase } from "@utils/imageStudioState";
import type { WritingPhase, WritingReferenceStatus } from "@models/writingForm";

/** 画像スタジオ: 初稿生成 → レタッチ */
export type ImageWorkspaceStep = ImageWorkflowPhase;

/** 文書: 参考資料 → フォーマット → 入力・生成 */
export type WritingWorkspaceStep = "reference" | WritingPhase;

export const IMAGE_WORKSPACE_STEPS: ReadonlyArray<{
  value: ImageWorkspaceStep;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    value: "create",
    title: "初稿生成",
    description: "プロンプトまたはお手本から初稿を作成",
    icon: "material-symbols:add-photo-alternate-outline",
  },
  {
    value: "retouch",
    title: "レタッチ",
    description: "範囲指定や指示で部分修正",
    icon: "material-symbols:brush",
  },
] as const;

export const WRITING_WORKSPACE_STEPS: ReadonlyArray<{
  value: WritingWorkspaceStep;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    value: "reference",
    title: "参考資料",
    description: "資料を追加して参照を確定",
    icon: "material-symbols:description-outline",
  },
  {
    value: "format_review",
    title: "フォーマット",
    description: "入力項目の確認・確定",
    icon: "material-symbols:table-rows-outline",
  },
  {
    value: "filling",
    title: "自動入力",
    description: "AI がナレッジを参照して入力",
    icon: "material-symbols:edit-note-outline",
  },
] as const;

export const imageStepToIndex = (step: ImageWorkspaceStep): number =>
  step === "retouch" ? 1 : 0;

export const imageIndexToStep = (index: number): ImageWorkspaceStep =>
  index >= 1 ? "retouch" : "create";

export const resolveImageWorkspaceStep = (params: {
  step?: unknown;
  workflowPhase?: unknown;
}): ImageWorkspaceStep => {
  const raw = params.step ?? params.workflowPhase;
  if (raw === "retouch" || raw === "create") return raw;
  return "create";
};

export const resolveWritingWorkspaceStep = (params: {
  step?: unknown;
  phase?: unknown;
  referenceStatus: WritingReferenceStatus;
}): WritingWorkspaceStep => {
  const fromState = params.step ?? params.phase;
  if (params.referenceStatus !== "complete") return "reference";
  if (fromState === "filling" || fromState === "done") return fromState;
  if (fromState === "format_review") return "format_review";
  return "format_review";
};

export const writingStepToIndex = (step: WritingWorkspaceStep): number => {
  if (step === "reference") return 0;
  if (step === "format_review") return 1;
  return 2;
};

export const normalizeWritingPhaseFromStep = (
  step: WritingWorkspaceStep
): WritingPhase => {
  if (step === "filling" || step === "done") return step;
  return "format_review";
};
