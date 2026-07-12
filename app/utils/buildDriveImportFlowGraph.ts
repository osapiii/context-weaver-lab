import type { Edge, Node } from "@vue-flow/core";
import type {
  DriveImportSessionState,
} from "@utils/driveImportSession";
import type {
  GoogleDriveSyncStep,
  GoogleDriveSyncStepStatus,
} from "@models/googleDriveSyncRequest";
import { DRIVE_IMPORT_USER_LABELS } from "@constants/driveImportUserLabels";
import { applyManualDriveImportLayout } from "@utils/applyManualDriveImportLayout";
import { layoutJobFlowGraph } from "@utils/layoutJobFlowGraph";
import log from "@utils/logger";
import type {
  JobFlowGraph,
  JobFlowNodeData,
  JobFlowVisualStatus,
} from "~/types/jobFlow";

const ORIGIN = { x: 0, y: 0 };

export type BuildDriveImportFlowGraphParams = {
  session: DriveImportSessionState;
  /** uiFlow シリアライズ用: status は pending 固定で layout のみ生成 */
  useLayoutOnly?: boolean;
};

type StepDescriptor = {
  id: string;
  label: string;
  stage: "intro" | "mirror" | "register" | "finalize";
};

/** Workflow YAML の step 順序と 1:1 で対応（label はユーザー向け文言） */
const STEP_DESCRIPTORS: StepDescriptor[] = [
  { id: "loadInput", label: DRIVE_IMPORT_USER_LABELS.steps.loadInput, stage: "intro" },
  { id: "listDriveFolder", label: DRIVE_IMPORT_USER_LABELS.steps.listDriveFolder, stage: "intro" },
  { id: "diffWithMirror", label: DRIVE_IMPORT_USER_LABELS.steps.diffWithMirror, stage: "mirror" },
  { id: "mirrorAdd", label: DRIVE_IMPORT_USER_LABELS.steps.mirrorAdd, stage: "mirror" },
  { id: "mirrorRemove", label: DRIVE_IMPORT_USER_LABELS.steps.mirrorRemove, stage: "mirror" },
  { id: "diffWithFileSpace", label: DRIVE_IMPORT_USER_LABELS.steps.diffWithFileSpace, stage: "register" },
  { id: "registerAdd", label: DRIVE_IMPORT_USER_LABELS.steps.registerAdd, stage: "register" },
  { id: "registerRemove", label: DRIVE_IMPORT_USER_LABELS.steps.registerRemove, stage: "register" },
  { id: "finalize", label: DRIVE_IMPORT_USER_LABELS.steps.finalize, stage: "finalize" },
];

function stepStatusToVisual(
  status: GoogleDriveSyncStepStatus | undefined
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

function makeNode(
  id: string,
  data: JobFlowNodeData
): Node<JobFlowNodeData> {
  return {
    id,
    type: "jobFlow",
    position: { ...ORIGIN },
    data,
    draggable: false,
    selectable: true,
  };
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

function makeEdge(
  id: string,
  source: string,
  target: string,
  opts?: { dashed?: boolean; status?: JobFlowVisualStatus }
): Edge {
  const status = opts?.status ?? "waiting";
  return {
    id,
    source,
    target,
    type: "smoothstep",
    animated: status === "running",
    style: {
      stroke: edgeStrokeFromStatus(status),
      strokeWidth: status === "running" ? 2.5 : 1.5,
      strokeDasharray: opts?.dashed ? "6 4" : undefined,
    },
  };
}

/**
 * Workflow architecture: 単一 RequestDoc の steps[] を Mirror / Register
 * 2 ステージのフロー図に展開する。
 */
export function buildDriveImportFlowGraph(
  params: BuildDriveImportFlowGraphParams
): JobFlowGraph {
  const { session } = params;
  const stepById = new Map<string, GoogleDriveSyncStep>();
  for (const step of session.steps ?? []) {
    stepById.set(step.id, step);
  }

  const nodes: Node<JobFlowNodeData>[] = [];
  const edges: Edge[] = [];

  const phaseStatus: JobFlowVisualStatus = (() => {
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
  })();

  // Source / Sink
  nodes.push(
    makeNode("source", {
      kind: "source",
      label: "Google Drive",
      sublabel: session.importCount + session.removeCount
        ? `${session.importCount} 追加 · ${session.removeCount} 削除`
        : "対象ファイル",
      status: session.phase === "running" ? "running" : phaseStatus,
    })
  );

  nodes.push(
    makeNode("sink", {
      kind: "sink",
      label: DRIVE_IMPORT_USER_LABELS.flow.sink,
      sublabel: DRIVE_IMPORT_USER_LABELS.flow.sinkSublabel,
      status: phaseStatus,
    })
  );

  // Workflow steps as nodes
  for (const desc of STEP_DESCRIPTORS) {
    const step = stepById.get(desc.id);
    const status = stepStatusToVisual(step?.status);
    const stageLabelMap = {
      intro: null,
      mirror: DRIVE_IMPORT_USER_LABELS.stepper.mirror,
      register: DRIVE_IMPORT_USER_LABELS.stepper.register,
      finalize: null,
    };
    nodes.push(
      makeNode(`step-${desc.id}`, {
        kind: "step",
        label: desc.label,
        sublabel:
          step?.attempts && step.attempts > 1
            ? `試行 ${step.attempts}`
            : step?.error
              ? step.error.slice(0, 40)
              : stageLabelMap[desc.stage] ?? undefined,
        status,
        stepId: desc.id,
        stage:
          desc.stage === "mirror"
            ? "mirror"
            : desc.stage === "register"
              ? "register"
              : null,
      })
    );
  }

  // Source -> loadInput
  edges.push(
    makeEdge("e-source-loadInput", "source", "step-loadInput", {
      status: stepStatusToVisual(stepById.get("loadInput")?.status),
    })
  );

  // Sequential pre-stage chain: loadInput -> listDriveFolder -> diffWithMirror
  edges.push(
    makeEdge(
      "e-loadInput-listDriveFolder",
      "step-loadInput",
      "step-listDriveFolder",
      { status: stepStatusToVisual(stepById.get("listDriveFolder")?.status) }
    )
  );
  edges.push(
    makeEdge(
      "e-listDriveFolder-diffWithMirror",
      "step-listDriveFolder",
      "step-diffWithMirror",
      { status: stepStatusToVisual(stepById.get("diffWithMirror")?.status) }
    )
  );

  // Mirror parallel branches: diffWithMirror -> {mirrorAdd, mirrorRemove}
  edges.push(
    makeEdge(
      "e-diffWithMirror-mirrorAdd",
      "step-diffWithMirror",
      "step-mirrorAdd",
      { status: stepStatusToVisual(stepById.get("mirrorAdd")?.status) }
    )
  );
  edges.push(
    makeEdge(
      "e-diffWithMirror-mirrorRemove",
      "step-diffWithMirror",
      "step-mirrorRemove",
      {
        status: stepStatusToVisual(stepById.get("mirrorRemove")?.status),
        dashed: true,
      }
    )
  );

  // Mirror branches join into diffWithFileSpace
  edges.push(
    makeEdge(
      "e-mirrorAdd-diffWithFileSpace",
      "step-mirrorAdd",
      "step-diffWithFileSpace",
      { status: stepStatusToVisual(stepById.get("diffWithFileSpace")?.status) }
    )
  );
  edges.push(
    makeEdge(
      "e-mirrorRemove-diffWithFileSpace",
      "step-mirrorRemove",
      "step-diffWithFileSpace",
      {
        status: stepStatusToVisual(stepById.get("diffWithFileSpace")?.status),
        dashed: true,
      }
    )
  );

  // Register parallel branches: diffWithFileSpace -> {registerAdd, registerRemove}
  edges.push(
    makeEdge(
      "e-diffWithFileSpace-registerAdd",
      "step-diffWithFileSpace",
      "step-registerAdd",
      { status: stepStatusToVisual(stepById.get("registerAdd")?.status) }
    )
  );
  edges.push(
    makeEdge(
      "e-diffWithFileSpace-registerRemove",
      "step-diffWithFileSpace",
      "step-registerRemove",
      {
        status: stepStatusToVisual(stepById.get("registerRemove")?.status),
        dashed: true,
      }
    )
  );

  // Register branches join into finalize
  edges.push(
    makeEdge(
      "e-registerAdd-finalize",
      "step-registerAdd",
      "step-finalize",
      { status: stepStatusToVisual(stepById.get("finalize")?.status) }
    )
  );
  edges.push(
    makeEdge(
      "e-registerRemove-finalize",
      "step-registerRemove",
      "step-finalize",
      {
        status: stepStatusToVisual(stepById.get("finalize")?.status),
        dashed: true,
      }
    )
  );

  // finalize -> sink
  edges.push(
    makeEdge("e-finalize-sink", "step-finalize", "sink", {
      status: phaseStatus,
    })
  );

  let layoutedNodes: Node<JobFlowNodeData>[];
  try {
    layoutedNodes = layoutJobFlowGraph(nodes, edges, {
      rankdir: "LR",
      nodesep: 40,
      ranksep: 96,
    });
    const invalid = layoutedNodes.some(
      (n) =>
        !Number.isFinite(n.position.x) || !Number.isFinite(n.position.y)
    );
    if (invalid) {
      throw new Error("dagre produced invalid node positions");
    }
  } catch (e) {
    log("WARN", "buildDriveImportFlowGraph: dagre failed, manual layout", e);
    layoutedNodes = applyManualDriveImportLayout(nodes);
  }

  return { nodes: layoutedNodes, edges };
}
