import dagre from "dagre";
import type { Edge, Node } from "@vue-flow/core";
import { ref } from "vue";
import { z } from "zod";
import log from "@utils/logger";

/**
 * Composable to run the layout algorithm on the graph.
 * It uses the `dagre` library to calculate the layout of the nodes and edges.
 */
export function useVueFLowLayout() {
  const graph = ref(new dagre.graphlib.Graph());
  const layoutNodeSchema = z.object({
    id: z.union([z.number(), z.undefined()]),
    width: z.number(),
    height: z.number(),
    x: z.number(),
    y: z.number(),
  });

  function layout(
    nodes: Node[],
    edges: Edge[]
  ): z.infer<typeof layoutNodeSchema>[] {
    log("INFO", "vueFlowLayout.layout triggered!");
    log("INFO", "nodes is....", nodes);
    log("INFO", "edges is....", edges);
    // we create a new graph instance, in case some nodes/edges were removed, otherwise dagre would act as if they were still there
    const dagreGraph = new dagre.graphlib.Graph();

    graph.value = dagreGraph;

    dagreGraph.setGraph({ rankdir: "LR", align: "DL" });
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Nodeを追加
    for (const node of nodes) {
      if (node.id != undefined) {
        dagreGraph.setNode(node.id, {
          id: node.id,
          width: 350,
          height: 60,
        });
      }
    }

    // Edgeを追加
    for (const edge of edges) {
      dagreGraph.setEdge(edge.source, edge.target);
    }

    dagre.layout(dagreGraph);
    const layoutNodes: z.infer<typeof layoutNodeSchema>[] = [];
    nodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      layoutNodes.push({
        ...nodeWithPosition,
        isHighlighted: false,
      });
    });
    log("INFO", "layout finished! ", layoutNodes);
    return layoutNodes;
  }

  return { layout };
}
