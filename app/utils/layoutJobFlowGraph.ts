import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@vue-flow/core";
import log from "@utils/logger";

/** Vue Flow ノード寸法（JobFlowNode 実寸に合わせた概算） */
const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 58;

export type LayoutJobFlowGraphOptions = {
  rankdir?: "LR" | "TB" | "RL" | "BT";
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
};

function isFinitePosition(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y);
}

/**
 * dagre 未配置ノード用の簡易グリッド（孤立ノード対策）.
 */
function fallbackGridPosition(index: number): { x: number; y: number } {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: marginGridX + col * (DEFAULT_NODE_WIDTH + 48),
    y: marginGridY + row * (DEFAULT_NODE_HEIGHT + 40),
  };
}

const marginGridX = 24;
const marginGridY = 24;

/**
 * dagre でノード座標を自動配置（Vue Flow 公式レイアウト例と同様）.
 * @see https://vueflow.dev/examples/layout/simple.html
 */
export function layoutJobFlowGraph<T = Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  options: LayoutJobFlowGraphOptions = {}
): Node<T>[] {
  if (nodes.length === 0) return [];

  const {
    rankdir = "LR",
    nodesep = 36,
    ranksep = 80,
    marginx = 28,
    marginy = 28,
  } = options;

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir, nodesep, ranksep, marginx, marginy });

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    });
  }

  for (const edge of edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  let fallbackIndex = 0;
  return nodes.map((node) => {
    const layoutNode = graph.node(node.id);
    if (
      layoutNode &&
      isFinitePosition(layoutNode.x, layoutNode.y)
    ) {
      return {
        ...node,
        position: {
          x: layoutNode.x - DEFAULT_NODE_WIDTH / 2,
          y: layoutNode.y - DEFAULT_NODE_HEIGHT / 2,
        },
      };
    }

    const grid = fallbackGridPosition(fallbackIndex);
    fallbackIndex += 1;
    log("WARN", "layoutJobFlowGraph: fallback position for node", node.id);
    return {
      ...node,
      position: grid,
    };
  });
}
