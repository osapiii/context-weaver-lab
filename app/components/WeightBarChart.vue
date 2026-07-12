<template>
  <v-chart class="chart" :option="option" autoresize />
</template>

<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { defineProps, computed } from "vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components";
//#endregion

//#region Imports - コンポーネント
import VChart from "vue-echarts";
import { TABLEAU_SEMANTIC_COLORS } from "@constants/tableauPalette";
//#endregion

//#region ECharts Setup
use([
  CanvasRenderer,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);
//#endregion

//#region Props
const props = defineProps({
  weights: {
    type: Object,
    required: true,
  },
});
//#endregion

//#region Computed
const option = computed(() => {
  return {
    backgroundColor: "#282c34",
    title: {
      text: "重み付け",
      textStyle: {
        color: "#eee",
        fontSize: 8,
      },
      left: "center",
      top: "3%",
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      backgroundColor: "#333",
      borderColor: "#555",
      textStyle: {
        color: "#eee",
      },
    },
    legend: {
      data: ["重み付け"],
      textStyle: {
        fontWeight: "bold",
        color: "#eee",
        fontSize: 6,
      },
      left: "center",
      top: "10%",
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: Object.keys(props.weights),
      axisLine: {
        lineStyle: {
          color: "#666",
        },
      },
      axisTick: {
        lineStyle: {
          color: "#666",
        },
      },
      axisLabel: {
        fontWeight: "bold",
        color: "#eee",
        fontSize: 10.5,
        margin: 10,
      },
    },
    yAxis: {
      type: "value",
      axisLine: {
        lineStyle: {
          color: "#666",
        },
      },
      axisTick: {
        lineStyle: {
          color: "#666",
        },
      },
      splitLine: {
        lineStyle: {
          color: "#444",
        },
      },
      axisLabel: {
        fontWeight: "bold",
        color: "#eee",
        fontSize: 8,
      },
    },
    series: [
      {
        name: "重み付け",
        type: "bar",
        data: Object.values(props.weights),
        itemStyle: {
          color: TABLEAU_SEMANTIC_COLORS.weight,
        },
        label: {
          show: true,
          position: "inside",
          color: "white",
          fontSize: 8,
        },
      },
    ],
  };
});
//#endregion
</script>

<style scoped>
.chart {
  height: 200px;
  width: 600px;
  padding: 10px;
}
</style>
