<template>
  <div class="da-chart">
    <div v-if="title" class="da-chart__title">{{ title }}</div>
    <div v-if="echartsOption" class="da-chart__canvas">
      <VChart
        :option="echartsOption"
        :autoresize="true"
        class="da-chart__echart"
      />
    </div>
    <div v-else class="da-chart__fallback">
      <p class="da-chart__fallback-text">
        このチャートはプレビューに対応していません。生の Vega-Lite spec を表示します:
      </p>
      <pre class="da-chart__pre">{{ prettyJson }}</pre>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import VChart from "vue-echarts";

import { vegaLiteToECharts } from "@utils/vegaLiteToECharts";

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
]);

const props = defineProps<{
  title?: string;
  spec: unknown;
}>();

const echartsOption = computed(() => {
  if (!props.spec || typeof props.spec !== "object") return null;
  return vegaLiteToECharts(props.spec as Parameters<typeof vegaLiteToECharts>[0]);
});

const prettyJson = computed(() => {
  try {
    return JSON.stringify(props.spec, null, 2);
  } catch {
    return String(props.spec);
  }
});
</script>

<style scoped>
.da-chart {
  margin: 0.75rem 0;
  border: 1px solid rgb(226 232 240);
  border-radius: 10px;
  background: white;
  overflow: hidden;
}
.da-chart__title {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(51 65 85);
  background: rgb(248 250 252);
  border-bottom: 1px solid rgb(226 232 240);
}
.da-chart__canvas {
  padding: 0.5rem;
}
.da-chart__echart {
  width: 100%;
  height: 280px;
}
.da-chart__fallback {
  padding: 0.75rem;
}
.da-chart__fallback-text {
  font-size: 0.75rem;
  color: rgb(100 116 139);
  margin-bottom: 0.5rem;
}
.da-chart__pre {
  font-size: 0.7rem;
  line-height: 1.4;
  max-height: 200px;
  overflow: auto;
  background: rgb(248 250 252);
  padding: 0.5rem;
  border-radius: 6px;
  margin: 0;
}
</style>
