<template>
  <v-chart class="chart" :option="chartOptions" autoresize />
</template>

<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent } from "echarts/components";
//#endregion

//#region Imports - コンポーネント
import VChart from "vue-echarts";
import {
  TABLEAU_10_PALETTE,
  TABLEAU_CHART_NEUTRALS,
} from "@constants/tableauPalette";
//#endregion

//#region Types
/**
 * 棒グラフのデータ形式
 *
 * @property {string} label - X軸のラベル
 * @property {number} value - Y軸の値
 */
interface barChartData {
  label: string;
  value: number;
}
//#endregion

//#region ECharts Setup
/**
 * EChartsに必要なコンポーネントとレンダラーを登録
 */
use([CanvasRenderer, BarChart, TooltipComponent, GridComponent]);
//#endregion

//#region Props
/**
 * コンポーネントのProps定義
 *
 * @property {barChartData[]} chartData - 棒グラフに表示するデータ配列
 */
const props = withDefaults(
  defineProps<{
    chartData: barChartData[];
  }>(),
  {
    chartData: () => [
      { label: "Jan", value: 100 },
      { label: "Feb", value: 200 },
      { label: "Mar", value: 300 },
      { label: "Apr", value: 400 },
      { label: "May", value: 500 },
    ],
  }
);
//#endregion

//#region Computed
/**
 * EChartsの棒グラフ設定オプション
 *
 * @remarks
 * 以下の設定を含む棒グラフを生成します：
 * - X軸：カテゴリ型、ラベルを90度回転
 * - Y軸：数値型
 * - ツールチップ表示
 * - 各バーの上部に値を表示
 */
const chartOptions = computed(() => ({
  color: [...TABLEAU_10_PALETTE],
  tooltip: {
    backgroundColor: TABLEAU_CHART_NEUTRALS.background,
    borderColor: TABLEAU_CHART_NEUTRALS.tooltipBorder,
    textStyle: { color: TABLEAU_CHART_NEUTRALS.text },
  },
  xAxis: {
    type: "category",
    data: props.chartData.map((data) => data.label),
    axisLabel: {
      color: TABLEAU_CHART_NEUTRALS.mutedText,
      fontSize: 10,
      rotate: 90,
    },
    axisLine: { lineStyle: { color: TABLEAU_CHART_NEUTRALS.axis } },
  },
  yAxis: {
    type: "value",
    show: true,
    axisLabel: { color: TABLEAU_CHART_NEUTRALS.mutedText },
    splitLine: { lineStyle: { color: TABLEAU_CHART_NEUTRALS.grid } },
  },
  series: [
    {
      name: "Sales",
      label: {
        show: true,
        position: "top",
      },
      type: "bar",
      itemStyle: { color: TABLEAU_10_PALETTE[0] },
      data: props.chartData.map((data) => data.value),
    },
  ],
}));
//#endregion
</script>

<style scoped>
.chart {
  width: 100%;
  height: 400px;
}
</style>
