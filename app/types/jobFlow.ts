import type { Node, Edge } from "@vue-flow/core";

/** ジョブフロー上のノード種別（画面表示用） */
export type JobFlowNodeKind =
  | "source"
  | "hub"
  | "worker"
  | "batch"
  | "batchGroup"
  | "sink"
  /** Workflow architecture: GCP Workflows の各 step */
  | "step"
  /** Workflow architecture: ステージ見出し (Mirror / Register) */
  | "stage";

export type JobFlowVisualStatus =
  | "idle"
  | "waiting"
  | "queued"
  | "running"
  | "completed"
  | "skipped"
  | "error";

export type JobFlowNodeData = {
  kind: JobFlowNodeKind;
  label: string;
  sublabel?: string;
  status: JobFlowVisualStatus;
  progressPercent?: number;
  /** 詳細パネル用 */
  batchIndex?: number;
  requestId?: string | null;
  slotIndex?: number | null;
  /** Workflow architecture: ステップ id (loadInput / listDriveFolder / ...) */
  stepId?: string;
  /** Workflow architecture: 所属ステージ */
  stage?: "mirror" | "register" | null;
};

export type JobFlowGraph = {
  nodes: Node<JobFlowNodeData>[];
  edges: Edge[];
};

export type JobFlowNodeSelection = {
  nodeId: string;
  data: JobFlowNodeData;
};
