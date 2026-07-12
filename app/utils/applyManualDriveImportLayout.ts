import type { Node } from "@vue-flow/core";
import type { JobFlowNodeData } from "~/types/jobFlow";

/**
 * dagre が失敗したときの列ベース手動レイアウト（Workflow architecture, LR）.
 *
 * 列順:
 *   source → loadInput → listDriveFolder → diffWithMirror →
 *   {mirrorAdd / mirrorRemove} → diffWithFileSpace →
 *   {registerAdd / registerRemove} → finalize → sink
 */
const COLUMN_X: Record<string, number> = {
  source: 0,
  "step-loadInput": 200,
  "step-listDriveFolder": 400,
  "step-diffWithMirror": 600,
  "step-mirrorAdd": 800,
  "step-mirrorRemove": 800,
  "step-diffWithFileSpace": 1000,
  "step-registerAdd": 1200,
  "step-registerRemove": 1200,
  "step-finalize": 1400,
  sink: 1600,
};

const ROW_TOP = 0;
const ROW_BOTTOM = 100;
const ROW_CENTER = 50;

export function applyManualDriveImportLayout(
  nodes: Node<JobFlowNodeData>[]
): Node<JobFlowNodeData>[] {
  return nodes.map((node) => {
    const x = COLUMN_X[node.id] ?? 0;
    let y = ROW_CENTER;
    if (
      node.id === "step-mirrorAdd" ||
      node.id === "step-registerAdd"
    ) {
      y = ROW_TOP;
    } else if (
      node.id === "step-mirrorRemove" ||
      node.id === "step-registerRemove"
    ) {
      y = ROW_BOTTOM;
    }
    return {
      ...node,
      position: { x, y },
    };
  });
}
