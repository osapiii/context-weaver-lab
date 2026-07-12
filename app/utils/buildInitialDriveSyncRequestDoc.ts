import {
  KNOWN_GOOGLE_DRIVE_SYNC_STEPS,
  type GoogleDriveSyncProgress,
  type GoogleDriveSyncStepsById,
  type GoogleDriveSyncUiFlow,
} from "@models/googleDriveSyncRequest";
import {
  createEmptyProgress,
  type DriveImportSessionState,
} from "@utils/driveImportSession";
import { buildDriveImportFlowGraph } from "@utils/buildDriveImportFlowGraph";
import { omitUndefinedValues } from "@utils/object";

export type BuildInitialDriveSyncSeedParams = {
  importCount: number;
  removeCount: number;
};

export type InitialDriveSyncRequestSeed = {
  steps: GoogleDriveSyncStepsById;
  progress: GoogleDriveSyncProgress;
  uiFlow: GoogleDriveSyncUiFlow;
};

function buildPendingStepsMap(): GoogleDriveSyncStepsById {
  const steps: NonNullable<GoogleDriveSyncStepsById> = {};
  for (const id of KNOWN_GOOGLE_DRIVE_SYNC_STEPS) {
    steps[id] = {
      id,
      status: "pending",
      stage: id.startsWith("mirror")
        ? "mirror"
        : id.startsWith("register") || id === "diffWithFileSpace"
          ? "register"
          : null,
      attempts: 0,
    };
  }
  return steps;
}

function serializeUiFlowFromSession(
  session: DriveImportSessionState
): GoogleDriveSyncUiFlow {
  const graph = buildDriveImportFlowGraph({ session, useLayoutOnly: true });
  return {
    version: 1,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type ?? "jobFlow",
      position: { x: node.position.x, y: node.position.y },
      data: omitUndefinedValues({
        kind: node.data?.kind ?? "step",
        label: node.data?.label ?? node.id,
        stepId: node.data?.stepId,
        stage: node.data?.stage ?? null,
      }) as GoogleDriveSyncUiFlow["nodes"][number]["data"],
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      dashed: Boolean(edge.style?.strokeDasharray),
    })),
  };
}

/**
 * RequestDoc 作成時に FE が書き込む steps / progress / uiFlow の初期 seed。
 */
export function buildInitialDriveSyncRequestSeed(
  params: BuildInitialDriveSyncSeedParams
): InitialDriveSyncRequestSeed {
  const importCount = params.importCount ?? 0;
  const removeCount = params.removeCount ?? 0;
  const steps = buildPendingStepsMap();
  const progress: GoogleDriveSyncProgress = {
    ...createEmptyProgress(),
    totalFiles: importCount + removeCount,
  };

  const session: DriveImportSessionState = {
    requestId: "seed",
    phase: "running",
    startedAt: Date.now(),
    endedAt: null,
    steps: Object.values(steps ?? {}),
    progress,
    mirror: null,
    register: null,
    workflow: null,
    importCount,
    removeCount,
    uiFlow: null,
    stepLogs: null,
    fileItems: [],
  };

  const uiFlow = serializeUiFlowFromSession(session);

  return { steps, progress, uiFlow };
}
