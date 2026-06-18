import type { Edge, Node } from "@vue-flow/core";
import type {
  GoogleDriveSyncStep,
  GoogleDriveSyncUiFlow,
} from "@models/googleDriveSyncRequest";
import type {
  DriveImportSessionState,
} from "@utils/driveImportSession";
import { DRIVE_IMPORT_USER_LABELS } from "@constants/driveImportUserLabels";
import { buildDriveImportFlowGraph } from "@utils/buildDriveImportFlowGraph";
import type {
  JobFlowGraph,
  JobFlowNodeData,
  JobFlowVisualStatus,
} from "~/types/jobFlow";

function stepStatusToVisual(
  status: GoogleDriveSyncStep["status"] | undefined
): JobFlowVisualStatus {
  switch (status) {
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "error":
      return "error";
    case "skipped":
      return "skipped";
    case "pending":
    default:
      return "queued";
  }
}

function edgeStrokeFromStatus(status: JobFlowVisualStatus): string {
  switch (status) {
    case "running":
      return "#0284c7";
    case "completed":
      return "#059669";
    case "error":
      return "#e11d48";
    case "skipped":
      return "#94a3b8";
    case "queued":
      return "#94a3b8";
    default:
      return "#cbd5e1";
  }
}

function makeEdgeFromLayout(
  layout: GoogleDriveSyncUiFlow["edges"][number],
  status: JobFlowVisualStatus
): Edge {
  return {
    id: layout.id,
    source: layout.source,
    target: layout.target,
    type: "smoothstep",
    animated: status === "running",
    style: {
      stroke: edgeStrokeFromStatus(status),
      strokeWidth: status === "running" ? 2.5 : 1.5,
      strokeDasharray: layout.dashed ? "6 4" : undefined,
    },
  };
}

function resolveNodeStatus(
  nodeId: string,
  stepById: Map<string, GoogleDriveSyncStep>,
  session: DriveImportSessionState
): JobFlowVisualStatus {
  if (nodeId === "source") {
    return session.phase === "running" ? "running" : session.phase === "completed"
      ? "completed"
      : session.phase === "error"
        ? "error"
        : "idle";
  }
  if (nodeId === "sink") {
    switch (session.phase) {
      case "completed":
        return "completed";
      case "error":
        return "error";
      case "running":
        return "running";
      default:
        return "idle";
    }
  }
  if (nodeId.startsWith("step-")) {
    const stepId = nodeId.slice("step-".length);
    return stepStatusToVisual(stepById.get(stepId)?.status);
  }
  return "idle";
}

export type MergeUiFlowWithStepsParams = {
  uiFlow: GoogleDriveSyncUiFlow;
  session: DriveImportSessionState;
};

/**
 * RequestDoc の uiFlow 雛形に steps の status をマージして Vue Flow 用グラフを返す。
 */
export function mergeUiFlowWithSteps(
  params: MergeUiFlowWithStepsParams
): JobFlowGraph {
  const { uiFlow, session } = params;
  const stepById = new Map<string, GoogleDriveSyncStep>();
  for (const step of session.steps ?? []) {
    stepById.set(step.id, step);
  }

  const nodes: Node<JobFlowNodeData>[] = uiFlow.nodes.map((layout) => {
    const status = resolveNodeStatus(layout.id, stepById, session);
    const stepId = layout.data.stepId;
    const step = stepId ? stepById.get(stepId) : undefined;

    let sublabel: string | undefined;
    if (layout.id === "source") {
      sublabel =
        session.importCount + session.removeCount
          ? `${session.importCount} 追加 · ${session.removeCount} 削除`
          : "対象ファイル";
    } else if (layout.id === "sink") {
      sublabel = DRIVE_IMPORT_USER_LABELS.flow.sinkSublabel;
    } else if (step?.attempts && step.attempts > 1) {
      sublabel = `試行 ${step.attempts}`;
    } else if (step?.error) {
      sublabel = step.error.slice(0, 40);
    } else if (layout.data.stage === "mirror") {
      sublabel = DRIVE_IMPORT_USER_LABELS.stepper.mirror;
    } else if (layout.data.stage === "register") {
      sublabel = DRIVE_IMPORT_USER_LABELS.stepper.register;
    }

    return {
      id: layout.id,
      type: layout.type,
      position: { ...layout.position },
      data: {
        kind: layout.data.kind as JobFlowNodeData["kind"],
        label: layout.data.label,
        sublabel,
        status,
        stepId: layout.data.stepId,
        stage: layout.data.stage ?? null,
      },
      draggable: false,
      selectable: true,
    };
  });

  const nodeStatusById = new Map(
    nodes.map((n) => [n.id, n.data?.status ?? "idle"])
  );

  const edges: Edge[] = uiFlow.edges.map((layout) => {
    const targetStatus =
      (nodeStatusById.get(layout.target) as JobFlowVisualStatus) ?? "waiting";
    return makeEdgeFromLayout(layout, targetStatus);
  });

  return { nodes, edges };
}

/**
 * uiFlow が無い古い RequestDoc 向けフォールバック付きグラフ構築。
 */
export function buildDriveImportFlowGraphFromRequest(
  session: DriveImportSessionState
): JobFlowGraph {
  if (session.uiFlow) {
    return mergeUiFlowWithSteps({ uiFlow: session.uiFlow, session });
  }
  return buildDriveImportFlowGraph({ session });
}
