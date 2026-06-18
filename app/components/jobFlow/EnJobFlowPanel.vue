<template>
  <div
    ref="panelRef"
    class="en-aistudio-job-flow-panel ring-1 ring-slate-200 dark:ring-white/10 rounded-xl overflow-hidden bg-slate-50/80 dark:bg-slate-900/40"
    :style="panelStyle"
  >
    <VueFlow
      :id="flowId"
      :nodes="nodes"
      :edges="edges"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="true"
      :pan-on-scroll="true"
      :zoom-on-scroll="true"
      :min-zoom="0.35"
      :max-zoom="1.4"
      class="en-aistudio-job-flow-panel__canvas"
      @node-click="onNodeClick"
    >
      <EnJobFlowFitView
        :flow-id="flowId"
        :nodes="nodes"
        :edges="edges"
      />
      <template #node-jobFlow="nodeProps">
        <JobFlowNode
          :data="nodeProps.data as JobFlowNodeData"
          :selected="nodeProps.id === selectedNodeId"
          :edge-layout="edgeLayout"
        />
      </template>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { VueFlow } from "@vue-flow/core";
import type { Edge, Node } from "@vue-flow/core";
import JobFlowNode from "@components/jobFlow/JobFlowNode.vue";
import EnJobFlowFitView from "@components/jobFlow/EnJobFlowFitView.vue";
import createRandomId from "@utils/createRandomDocId";
import type { JobFlowNodeData, JobFlowNodeSelection } from "~/types/jobFlow";

const flowId = `en-aistudio-job-flow-${createRandomId()}`;
const panelRef = ref<HTMLElement | null>(null);

const props = withDefaults(
  defineProps<{
    nodes: Node<JobFlowNodeData>[];
    edges: Edge[];
    /** Vue Flow 親は px 数値必須 (CSS min()/vh は不可) */
    heightPx?: number;
    selectedNodeId?: string | null;
    edgeLayout?: "horizontal" | "vertical";
  }>(),
  {
    heightPx: 380,
    selectedNodeId: null,
    edgeLayout: "horizontal",
  }
);

const panelStyle = computed(() => {
  const px = Math.max(200, props.heightPx);
  return {
    height: `${px}px`,
    minHeight: `${px}px`,
    width: "100%",
  };
});

const emit = defineEmits<{
  select: [selection: JobFlowNodeSelection | null];
}>();

const onNodeClick = (event: { node: Node<JobFlowNodeData> }) => {
  const { node } = event;
  if (!node.data) {
    emit("select", null);
    return;
  }
  emit("select", { nodeId: node.id, data: node.data });
};
</script>

<style>
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";

.en-aistudio-job-flow-panel__canvas {
  width: 100%;
  height: 100%;
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 16px 16px;
}

.en-aistudio-job-flow-panel__canvas .vue-flow__pane {
  cursor: grab;
}
</style>
