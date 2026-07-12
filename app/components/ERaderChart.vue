<template>
  <div ref="chart" class="chart" />
</template>

<script setup lang="ts">
//#region Imports - 外部ライブラリ
import { onMounted, nextTick, ref, computed, watchEffect } from "vue";
import { CanvasRenderer } from "echarts/renderers";
import { RadarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
//#endregion

//#region ECharts Setup
/**
 * EChartsに必要なコンポーネントとレンダラーを登録
 */
echarts.use([
  CanvasRenderer,
  RadarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
]);
//#endregion

//#region Store Access
/**
 * 診断設定ストア
 */
const diagnosisConfig = useDiagnosisConfigStore();

/**
 * 診断コントローラーストア
 */
const diagnosisController = useDiagnosisControllerStore();
//#endregion

//#region State
/**
 * チャート要素への参照
 */
const chart = ref(null);

/**
 * EChartsインスタンス
 */
let chartInstance: echarts.ECharts | null = null;
//#endregion

//#region Computed
/**
 * EChartsのレーダーチャート設定オプション
 *
 * @remarks
 * 診断結果のスコアをレーダーチャートで表示します。
 * 以下の設定を含みます：
 * - インジケーター：各診断項目の名前、最大値、スコア
 * - 軸ラベル：カスタムフォーマッターで名前とスコアを表示
 * - エリアスタイル：設定から取得した色で塗りつぶし
 * - ツールチップ：カスタム背景色とテキストスタイル
 */
const option = computed(() => {
  const indicators = diagnosisController.chartCalculatedScore.map((chart) => {
    return {
      name: chart.name,
      max: chart.totalScoreWeightRate,
      score: chart.calculatedTotalScore,
    };
  });
  const values: number[] = [];
  diagnosisController.chartCalculatedScore.forEach((chart) => {
    values.push(chart.calculatedTotalScore);
  });
  return {
    radar: {
      indicator: indicators,
      nameGap: 0,
      axisName: {
        backgroundColor:
          diagnosisConfig.resultPageConfig.raderChart.chart.tooltip.background
            .color,
        borderRadius: 3,
        padding: [3, 5],
        fontSize: 8.5,
        z: 100,
        formatter: function (value: string, item: any) {
          return "{a|" + value + "}\n{b|" + item.score + "}";
        },
        rich: {
          a: {
            color:
              diagnosisConfig.resultPageConfig.raderChart.chart.tooltip.title
                .color,
            fontSize: 12,
            align: "center",
            fontWeight: "bold",
          },
          b: {
            color:
              diagnosisConfig.resultPageConfig.raderChart.chart.tooltip.score
                .color,
            align: "center",
            fontSize: 16,
            fontWeight: "bold",
            padding: [2, 2, 0, 0],
          },
        },
      },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: values,
            areaStyle: {
              color:
                diagnosisConfig.resultPageConfig.raderChart.chart.area
                  .fillColor,
            },
            lineStyle: {
              color:
                diagnosisConfig.resultPageConfig.raderChart.chart.area
                  .fillColor,
            },
            itemStyle: {
              color:
                diagnosisConfig.resultPageConfig.raderChart.chart.area
                  .fillColor,
            },
          },
        ],
      },
    ],
  };
});
//#endregion

//#region Watch
/**
 * チャートオプションの変更を監視して再描画
 *
 * @remarks
 * optionが変更されたときに自動的にチャートを更新し、リサイズします。
 */
watchEffect(() => {
  if (chartInstance) {
    chartInstance.setOption(option.value);
    chartInstance.resize();
  }
});
//#endregion

//#region Lifecycle
/**
 * コンポーネントマウント時にチャートを初期化
 *
 * @remarks
 * 以下の処理を順次実行します：
 * 1. DOMの描画完了を待機
 * 2. EChartsインスタンスを初期化
 * 3. 初期オプションを設定
 * 4. ウィンドウリサイズイベントリスナーを登録
 * 5. 初回リサイズイベントを発火
 * 6. 2秒ごとにチャートを更新するインターバルを設定
 */
onMounted(async () => {
  await nextTick();
  chartInstance = echarts.init(chart.value);
  chartInstance.setOption(option.value);
  const handleResize = () => {
    if (chartInstance) {
      chartInstance.resize();
    }
  };
  window.addEventListener("resize", handleResize);
  window.dispatchEvent(new Event("resize"));
  // 2秒ごとにリサイズ処理を実行
  setInterval(() => {
    if (chartInstance) {
      chartInstance.setOption(option.value);
      chartInstance.resize();
    }
  }, 2000);
});
//#endregion
</script>

<style scoped>
.chart {
  height: 300px;
  width: 100%;
  display: flex;
  justify-content: center; /* 水平方向の中央揃え */
  align-items: center; /* 垂直方向の中央揃え */
}
</style>
