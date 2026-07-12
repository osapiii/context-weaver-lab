<template>
  <div
    class="job-flow-node"
    :class="[
      `is-kind-${data.kind}`,
      `is-status-${data.status}`,
      { 'is-selected': selected },
    ]"
  >
    <Handle
      v-if="showTarget"
      id="target"
      type="target"
      :position="targetHandlePosition"
    />
    <div class="job-flow-node__body">
      <p class="job-flow-node__label">
        {{ data.label }}
      </p>
      <p
        v-if="data.sublabel"
        class="job-flow-node__sublabel"
      >
        {{ data.sublabel }}
      </p>
      <UProgress
        v-if="showProgress"
        class="job-flow-node__progress"
        :model-value="data.progressPercent ?? 0"
        :max="100"
        size="xs"
        :color="progressColor"
      />
    </div>
    <Handle
      v-if="showSource"
      id="source"
      type="source"
      :position="sourceHandlePosition"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import type { JobFlowNodeData } from "~/types/jobFlow";

const props = withDefaults(
  defineProps<{
    data: JobFlowNodeData;
    selected?: boolean;
    edgeLayout?: "horizontal" | "vertical";
  }>(),
  {
    edgeLayout: "horizontal",
  }
);

const targetHandlePosition = computed(() =>
  props.edgeLayout === "vertical" ? Position.Top : Position.Left
);
const sourceHandlePosition = computed(() =>
  props.edgeLayout === "vertical" ? Position.Bottom : Position.Right
);

const showTarget = computed(() => props.data.kind !== "source");
const showSource = computed(() => props.data.kind !== "sink");

const showProgress = computed(
  () =>
    props.data.progressPercent != null &&
    (props.data.status === "running" || props.data.kind === "hub")
);

const progressColor = computed(() => {
  if (props.data.status === "error") return "error";
  if (props.data.status === "completed") return "success";
  return "primary";
});
</script>

<style scoped>
.job-flow-node {
  min-width: 148px;
  max-width: 200px;
  border-radius: 10px;
  border: 2px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 0.08);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.job-flow-node.is-selected {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgb(245 158 11 / 0.25);
}

.job-flow-node.is-kind-source {
  border-color: #34d399;
  background: linear-gradient(135deg, #ecfdf5 0%, #fff 100%);
}

.job-flow-node.is-kind-hub {
  min-width: 168px;
  border-color: #38bdf8;
  background: linear-gradient(135deg, #f0f9ff 0%, #fff 100%);
}

.job-flow-node.is-kind-worker.is-status-waiting {
  border-color: #e2e8f0;
  background: #f8fafc;
}

.job-flow-node.is-kind-worker.is-status-running {
  border-color: #38bdf8;
  background: #f0f9ff;
}

.job-flow-node.is-kind-batch.is-status-queued {
  border-style: dashed;
  border-color: #94a3b8;
}

.job-flow-node.is-kind-batch.is-status-running {
  border-color: #8b5cf6;
  background: #fffbeb;
}

.job-flow-node.is-kind-batch.is-status-completed {
  border-color: #34d399;
  background: #ecfdf5;
}

.job-flow-node.is-kind-batch.is-status-error {
  border-color: #fb7185;
  background: #fff1f2;
}

.job-flow-node.is-kind-batchGroup {
  border-color: #6ee7b7;
  background: #ecfdf5;
  min-width: 120px;
}

.job-flow-node.is-kind-sink {
  border-color: #94a3b8;
  background: #f1f5f9;
}

.job-flow-node.is-kind-step.is-status-queued {
  border-style: dashed;
  border-color: #cbd5e1;
}

.job-flow-node.is-kind-step.is-status-running {
  border-color: #38bdf8;
  background: #f0f9ff;
}

.job-flow-node.is-kind-step.is-status-completed {
  border-color: #34d399;
  background: #ecfdf5;
}

.job-flow-node.is-kind-step.is-status-skipped {
  border-style: dashed;
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #94a3b8;
}

.job-flow-node.is-kind-step.is-status-error {
  border-color: #fb7185;
  background: #fff1f2;
}

.job-flow-node.is-kind-stage {
  border-color: #c4b5fd;
  background: #f5f3ff;
  font-weight: 700;
}

.job-flow-node__body {
  padding: 8px 10px;
}

.job-flow-node__label {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}

.job-flow-node__sublabel {
  margin-top: 2px;
  font-size: 10px;
  color: #64748b;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.job-flow-node__progress {
  margin-top: 6px;
}
</style>
