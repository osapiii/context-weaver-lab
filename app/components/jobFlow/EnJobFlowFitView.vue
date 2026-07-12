<script setup lang="ts">
import { nextTick, watch } from "vue";
import { useVueFlow } from "@vue-flow/core";
import type { Edge, Node } from "@vue-flow/core";
import type { JobFlowNodeData } from "~/types/jobFlow";

const props = defineProps<{
  flowId: string;
  nodes: Node<JobFlowNodeData>[];
  edges: Edge[];
}>();

const { fitView } = useVueFlow({ id: props.flowId });

const fitGraph = () => {
  nextTick(() => {
    if (props.nodes.length === 0) return;
    const hasValidPosition = props.nodes.some(
      (n) => Number.isFinite(n.position?.x) && Number.isFinite(n.position?.y)
    );
    if (!hasValidPosition) return;
    try {
      fitView({ padding: 0.18, duration: 200 });
    } catch {
      // fitView はノード未マウント時に失敗することがある
    }
  });
};

watch(
  () => [props.nodes, props.edges],
  () => fitGraph(),
  { deep: true, immediate: true }
);
</script>

<template>
  <span class="hidden" aria-hidden="true" />
</template>
