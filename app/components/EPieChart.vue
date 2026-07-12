<template>
  <v-chart class="chart p-10" :option="option" autoresize />
</template>

<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { computed } from "vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { PieChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
//#endregion

//#region Imports - コンポーネント
import VChart from "vue-echarts";
import {
  TABLEAU_10_PALETTE,
  TABLEAU_CHART_NEUTRALS,
} from "@constants/tableauPalette";
//#endregion

//#region ECharts Setup
/**
 * EChartsに必要なコンポーネントとレンダラーを登録
 */
use([
  CanvasRenderer,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
]);
//#endregion

//#region Computed
/**
 * EChartsの円グラフ設定オプション
 *
 * @remarks
 * デモ用のサンプルデータを表示する円グラフです。
 * 以下の設定を含みます：
 * - タイトル：「Referer of a Website」
 * - ツールチップ：アイテムトリガー
 * - 凡例：左側に縦配置
 * - 強調表示：ホバー時に影を表示
 */
const option = computed(() => {
  return {
    color: [...TABLEAU_10_PALETTE],
    title: {
      text: "Referer of a Website",
      subtext: "Fake Data",
      left: "center",
      textStyle: { color: TABLEAU_CHART_NEUTRALS.text },
      subtextStyle: { color: TABLEAU_CHART_NEUTRALS.mutedText },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: TABLEAU_CHART_NEUTRALS.background,
      borderColor: TABLEAU_CHART_NEUTRALS.tooltipBorder,
      textStyle: { color: TABLEAU_CHART_NEUTRALS.text },
    },
    legend: {
      orient: "vertical",
      left: "left",
      textStyle: { color: TABLEAU_CHART_NEUTRALS.mutedText },
    },
    series: [
      {
        name: "Access From",
        type: "pie",
        radius: "50%",
        data: [
          { value: 1048, name: "Search Engine" },
          { value: 735, name: "Direct" },
          { value: 580, name: "Email" },
          { value: 484, name: "Union Ads" },
          { value: 300, name: "Video Ads" },
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  };
});
//#endregion
</script>

<style scoped>
.chart {
  height: 300px;
  padding: 20px;
}
</style>
